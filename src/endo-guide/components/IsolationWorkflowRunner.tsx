import React, { useMemo, useState } from "react";
import type { ClinicalEvent, EmbeddedWorkflowLaunch, EndoCase, ProtocolNode } from "../types";
import type { IsolationEventDetails, IsolationEventType, IsolationMethod, IsolationRegionKind } from "../workflow/isolation";
import { getIsolationEventDetails, isolationEventTypes, isolationMethods, isolationRegionKinds, sharedIsolationWorkflow } from "../workflow/isolation";
import { buildUserIsolationCatalogItemsFromForm, getIsolationCatalogOptions } from "../workflow/isolationCatalog";
import type { CatalogItem } from "../workflow/catalogs";
import { SelectInput, TextInput } from "./FormControls";

const isolationActionLabels = {
  [isolationEventTypes.rubberDamPlaced]: "Rubber dam placed",
  [isolationEventTypes.alternativeIsolationUsed]: "Alternative isolation used",
  [isolationEventTypes.compromised]: "Isolation compromised",
  [isolationEventTypes.removed]: "Isolation removed",
  [isolationEventTypes.replaced]: "Isolation replaced",
} as const satisfies Record<IsolationEventType, string>;

const alternativeIsolationMethodOptions = isolationMethods.filter((method) => method !== "rubberDam");
const replacementIsolationMethodOptions = [...isolationMethods];

type IsolationFormState = {
  method: IsolationMethod;
  regionKind: IsolationRegionKind;
  regionLabel: string;
  exposedTeeth: string;
  clampCode: string;
  clampTooth: string;
  note: string;
};

function defaultIsolationForm(tooth: string): IsolationFormState {
  return {
    method: "rubberDam",
    regionKind: "custom",
    regionLabel: "",
    exposedTeeth: tooth || "",
    clampCode: "",
    clampTooth: tooth || "",
    note: "",
  };
}

function getIsolationEventType(node: ProtocolNode, optionIndex: number): IsolationEventType | undefined {
  const type = node.options[optionIndex]?.noteEvent?.type;
  return Object.values(isolationEventTypes).includes(type as IsolationEventType) ? type as IsolationEventType : undefined;
}

function getDefaultEventType(node: ProtocolNode): IsolationEventType {
  return getIsolationEventType(node, 0) || isolationEventTypes.rubberDamPlaced;
}

function shouldShowMethod(eventType: IsolationEventType) {
  return eventType === isolationEventTypes.alternativeIsolationUsed || eventType === isolationEventTypes.replaced;
}

function shouldShowClamp(eventType: IsolationEventType, method: IsolationMethod) {
  return eventType === isolationEventTypes.rubberDamPlaced || (eventType === isolationEventTypes.replaced && method === "rubberDam");
}

function buildIsolationDetails(form: IsolationFormState, eventType: IsolationEventType): IsolationEventDetails {
  const teeth = form.exposedTeeth.split(/[,\s]+/).map((tooth) => tooth.trim()).filter(Boolean);
  const reassessment = eventType === isolationEventTypes.compromised || eventType === isolationEventTypes.removed;
  const clamp = shouldShowClamp(eventType, form.method);

  return {
    method: eventType === isolationEventTypes.rubberDamPlaced ? "rubberDam" : reassessment ? undefined : form.method,
    regionKind: form.regionKind,
    regionLabel: form.regionLabel.trim() || undefined,
    exposedTeeth: teeth.length ? teeth : undefined,
    clampCode: clamp ? form.clampCode.trim() || undefined : undefined,
    clampTooth: clamp ? form.clampTooth.trim() || undefined : undefined,
    reason: reassessment ? form.note.trim() || undefined : undefined,
    notes: !reassessment ? form.note.trim() || undefined : undefined,
  };
}

function formFromEvent(event: ClinicalEvent | undefined, tooth: string): IsolationFormState {
  if (!event) return defaultIsolationForm(tooth);
  const details = getIsolationEventDetails(event);
  return {
    ...defaultIsolationForm(tooth),
    method: details.method || "rubberDam",
    regionKind: details.regionKind || "custom",
    regionLabel: details.regionLabel || "",
    exposedTeeth: details.exposedTeeth?.join(" ") || tooth || "",
    clampCode: details.clampCode || details.supports?.find((support) => support.type === "clamp")?.clampCode || "",
    clampTooth: details.clampTooth || details.supports?.find((support) => support.type === "clamp")?.tooth || tooth || "",
  };
}

export function IsolationWorkflowRunner({
  launch,
  caseData,
  parentWorkflowRunId,
  latestIsolationEvent,
  userCatalogItems = [],
  onUserCatalogItemsChange,
  onClose,
  onRecordIsolationEvent,
}: {
  launch: EmbeddedWorkflowLaunch;
  caseData: EndoCase;
  parentWorkflowRunId: string;
  latestIsolationEvent?: ClinicalEvent;
  userCatalogItems?: CatalogItem[];
  onUserCatalogItemsChange?: (items: CatalogItem[]) => void;
  onClose: () => void;
  onRecordIsolationEvent: (
    eventType: IsolationEventType,
    details: IsolationEventDetails,
    context: { nodeId: string; label: string; workflowRunId: string; parentWorkflowRunId: string }
  ) => void;
}) {
  const workflow = sharedIsolationWorkflow;
  const [moduleNodeId, setModuleNodeId] = useState(launch.entryNodeId || workflow.entryNodeIds[0]);
  const currentNode = workflow.nodes[moduleNodeId] || workflow.nodes[workflow.entryNodeIds[0]];
  const defaultEventType = getDefaultEventType(currentNode);
  const [selectedEventType, setSelectedEventType] = useState<IsolationEventType>(defaultEventType);
  const [form, setForm] = useState<IsolationFormState>(() => formFromEvent(latestIsolationEvent, caseData.tooth));
  const completion = workflow.completionNodeIds.includes(currentNode.id);
  const visibleOptions = useMemo(() => currentNode.options || [], [currentNode.options]);
  const selectedOption = visibleOptions.find((option) => option.noteEvent?.type === selectedEventType) || visibleOptions[0];
  const methodOptions = selectedEventType === isolationEventTypes.replaced ? replacementIsolationMethodOptions : alternativeIsolationMethodOptions;
  const regionLabelSuggestions = getIsolationCatalogOptions("regionLabels", userCatalogItems);
  const clampCodeSuggestions = getIsolationCatalogOptions("clampCodes", userCatalogItems);
  const noteSuggestions = getIsolationCatalogOptions("notes", userCatalogItems);
  const reasonSuggestions = getIsolationCatalogOptions("reasons", userCatalogItems);
  const shortcutItems = buildUserIsolationCatalogItemsFromForm({
    action: selectedEventType,
    regionLabel: form.regionLabel,
    clampCode: shouldShowClamp(selectedEventType, form.method) ? form.clampCode : "",
    note: form.note,
  });
  const canSaveShortcuts = Boolean(onUserCatalogItemsChange && shortcutItems.length);

  function updateForm(updates: Partial<IsolationFormState>) {
    setForm((prev) => ({ ...prev, ...updates }));
  }

  function updateSelectedEventType(eventType: IsolationEventType) {
    setSelectedEventType(eventType);
    if (eventType === isolationEventTypes.alternativeIsolationUsed) {
      setForm((prev) => ({ ...prev, method: prev.method === "rubberDam" ? "splitDam" : prev.method }));
    }
  }

  function applySelectedOption() {
    if (!selectedOption) return;
    const eventType = selectedOption.noteEvent?.type as IsolationEventType | undefined;

    if (eventType) {
      onRecordIsolationEvent(eventType, buildIsolationDetails(form, eventType), {
        nodeId: currentNode.id,
        label: selectedOption.label,
        workflowRunId: launch.workflowRunId,
        parentWorkflowRunId,
      });
    }

    setModuleNodeId(selectedOption.nextNodeId);
    const nextNode = workflow.nodes[selectedOption.nextNodeId];
    if (nextNode) setSelectedEventType(getDefaultEventType(nextNode));
  }

  function saveCatalogItems() {
    if (!onUserCatalogItemsChange || !shortcutItems.length) return;
    const nextItems = shortcutItems.reduce((current, item) => {
      const index = current.findIndex((candidate) => candidate.id === item.id);
      if (index === -1) return [...current, item];
      return current.map((candidate, candidateIndex) => candidateIndex === index ? item : candidate);
    }, userCatalogItems);
    onUserCatalogItemsChange(nextItems);
  }

  return (
    <>
      <div className="rounded-2xl border border-brand-light-node bg-brand-light-slate p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-slate">{currentNode.phase}</p>
        <h3 className="mt-1 text-xl font-bold text-brand-navy">{currentNode.title}</h3>
        <p className="mt-2 text-sm leading-6 text-brand-navy">{currentNode.chairsideInstruction}</p>
        {currentNode.requiredInputs?.length ? (
          <p className="mt-2 text-xs font-semibold text-brand-slate">Record: {currentNode.requiredInputs.join(", ")}</p>
        ) : null}
      </div>

      {!completion ? (
        <div className="mt-4 rounded-2xl border border-brand-light-node bg-brand-light-slate p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <SelectInput
              label="Isolation action"
              value={isolationActionLabels[selectedEventType]}
              onChange={(value) => {
                const option = visibleOptions.find((item) => item.label === value);
                const eventType = option?.noteEvent?.type as IsolationEventType | undefined;
                if (eventType) updateSelectedEventType(eventType);
              }}
              options={visibleOptions.map((option) => option.label)}
            />
            {shouldShowMethod(selectedEventType) ? (
              <SelectInput
                label="Method"
                value={form.method}
                onChange={(value) => updateForm({ method: value as IsolationMethod })}
                options={methodOptions}
              />
            ) : null}
            <SelectInput
              label="Region"
              value={form.regionKind}
              onChange={(value) => updateForm({ regionKind: value as IsolationRegionKind })}
              options={[...isolationRegionKinds]}
            />
            <TextInput label="Region label" value={form.regionLabel} onChange={(value) => updateForm({ regionLabel: value })} placeholder="e.g., Q3, upper anterior, custom" suggestions={regionLabelSuggestions} />
            <TextInput label="Exposed teeth" value={form.exposedTeeth} onChange={(value) => updateForm({ exposedTeeth: value })} placeholder="e.g., 34 35 36 37" />
            {shouldShowClamp(selectedEventType, form.method) ? (
              <>
                <TextInput label="Clamp tooth" value={form.clampTooth} onChange={(value) => updateForm({ clampTooth: value })} placeholder="e.g., 37" />
                <TextInput label="Clamp code" value={form.clampCode} onChange={(value) => updateForm({ clampCode: value })} placeholder="e.g., W8A" suggestions={clampCodeSuggestions} />
              </>
            ) : null}
            <TextInput
              label={selectedEventType === isolationEventTypes.compromised || selectedEventType === isolationEventTypes.removed ? "Reason" : "Notes"}
              value={form.note}
              onChange={(value) => updateForm({ note: value })}
              placeholder={selectedEventType === isolationEventTypes.compromised ? "e.g., saliva contamination" : "optional"}
              suggestions={selectedEventType === isolationEventTypes.compromised || selectedEventType === isolationEventTypes.removed ? reasonSuggestions : noteSuggestions}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col items-stretch gap-2 sm:items-start">
        {completion ? (
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-brand-navy bg-brand-navy px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-navy-deep sm:w-auto"
          >
            Return to parent workflow
          </button>
        ) : selectedOption ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <button
              type="button"
              onClick={applySelectedOption}
              className="w-full max-w-full rounded-xl border border-brand-navy bg-brand-navy px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-brand-navy-deep sm:w-auto sm:max-w-sm"
            >
              Record {selectedOption.label.toLowerCase()}
              <span className="mt-1 block text-xs font-normal text-white/80">Next: {workflow.nodes[selectedOption.nextNodeId]?.title || selectedOption.nextNodeId}</span>
            </button>
            {onUserCatalogItemsChange ? (
              <button
                type="button"
                onClick={saveCatalogItems}
                disabled={!canSaveShortcuts}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${canSaveShortcuts ? "border-brand-blue-light bg-white text-brand-navy hover:bg-brand-light-slate" : "cursor-not-allowed border-brand-light-node bg-brand-light-slate text-brand-slate"}`}
              >
                Save shortcuts
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
