import React, { useEffect, useState } from "react";
import type { DifficultyFlag } from "../types";
import { panelActionButton } from "./uiStyles";

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

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-auto bg-brand-navy-deep/40 p-4">
      <button type="button" aria-label="Cancel pause or end visit" onClick={onClose} className="absolute inset-0" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="end-visit-title"
        className="relative mt-6 w-full max-w-2xl rounded-3xl border border-brand-light-node bg-white p-5 shadow-2xl"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-slate">Chairside stop action</p>
            <h2 id="end-visit-title" className="mt-1 text-2xl font-bold text-brand-navy">Pause or end this visit</h2>
            <p className="mt-1 text-sm leading-6 text-brand-slate">
              Active canal <strong>{activeCanalName}</strong> · {currentPhase} · {currentNodeTitle}
            </p>
          </div>
          <button type="button" onClick={onClose} className={panelActionButton.secondaryMuted}>Cancel</button>
        </div>

        <div className="mt-4 rounded-2xl border border-brand-blue-light/60 bg-brand-blue-light/20 p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-brand-navy">Next-visit plan</span>
            <textarea
              value={nextVisitPlan}
              onChange={(event) => setNextVisitPlan(event.target.value)}
              placeholder="Required when pausing or entering the medication / temporary closure pathway"
              rows={3}
              className="w-full rounded-xl border border-brand-light-node bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3">
          <button
            type="button"
            disabled={!trimmedPlan}
            onClick={() => onSelectAction("pause", trimmedPlan)}
            className={`${panelActionButton.primary} p-4 text-left disabled:cursor-not-allowed disabled:opacity-45`}
          >
            <span className="block">Pause here and continue later</span>
            <span className="mt-1 block text-xs font-normal opacity-80">Records the pause at the current step without advancing the workflow.</span>
          </button>
          <button
            type="button"
            disabled={!trimmedPlan}
            onClick={() => onSelectAction("medicate", trimmedPlan)}
            className={`${panelActionButton.warning} p-4 text-left disabled:cursor-not-allowed disabled:opacity-45`}
          >
            <span className="block">Continue to medication / temporary closure</span>
            <span className="mt-1 block text-xs font-normal opacity-80">Opens the existing protocol steps so medication and closure are documented when performed.</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectAction("refer", trimmedPlan)}
            className={`${panelActionButton.danger} p-4 text-left`}
          >
            <span className="block">Open referral / stop pathway</span>
            <span className="mt-1 block text-xs font-normal opacity-80">Continues to referral documentation and the decision about medication and temporary closure.</span>
          </button>
        </div>
      </section>
    </div>
  );
}
