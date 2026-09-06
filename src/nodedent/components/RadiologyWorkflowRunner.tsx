import React, { useState } from "react";
import type { ClinicalEvent, EmbeddedWorkflowLaunch, EndoCase } from "../types";
import type { RadiologyEventDetails } from "../workflow/radiology";
import { formatRadiologyEventFragment, isRadiologyReviewedEvent, radiologyEventTypes, sharedRadiologyWorkflow } from "../workflow/radiology";
import { RadiologyEventForm } from "./RadiologyEventForm";
import { cx, semanticActionButton, semanticStatusSurface } from "./uiStyles";

export function RadiologyWorkflowRunner({
  launch,
  caseData,
  parentWorkflowRunId,
  latestRadiologyEvent,
  onRecordRadiologyEvent,
}: {
  launch: EmbeddedWorkflowLaunch;
  caseData: EndoCase;
  parentWorkflowRunId: string;
  latestRadiologyEvent?: ClinicalEvent;
  onRecordRadiologyEvent: (
    details: RadiologyEventDetails,
    context: { nodeId: string; label: string; workflowRunId: string; parentWorkflowRunId: string }
  ) => void;
}) {
  const workflow = sharedRadiologyWorkflow;
  const [moduleNodeId, setModuleNodeId] = useState(launch.entryNodeId || workflow.entryNodeIds[0]);
  const [recordedLabel, setRecordedLabel] = useState("");
  const currentNode = workflow.nodes[moduleNodeId] || workflow.nodes[workflow.entryNodeIds[0]];
  const completion = workflow.completionNodeIds.includes(currentNode.id);
  const targetTooth = launch.targetTooth || caseData.tooth;
  const radiologyEvents = (caseData.globalEvents || []).filter(isRadiologyReviewedEvent);

  function recordEvent(details: RadiologyEventDetails) {
    const option = currentNode.options.find((item) => item.noteEvent?.type === radiologyEventTypes.reviewed) || currentNode.options[0];
    const label = option?.label || "Radiograph review recorded";
    onRecordRadiologyEvent(details, {
      nodeId: currentNode.id,
      label,
      workflowRunId: launch.workflowRunId,
      parentWorkflowRunId,
    });
    setRecordedLabel(label);
    setModuleNodeId(option?.nextNodeId || workflow.completionNodeIds[0]);
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

      <div className="mt-4 rounded-2xl border border-brand-light-node bg-white p-4">
        <h4 className="text-sm font-bold text-brand-navy">Radiograph entries</h4>
        <p className="mt-1 text-xs leading-5 text-brand-slate">Each recorded radiograph review remains a separate event in the case record.</p>
        {radiologyEvents.length ? (
          <ol className="mt-3 grid gap-2">
            {radiologyEvents.map((event, index) => (
              <li key={event.id} className="rounded-xl border border-brand-light-node bg-brand-light-slate px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-brand-slate">Radiograph entry #{index + 1}</span>
                  <time dateTime={event.timestamp} className="text-xs text-brand-slate">{event.timestamp}</time>
                </div>
                <p className="mt-1 text-sm font-semibold leading-6 text-brand-navy">{formatRadiologyEventFragment(event)}</p>
              </li>
            ))}
          </ol>
        ) : latestRadiologyEvent ? (
          <p className="mt-3 rounded-xl border border-brand-light-node bg-brand-light-slate px-3 py-2 text-sm font-semibold leading-6 text-brand-navy">{formatRadiologyEventFragment(latestRadiologyEvent)}</p>
        ) : (
          <p className="mt-3 rounded-xl border border-brand-light-node bg-brand-light-slate px-3 py-2 text-sm text-brand-slate">No radiograph reviews recorded yet.</p>
        )}
      </div>

      {recordedLabel ? (
        <div role="status" className={cx(semanticStatusSurface.positive, "mt-4 p-4 text-sm leading-6")}>
          <strong>{recordedLabel}</strong> was appended to the current visit. The parent workflow remains at its current step.
        </div>
      ) : null}

      {!completion ? (
        <div className="mt-4 rounded-2xl border border-brand-light-node bg-brand-light-slate p-4">
          <RadiologyEventForm key={moduleNodeId} tooth={targetTooth} onRecordEvent={recordEvent} />
        </div>
      ) : null}

      {completion ? (
        <button
          type="button"
          onClick={() => {
            setRecordedLabel("");
            setModuleNodeId(workflow.entryNodeIds[0]);
          }}
          className={cx(semanticActionButton.secondary, "mt-4")}
        >
          Add another radiograph entry
        </button>
      ) : null}
    </>
  );
}
