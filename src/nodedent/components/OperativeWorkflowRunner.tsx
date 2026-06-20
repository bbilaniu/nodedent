import React, { useEffect, useState } from "react";
import type { ClinicalEvent, EndoCase } from "../types";
import {
  getOperativeRestorationRecordFromEvent,
  operativeDirectRestorationWorkflow,
  type OperativeWorkflowSetupState,
} from "../workflow/operative";
import { cx, panelActionButton, panelSurface, sectionText } from "./uiStyles";
import { TextInput } from "./FormControls";
import { OperativeWorkflowSetupPanel } from "./OperativeWorkflowSetupPanel";

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
  latestRestorationEvent,
  onSetupChange,
  onRecordRestoration,
}: {
  caseData: EndoCase;
  setup: OperativeWorkflowSetupState;
  latestRestorationEvent?: ClinicalEvent;
  onSetupChange: (updates: Partial<OperativeWorkflowSetupState>) => void;
  onRecordRestoration: (record: { outcome: string; notes: string }) => void;
}) {
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [validation, setValidation] = useState("");
  const setupReady = hasSetupScope(setup, caseData.tooth);
  const completionRecord = getOperativeRestorationRecordFromEvent(latestRestorationEvent);
  const completed = Boolean(latestRestorationEvent);
  const activeStepIndex = completed ? 3 : setupReady ? 2 : 1;
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
        <div className={panelSurface.cardPaddedLarge}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className={sectionText.eyebrow}>Operative workflow</p>
              <h2 className="mt-1 text-xl font-bold text-brand-navy">Direct restoration</h2>
              <p className={sectionText.description}>
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

        <OperativeWorkflowSetupPanel caseData={caseData} setup={setup} onSetupChange={onSetupChange} />

        <div className={panelSurface.cardPadded}>
          <h3 className={sectionText.titleSmall}>Restoration record</h3>
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
          <div className={cx(panelSurface.success, "text-sm leading-6 text-brand-navy")}>
            <h3 className={sectionText.titleSmall}>Operative workflow complete</h3>
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
