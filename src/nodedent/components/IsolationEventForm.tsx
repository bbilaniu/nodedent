import React, { useEffect, useRef, useState } from "react";
import type { ClinicalEvent } from "../types";
import type { IsolationEventDetails, IsolationEventType, IsolationMethod, IsolationRegionKind } from "../workflow/isolation";
import { isolationEventTypes } from "../workflow/isolation";
import { buildUserIsolationCatalogItemsFromForm, getIsolationCatalogOptions } from "../workflow/isolationCatalog";
import type { CatalogItem } from "../workflow/catalogs";
import {
  alternativeIsolationMethodOptions,
  buildIsolationEventFromForm,
  buildIsolationFormState,
  defaultIsolationFormState,
  isolationActionLabels,
  isolationActionOptions,
  isolationEventTypeFromLabel,
  isolationRegionOptions,
  isolationSubmitLabels,
  isIsolationReassessmentAction,
  replacementIsolationMethodOptions,
  showsIsolationClampFields,
  showsIsolationMethodField,
} from "../workflow/isolationForm";
import type { IsolationFormState } from "../workflow/isolationForm";
import { SelectInput, TextInput } from "./FormControls";

export function IsolationEventForm({
  tooth,
  latestEvent,
  isolationIsEstablished = false,
  userCatalogItems = [],
  onSaveCatalogItems,
  onManageShortcuts,
  onRecordEvent,
}: {
  tooth: string;
  latestEvent?: ClinicalEvent;
  isolationIsEstablished?: boolean;
  userCatalogItems?: CatalogItem[];
  onSaveCatalogItems?: (items: CatalogItem[]) => void;
  onManageShortcuts?: () => void;
  onRecordEvent: (eventType: IsolationEventType, details: IsolationEventDetails) => void;
}) {
  const [form, setForm] = useState<IsolationFormState>(() => defaultIsolationFormState(tooth));
  const previousToothRef = useRef(tooth);
  const showMethodField = showsIsolationMethodField(form.action);
  const methodOptions = form.action === isolationEventTypes.replaced ? replacementIsolationMethodOptions : alternativeIsolationMethodOptions;
  const actionIsReassessment = isIsolationReassessmentAction(form.action);
  const showMethodLabelField = !actionIsReassessment;
  const showClampFields = showsIsolationClampFields(form);
  const isolationMethodLabelSuggestions = getIsolationCatalogOptions("methodLabels", userCatalogItems);
  const isolationSupportTypeSuggestions = getIsolationCatalogOptions("supportTypes", userCatalogItems);
  const isolationSupportPhraseSuggestions = getIsolationCatalogOptions("supportPhrases", userCatalogItems);
  const isolationRegionLabelSuggestions = getIsolationCatalogOptions("regionLabels", userCatalogItems);
  const isolationClampCodeSuggestions = getIsolationCatalogOptions("clampCodes", userCatalogItems);
  const isolationReasonSuggestions = getIsolationCatalogOptions("reasons", userCatalogItems);
  const isolationNoteSuggestions = getIsolationCatalogOptions("notes", userCatalogItems);
  const shortcutItems = buildUserIsolationCatalogItemsFromForm({
    action: form.action,
    methodLabel: showMethodLabelField ? form.methodLabel : "",
    regionLabel: form.regionLabel,
    clampCode: showClampFields ? form.clampCode : "",
    supportType: showMethodLabelField ? form.supportLabel : "",
    supportPhrase: showMethodLabelField ? form.supportNote : "",
    note: form.note,
  });
  const canSaveShortcuts = Boolean(onSaveCatalogItems && shortcutItems.length);

  useEffect(() => {
    const previousTooth = previousToothRef.current;
    previousToothRef.current = tooth;
    setForm((prev) => ({
      ...prev,
      exposedTeeth: !prev.exposedTeeth || prev.exposedTeeth === previousTooth ? tooth || "" : prev.exposedTeeth,
      clampTooth: !prev.clampTooth || prev.clampTooth === previousTooth ? tooth || "" : prev.clampTooth,
    }));
  }, [tooth]);

  function updateForm(updates: Partial<IsolationFormState>) {
    setForm((prev) => ({ ...prev, ...updates }));
  }

  function updateAction(action: IsolationEventType) {
    setForm((prev) => ({
      ...prev,
      action,
      method: action === isolationEventTypes.alternativeIsolationUsed && prev.method === "rubberDam" ? "splitDam" : action === isolationEventTypes.rubberDamPlaced ? "rubberDam" : prev.method,
    }));
  }

  function resetForm(action: IsolationEventType = isolationEventTypes.rubberDamPlaced) {
    setForm(defaultIsolationFormState(tooth, action));
  }

  function prepareAction(action: IsolationEventType) {
    setForm(buildIsolationFormState(tooth, action, latestEvent));
  }

  function submitEvent() {
    const event = buildIsolationEventFromForm(form);
    onRecordEvent(event.eventType, event.details);
    resetForm();
  }

  function saveShortcuts() {
    if (!canSaveShortcuts) return;
    onSaveCatalogItems?.(shortcutItems);
  }

  return (
    <>
      {isolationIsEstablished ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            aria-label="Prepare compromised isolation event"
            onClick={() => prepareAction(isolationEventTypes.compromised)}
            className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-100"
          >
            Compromised
          </button>
          <button
            type="button"
            aria-label="Prepare removed isolation event"
            onClick={() => prepareAction(isolationEventTypes.removed)}
            className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-50"
          >
            Removed
          </button>
          <button
            type="button"
            aria-label="Prepare replacement isolation event"
            onClick={() => prepareAction(isolationEventTypes.replaced)}
            className="rounded-xl border border-brand-blue-light bg-white px-3 py-2 text-sm font-semibold text-brand-navy transition hover:bg-brand-blue-light/20"
          >
            Replace isolation
          </button>
        </div>
      ) : null}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <SelectInput
          label="Isolation action"
          value={isolationActionLabels[form.action]}
          onChange={(value) => updateAction(isolationEventTypeFromLabel(value))}
          options={isolationActionOptions}
        />
        {showMethodField ? (
          <SelectInput
            label="Method"
            value={form.method}
            onChange={(value) => updateForm({ method: value as IsolationMethod })}
            options={methodOptions}
          />
        ) : null}
        {showMethodLabelField ? (
          <TextInput label="Method label" value={form.methodLabel} onChange={(value) => updateForm({ methodLabel: value })} placeholder="optional display text" suggestions={isolationMethodLabelSuggestions} />
        ) : null}
        <SelectInput
          label="Region"
          value={form.regionKind}
          onChange={(value) => updateForm({ regionKind: value as IsolationRegionKind })}
          options={isolationRegionOptions}
        />
        <TextInput label="Region label" value={form.regionLabel} onChange={(value) => updateForm({ regionLabel: value })} placeholder="e.g., Q3, upper anterior, custom" suggestions={isolationRegionLabelSuggestions} />
        <TextInput label="Exposed teeth" value={form.exposedTeeth} onChange={(value) => updateForm({ exposedTeeth: value })} placeholder="e.g., 34 35 36 37" />
        {showClampFields ? (
          <>
            <TextInput label="Clamp tooth" value={form.clampTooth} onChange={(value) => updateForm({ clampTooth: value })} placeholder="e.g., 37" />
            <TextInput label="Clamp code" value={form.clampCode} onChange={(value) => updateForm({ clampCode: value })} placeholder="e.g., W8A" suggestions={isolationClampCodeSuggestions} />
          </>
        ) : null}
        {showMethodLabelField ? (
          <>
            <TextInput label="Support type" value={form.supportLabel} onChange={(value) => updateForm({ supportLabel: value })} placeholder="optional" suggestions={isolationSupportTypeSuggestions} />
            <TextInput label="Support tooth" value={form.supportTooth} onChange={(value) => updateForm({ supportTooth: value })} placeholder="optional" />
            <TextInput label="Support note" value={form.supportNote} onChange={(value) => updateForm({ supportNote: value })} placeholder="optional" suggestions={isolationSupportPhraseSuggestions} />
          </>
        ) : null}
        <TextInput
          label={actionIsReassessment ? "Reason" : "Notes"}
          value={form.note}
          onChange={(value) => updateForm({ note: value })}
          placeholder={form.action === isolationEventTypes.compromised ? "e.g., saliva contamination" : "optional"}
          suggestions={actionIsReassessment ? isolationReasonSuggestions : isolationNoteSuggestions}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={submitEvent}
          className="rounded-xl border border-brand-navy bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-navy-deep"
        >
          {isolationSubmitLabels[form.action]}
        </button>
        {onSaveCatalogItems ? (
          <button
            type="button"
            onClick={saveShortcuts}
            disabled={!canSaveShortcuts}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${canSaveShortcuts ? "border-brand-blue-light bg-white text-brand-navy hover:bg-brand-light-slate" : "cursor-not-allowed border-brand-light-node bg-brand-light-slate text-brand-slate"}`}
          >
            Save shortcuts
          </button>
        ) : null}
        {onManageShortcuts ? (
          <button
            type="button"
            onClick={onManageShortcuts}
            className="rounded-xl border border-brand-light-node bg-white px-4 py-2 text-sm font-semibold text-brand-navy transition hover:bg-brand-light-slate"
          >
            Manage shortcuts
          </button>
        ) : null}
      </div>
    </>
  );
}
