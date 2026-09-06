import React, { useState } from "react";
import type { DifficultyFlag } from "../types";
import { semanticActionButton, semanticFormControl } from "./uiStyles";
import { AccessibleDialog } from "./AccessibleDialog";

export type EndVisitActionId = "pause" | "medicate" | "refer";

export const endVisitActionConfig: Record<EndVisitActionId, {
  eventType: string;
  nextNodeId: string | null;
  difficultyFlag: DifficultyFlag | null;
  requiresPlan: boolean;
}> = {
  pause: {
    eventType: "canal.paused",
    nextNodeId: null,
    difficultyFlag: null,
    requiresPlan: true,
  },
  medicate: {
    eventType: "treatment.medicateTemporizeSelected",
    nextNodeId: "calcium-hydroxide",
    difficultyFlag: null,
    requiresPlan: true,
  },
  refer: {
    eventType: "treatment.referralSelected",
    nextNodeId: "refer-pathway",
    difficultyFlag: "refer",
    requiresPlan: false,
  },
};

export function EndodonticEndVisitDialog({
  activeCanalName,
  currentNodeTitle,
  currentPhase,
  initialNextVisitPlan = "",
  onSelectAction,
  onClose,
}: {
  activeCanalName: string;
  currentNodeTitle: string;
  currentPhase: string;
  initialNextVisitPlan?: string;
  onSelectAction: (actionId: EndVisitActionId, nextVisitPlan: string) => void;
  onClose: () => void;
}) {
  const [nextVisitPlan, setNextVisitPlan] = useState(initialNextVisitPlan);
  const trimmedPlan = nextVisitPlan.trim();

  function requestClose() {
    if (nextVisitPlan !== initialNextVisitPlan && !window.confirm("Discard the unrecorded next-visit plan and close this dialog?")) return;
    onClose();
  }

  return (
    <AccessibleDialog
      labelledBy="end-visit-title"
      overlayVariant="raised"
      panelClassName="max-w-2xl"
      closeOnBackdrop
      onRequestClose={requestClose}
    >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-slate">Chairside stop action</p>
            <h2 id="end-visit-title" className="mt-1 text-2xl font-bold text-brand-navy">Pause or end this visit</h2>
            <p className="mt-1 text-sm leading-6 text-brand-slate">
              Active canal <strong>{activeCanalName}</strong> · {currentPhase} · {currentNodeTitle}
            </p>
          </div>
          <button type="button" data-dialog-initial-focus onClick={requestClose} className={semanticActionButton.secondary}>Cancel</button>
        </div>

        <div className="mt-4 rounded-2xl border border-brand-blue-light/60 bg-brand-blue-light/20 p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-brand-navy">Next-visit plan</span>
            <textarea
              value={nextVisitPlan}
              onChange={(event) => setNextVisitPlan(event.target.value)}
              placeholder="Required when pausing or entering the medication / temporary closure pathway"
              rows={3}
              className={semanticFormControl.default}
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3">
          <button
            type="button"
            disabled={!trimmedPlan}
            onClick={() => onSelectAction("pause", trimmedPlan)}
            className={semanticActionButton.primaryDecision}
          >
            <span className="block">Pause here and continue later</span>
            <span className="mt-1 block text-xs font-normal opacity-80">Records the pause at the current step without advancing the workflow.</span>
          </button>
          <button
            type="button"
            disabled={!trimmedPlan}
            onClick={() => onSelectAction("medicate", trimmedPlan)}
            className={semanticActionButton.warningDecision}
          >
            <span className="block">Continue to medication / temporary closure</span>
            <span className="mt-1 block text-xs font-normal opacity-80">Opens the existing protocol steps so medication and closure are documented when performed.</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectAction("refer", trimmedPlan)}
            className={semanticActionButton.warningDecision}
          >
            <span className="block">Open referral / stop pathway</span>
            <span className="mt-1 block text-xs font-normal opacity-80">Continues to referral documentation and the decision about medication and temporary closure.</span>
          </button>
        </div>
    </AccessibleDialog>
  );
}
