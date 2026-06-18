import React from "react";
import type { ClinicalEvent, EmbeddedWorkflowLaunch, EndoCase, WorkflowDefinition } from "../types";
import type { AnesthesiaEventDetails, AnesthesiaEventType } from "../workflow/anesthesia";
import { sharedAnesthesiaWorkflow, sharedAnesthesiaWorkflowId } from "../workflow/anesthesia";
import type { IsolationEventDetails, IsolationEventType } from "../workflow/isolation";
import { sharedIsolationWorkflow, sharedIsolationWorkflowId } from "../workflow/isolation";
import { AnesthesiaWorkflowRunner } from "./AnesthesiaWorkflowRunner";
import { IsolationWorkflowRunner } from "./IsolationWorkflowRunner";

function getWorkflowForLaunch(launch: EmbeddedWorkflowLaunch): WorkflowDefinition | undefined {
  if (launch.workflowId === sharedIsolationWorkflowId) return sharedIsolationWorkflow;
  if (launch.workflowId === sharedAnesthesiaWorkflowId) return sharedAnesthesiaWorkflow;
  return undefined;
}

export function SharedWorkflowRunnerModal({
  launch,
  caseData,
  parentNodeTitle,
  parentWorkflowRunId,
  latestAnesthesiaEvent,
  latestIsolationEvent,
  onClose,
  onRecordAnesthesiaEvent,
  onRecordIsolationEvent,
}: {
  launch: EmbeddedWorkflowLaunch;
  caseData: EndoCase;
  parentNodeTitle: string;
  parentWorkflowRunId: string;
  latestAnesthesiaEvent?: ClinicalEvent;
  latestIsolationEvent?: ClinicalEvent;
  onClose: () => void;
  onRecordAnesthesiaEvent: (
    eventType: AnesthesiaEventType,
    details: AnesthesiaEventDetails,
    context: { nodeId: string; label: string; workflowRunId: string; parentWorkflowRunId: string }
  ) => void;
  onRecordIsolationEvent: (
    eventType: IsolationEventType,
    details: IsolationEventDetails,
    context: { nodeId: string; label: string; workflowRunId: string; parentWorkflowRunId: string }
  ) => void;
}) {
  const workflow = getWorkflowForLaunch(launch);

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-auto bg-brand-navy-deep/40 p-4">
      <section className="mt-6 w-full max-w-3xl rounded-3xl border border-brand-light-node bg-white p-5 shadow-2xl">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-slate">Embedded workflow</p>
            <h2 className="mt-1 text-2xl font-bold text-brand-navy">{workflow?.title || "Shared workflow"}</h2>
            <p className="mt-1 text-sm text-brand-slate">Parent step: <strong>{parentNodeTitle}</strong></p>
          </div>
          <button onClick={onClose} className="rounded-xl border border-brand-light-node bg-brand-light-slate px-4 py-2 text-sm font-semibold text-brand-slate hover:bg-brand-light-node">
            Return
          </button>
        </div>

        {launch.workflowId === sharedIsolationWorkflowId ? (
          <IsolationWorkflowRunner
            launch={launch}
            caseData={caseData}
            parentWorkflowRunId={parentWorkflowRunId}
            latestIsolationEvent={latestIsolationEvent}
            onClose={onClose}
            onRecordIsolationEvent={onRecordIsolationEvent}
          />
        ) : launch.workflowId === sharedAnesthesiaWorkflowId ? (
          <AnesthesiaWorkflowRunner
            launch={launch}
            caseData={caseData}
            parentWorkflowRunId={parentWorkflowRunId}
            latestAnesthesiaEvent={latestAnesthesiaEvent}
            onClose={onClose}
            onRecordAnesthesiaEvent={onRecordAnesthesiaEvent}
          />
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            This shared workflow is not available in the embedded runner yet.
          </div>
        )}
      </section>
    </div>
  );
}
