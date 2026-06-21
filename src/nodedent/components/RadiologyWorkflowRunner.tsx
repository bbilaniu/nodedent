import React, { useState } from "react";
import type { ClinicalEvent, EmbeddedWorkflowLaunch, EndoCase } from "../types";
import type { RadiologyEventDetails } from "../workflow/radiology";
import { formatRadiologyEventFragment, radiologyEventTypes, sharedRadiologyWorkflow } from "../workflow/radiology";
import { RadiologyEventForm } from "./RadiologyEventForm";

export function RadiologyWorkflowRunner({
  launch,
  caseData,
  parentWorkflowRunId,
  latestRadiologyEvent,
  onClose,
  onRecordRadiologyEvent,
}: {
  launch: EmbeddedWorkflowLaunch;
  caseData: EndoCase;
  parentWorkflowRunId: string;
  latestRadiologyEvent?: ClinicalEvent;
  onClose: () => void;
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

      {latestRadiologyEvent ? (
        <div className="mt-4 rounded-2xl border border-brand-mint/40 bg-brand-mint/10 p-4 text-sm leading-6 text-brand-navy">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-slate">Latest radiology event</p>
          <p className="mt-1 font-semibold">{formatRadiologyEventFragment(latestRadiologyEvent)}</p>
        </div>
      ) : null}

      {recordedLabel ? (
        <div className="mt-4 rounded-2xl border border-brand-mint/40 bg-brand-mint/10 p-4 text-sm leading-6 text-brand-navy">
          <strong>{recordedLabel}</strong> was appended to the current visit. The parent workflow remains at its current step.
        </div>
      ) : null}

      {!completion ? (
        <div className="mt-4 rounded-2xl border border-brand-light-node bg-brand-light-slate p-4">
          <RadiologyEventForm key={moduleNodeId} tooth={targetTooth} onRecordEvent={recordEvent} />
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
