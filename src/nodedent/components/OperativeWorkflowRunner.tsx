import React, { useEffect, useState } from "react";
import type { CaseSetupFocusTarget, ClinicalEvent, EndoCase } from "../types";
import type { CaseCapabilitySummary } from "../workflow/selectors";
import {
  getOperativeRestorationRecordFromEvent,
  operativeDirectRestorationWorkflow,
  type OperativeWorkflowSetupState,
} from "../workflow/operative";
import { panelActionButton } from "./uiStyles";
import { TextInput } from "./FormControls";
import { getSharedReadinessActions } from "./SharedReadinessCard";
import { OperativeWorkflowSetupPanel } from "./OperativeWorkflowSetupPanel";

function readinessLabel(satisfied: boolean, needsReassessment: boolean) {
  if (needsReassessment) return "Review";
  return satisfied ? "Ready" : "Pending";
}

function readinessClass(satisfied: boolean, needsReassessment: boolean) {
  if (needsReassessment) return "border-amber-200 bg-amber-50 text-amber-900";
  if (satisfied) return "border-brand-mint/40 bg-brand-mint/10 text-brand-navy";
  return "border-brand-light-node bg-white text-brand-slate";
}

function hasSetupScope(setup: OperativeWorkflowSetupState, fallbackTooth: string) {
  return Boolean((setup.tooth || fallbackTooth).trim() && setup.surfaces.trim());
}

function stepState(stepIndex: number, activeIndex: number) {
  if (stepIndex < activeIndex) return "Complete";
  if (stepIndex === activeIndex) return "Current";
  return "Pending";
}

export function OperativeWorkflowRunner({
  caseData,
  setup,
  capabilitySummary,
  latestRestorationEvent,
  onSetupChange,
  onRecordRestoration,
  onOpenCaseSetupStatus,
  onOpenAnesthesiaWorkflow,
  onOpenIsolationWorkflow,
}: {
  caseData: EndoCase;
  setup: OperativeWorkflowSetupState;
  capabilitySummary: CaseCapabilitySummary;
  latestRestorationEvent?: ClinicalEvent;
  onSetupChange: (updates: Partial<OperativeWorkflowSetupState>) => void;
  onRecordRestoration: (record: { outcome: string; notes: string }) => void;
  onOpenCaseSetupStatus: (focusTarget?: CaseSetupFocusTarget) => void;
  onOpenAnesthesiaWorkflow: (entryNodeId?: string) => void;
  onOpenIsolationWorkflow: (entryNodeId?: string) => void;
}) {
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [validation, setValidation] = useState("");
  const setupReady = hasSetupScope(setup, caseData.tooth);
  const completionRecord = getOperativeRestorationRecordFromEvent(latestRestorationEvent);
  const completed = Boolean(latestRestorationEvent);
  const activeStepIndex = completed ? 3 : setupReady ? 2 : 1;
  const readinessActions = getSharedReadinessActions({
    capabilitySummary,
    onOpenCaseSetupStatus,
    onOpenAnesthesiaWorkflow,
    onOpenIsolationWorkflow,
  });
  const nodeSequence = [
    operativeDirectRestorationWorkflow.nodes["operative-readiness"],
    operativeDirectRestorationWorkflow.nodes["operative-surface-scope"],
    operativeDirectRestorationWorkflow.nodes["operative-restoration-record"],
    operativeDirectRestorationWorkflow.nodes["operative-restoration-complete"],
  ];

  useEffect(() => {
    if (!latestRestorationEvent) return;
    setOutcome(completionRecord.outcome);
    setNotes(completionRecord.notes);
  }, [completionRecord.notes, completionRecord.outcome, latestRestorationEvent]);

  function recordRestoration() {
    if (!setupReady) {
      setValidation("Record the planned tooth and surfaces before recording the restoration.");
      return;
    }
    if (!outcome.trim()) {
      setValidation("Record a restoration outcome before completing the operative workflow.");
      return;
    }
    onRecordRestoration({ outcome, notes });
    setValidation("");
  }

  return (
    <section className="order-2 min-w-0 lg:col-start-2 lg:row-start-1 xl:col-start-2 xl:row-start-1">
      <div className="space-y-4">
        <div className="rounded-2xl border border-brand-light-node bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-slate">Operative workflow</p>
              <h2 className="mt-1 text-xl font-bold text-brand-navy">Direct restoration</h2>
              <p className="mt-2 text-sm leading-6 text-brand-slate">
                Record operative scope, review shared readiness context, and document the final restoration event for the planned surfaces.
              </p>
            </div>
            <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${completed ? "border-brand-mint/40 bg-brand-mint/10 text-brand-navy" : "border-brand-light-node bg-brand-light-slate text-brand-slate"}`}>
              {completed ? "Complete" : "In progress"}
            </span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {nodeSequence.map((node, index) => (
              <div key={node.id} className={`rounded-xl border px-3 py-2 ${index <= activeStepIndex ? "border-brand-mint/40 bg-brand-mint/10 text-brand-navy" : "border-brand-light-node bg-brand-light-slate text-brand-slate"}`}>
                <p className="text-[11px] font-bold uppercase tracking-wide">{stepState(index, activeStepIndex)}</p>
                <p className="mt-1 text-sm font-semibold">{node.title}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-brand-light-node bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-brand-navy">Shared readiness</h3>
              <p className="mt-1 text-xs leading-5 text-brand-slate">Status is shown for the planned operative target and remains clinician-reviewed context.</p>
            </div>
            <button type="button" onClick={() => onOpenCaseSetupStatus()} className={panelActionButton.secondaryMuted}>
              Case Setup
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {readinessActions.map(({ label, status, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                className={`rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${readinessClass(status.satisfied, status.needsReassessment)}`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold">
                    {readinessLabel(status.satisfied, status.needsReassessment)}
                  </span>
                </span>
                <span className="mt-1 block text-xs leading-5 opacity-85">{status.summary}</span>
              </button>
            ))}
          </div>
        </div>

        <OperativeWorkflowSetupPanel caseData={caseData} setup={setup} onSetupChange={onSetupChange} />

        <div className="rounded-2xl border border-brand-light-node bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-brand-navy">Restoration record</h3>
          <div className="mt-3 grid gap-3">
            <TextInput label="Restoration outcome" value={outcome} onChange={setOutcome} placeholder="e.g., placed" />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-brand-slate">Notes</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-brand-light-node bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20"
                placeholder="optional"
              />
            </label>
          </div>
          {validation ? (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-950">{validation}</p>
          ) : null}
          <button type="button" onClick={recordRestoration} className={`${panelActionButton.primary} mt-3`}>
            Record final restoration
          </button>
        </div>

        {completed ? (
          <div className="rounded-2xl border border-brand-mint/40 bg-brand-mint/10 p-4 text-sm leading-6 text-brand-navy shadow-sm">
            <h3 className="text-sm font-semibold">Operative workflow complete</h3>
            <p className="mt-1">
              Final restoration recorded for tooth {completionRecord.tooth || "not set"}
              {completionRecord.surfaces ? `, surfaces ${completionRecord.surfaces}` : ""}.
            </p>
            {completionRecord.outcome ? <p className="mt-1">Outcome: {completionRecord.outcome}</p> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
