import React, { useState } from "react";
import type { ClinicalEvent, EmbeddedWorkflowLaunch, EndoCase } from "../types";
import type { AnesthesiaEventDetails, AnesthesiaEventType } from "../workflow/anesthesia";
import { anesthesiaEventTypes, sharedAnesthesiaWorkflow } from "../workflow/anesthesia";
import type { AnesthesiaEventOptions } from "../workflow/anesthesiaForm";
import { getAnesthesiaEventLabel } from "../workflow/anesthesiaForm";
import type { CatalogItem } from "../workflow/catalogs";
import { AnesthesiaEventForm } from "./AnesthesiaEventForm";

function getNextAnesthesiaNodeId(eventType: AnesthesiaEventType) {
  if (eventType === anesthesiaEventTypes.adequacyConfirmed) return "anesthesia-complete";
  if (eventType === anesthesiaEventTypes.needsReassessment) return "anesthesia-needs-reassessment";
  return "anesthesia-record";
}

export function AnesthesiaWorkflowRunner({
  launch,
  caseData,
  parentWorkflowRunId,
  latestAnesthesiaEvent,
  userCatalogItems = [],
  onUserCatalogItemsChange,
  onClose,
  onRecordAnesthesiaEvent,
}: {
  launch: EmbeddedWorkflowLaunch;
  caseData: EndoCase;
  parentWorkflowRunId: string;
  latestAnesthesiaEvent?: ClinicalEvent;
  userCatalogItems?: CatalogItem[];
  onUserCatalogItemsChange?: (items: CatalogItem[]) => void;
  onClose: () => void;
  onRecordAnesthesiaEvent: (
    eventType: AnesthesiaEventType,
    details: AnesthesiaEventDetails,
    context: { nodeId: string; label: string; workflowRunId: string; parentWorkflowRunId: string } & AnesthesiaEventOptions
  ) => void;
}) {
  const workflow = sharedAnesthesiaWorkflow;
  const [moduleNodeId, setModuleNodeId] = useState(launch.entryNodeId || workflow.entryNodeIds[0]);
  const [recordedLabel, setRecordedLabel] = useState("");
  const currentNode = workflow.nodes[moduleNodeId] || workflow.nodes[workflow.entryNodeIds[0]];
  const completion = workflow.completionNodeIds.includes(currentNode.id);
  const defaultAction = currentNode.id === "anesthesia-needs-reassessment" ? anesthesiaEventTypes.topUpGiven : anesthesiaEventTypes.administered;
  const targetTooth = launch.targetTooth || caseData.tooth;

  function recordEvent(eventType: AnesthesiaEventType, details: AnesthesiaEventDetails, options?: AnesthesiaEventOptions) {
    const label = getAnesthesiaEventLabel(eventType);
    onRecordAnesthesiaEvent(eventType, details, {
      nodeId: currentNode.id,
      label,
      workflowRunId: launch.workflowRunId,
      parentWorkflowRunId,
      expiresAt: options?.expiresAt,
    });
    setRecordedLabel(label);
    setModuleNodeId(getNextAnesthesiaNodeId(eventType));
  }

  function saveCatalogItems(items: CatalogItem[]) {
    if (!onUserCatalogItemsChange) return;
    const nextItems = items.reduce((current, item) => {
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

      {recordedLabel ? (
        <div className="mt-4 rounded-2xl border border-brand-mint/40 bg-brand-mint/10 p-4 text-sm leading-6 text-brand-navy">
          <strong>{recordedLabel}</strong> was appended to the current visit. The parent workflow remains at its current step.
        </div>
      ) : null}

      {!completion ? (
        <div className="mt-4 rounded-2xl border border-brand-light-node bg-brand-light-slate p-4">
          <AnesthesiaEventForm
            key={moduleNodeId}
            tooth={targetTooth}
            latestEvent={latestAnesthesiaEvent}
            defaultAction={defaultAction}
            userCatalogItems={userCatalogItems}
            onSaveCatalogItems={onUserCatalogItemsChange ? saveCatalogItems : undefined}
            onRecordEvent={recordEvent}
          />
        </div>
      ) : null}

      <div className="mt-4 flex flex-col items-stretch gap-2 sm:items-start">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl border border-brand-navy bg-brand-navy px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-navy-deep sm:w-auto"
        >
          Close shared workflow
        </button>
      </div>
    </>
  );
}
