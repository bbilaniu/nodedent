import React, { useEffect, useState } from "react";
import type { ClinicalEvent, EndoCase } from "../types";
import {
  getOperativeRestorationRecordFromEvent,
  operativeDirectRestorationWorkflow,
  type OperativeWorkflowSetupState,
} from "../workflow/operative";
import { cx, panelSurface, sectionText, semanticActionButton, semanticFormControl, semanticStatusSurface, semanticStatusTone, statusBadge } from "./uiStyles";
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
  const outcomeMissing = Boolean(validation && !outcome.trim());
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
            <span className={cx(statusBadge.base, completed ? semanticStatusTone.positive : semanticStatusTone.neutral)}>
              {completed ? "Complete" : "In progress"}
            </span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {nodeSequence.map((node, index) => {
              const state = stepState(index, activeStepIndex);
              return <div key={node.id} className={cx("rounded-xl border px-3 py-2", state === "Complete" ? semanticStatusTone.positive : state === "Current" ? semanticStatusTone.attention : semanticStatusTone.neutral)}>
                <p className="text-[11px] font-bold uppercase tracking-wide">{state}</p>
                <p className="mt-1 text-sm font-semibold">{node.title}</p>
              </div>;
            })}
          </div>
        </div>

        <OperativeWorkflowSetupPanel caseData={caseData} setup={setup} onSetupChange={onSetupChange} />

        <div className={panelSurface.cardPadded}>
          <h3 className={sectionText.titleSmall}>Restoration record</h3>
          <div className="mt-3 grid gap-3">
            <TextInput
              id="operative-restoration-outcome"
              label="Restoration outcome"
              value={outcome}
              onChange={(value) => {
                setOutcome(value);
                if (value.trim()) setValidation("");
              }}
              placeholder="e.g., placed"
              invalid={outcomeMissing}
              helperText={outcomeMissing ? validation : undefined}
            />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-brand-slate">Notes</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                className={semanticFormControl.default}
                placeholder="optional"
              />
            </label>
          </div>
          {validation ? (
            <p role="alert" className={cx(semanticStatusSurface.danger, "mt-3 px-3 py-2 text-sm leading-6")}><a href="#operative-restoration-outcome" className="font-semibold underline underline-offset-2">Review restoration outcome</a>: {validation}</p>
          ) : null}
          <button type="button" onClick={recordRestoration} className={cx(semanticActionButton.primary, "mt-3")}>
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
