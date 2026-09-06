import React from "react";
import type { CanalRecord, EndoCase } from "../types";
import { difficultyLabels } from "../engine/deriveCaseStatus";
import { getCanalStatus, statusLabels } from "../engine/deriveCanalStatus";
import { cx, semanticActionButton, semanticStatusSurface, type StatusRole } from "./uiStyles";

const difficultyStatusRoles: Record<EndoCase["difficulty"], StatusRole> = {
  none: "positive",
  caution: "attention",
  high: "difficulty",
  refer: "danger",
};

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
    <div className={cx(semanticStatusSurface[difficultyStatusRoles[caseData.difficulty]], "p-4 text-sm shadow-sm")}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
          <strong>{difficultyLabels[caseData.difficulty]}</strong>
          <span>Current phase: <strong>{currentPhase}</strong> · Active canal: <strong>{activeCanal?.name}</strong> · Status: <strong>{statusLabels[activeCanalStatus]}</strong></span>
        </div>
        <button
          type="button"
          onClick={onOpenPhaseMap}
          className={cx(semanticActionButton.secondary, "shrink-0")}
        >
          Phase / canal map
        </button>
      </div>
    </div>
  );
}
