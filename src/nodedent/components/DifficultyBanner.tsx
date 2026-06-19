import React from "react";
import type { CanalRecord, EndoCase } from "../types";
import { difficultyLabels, difficultyStyles } from "../engine/deriveCaseStatus";
import { getCanalStatus, statusLabels } from "../engine/deriveCanalStatus";

export function DifficultyBanner({
  caseData,
  currentPhase,
  activeCanal,
  onOpenPhaseMap,
}: {
  caseData: EndoCase;
  currentPhase: string;
  activeCanal?: CanalRecord | null;
  onOpenPhaseMap: () => void;
}) {
  const activeCanalStatus = getCanalStatus(activeCanal);

  return (
    <div className={`rounded-2xl border p-4 text-sm shadow-sm ${difficultyStyles[caseData.difficulty]}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
          <strong>{difficultyLabels[caseData.difficulty]}</strong>
          <span>Current phase: <strong>{currentPhase}</strong> · Active canal: <strong>{activeCanal?.name}</strong> · Status: <strong>{statusLabels[activeCanalStatus]}</strong></span>
        </div>
        <button
          type="button"
          onClick={onOpenPhaseMap}
          className="shrink-0 rounded-full border border-brand-navy bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-navy-deep"
        >
          Phase / canal map
        </button>
      </div>
    </div>
  );
}
