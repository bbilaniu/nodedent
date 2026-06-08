import React from "react";
import type { CanalRecord, DifficultyFlag } from "../types";
import { getCanalStatus, statusLabels, statusStyles } from "../engine/deriveCanalStatus";
import { SectionCard } from "./FormControls";

export function CanalControls({
  activeCanal,
  onManualEvent,
  onResetManualStatus,
  className = "",
}: {
  activeCanal?: CanalRecord | null;
  onManualEvent: (type: string, label: string, nextNodeId?: string | null, difficultyFlag?: DifficultyFlag | null) => void;
  onResetManualStatus: () => void;
  className?: string;
}) {
  const status = getCanalStatus(activeCanal);

  return (
    <SectionCard title="Canal status" className={className}>
      <div className="grid gap-2 text-sm">
        <div className={`rounded-xl border px-3 py-2 text-xs font-semibold ${statusStyles[status]}`}>{activeCanal?.name || "Canal"}: {statusLabels[status]}</div>
        <button onClick={() => onManualEvent("canal.completed", "Mark active canal complete", "endodontic-pathway-complete")} className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 font-semibold text-green-900 hover:bg-green-100">Mark active canal complete</button>
        <button onClick={() => onManualEvent("canal.paused", "Pause active canal", "endodontic-pathway-complete")} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100">Pause active canal</button>
        <button onClick={() => onManualEvent("canal.medicated", "Mark active canal medicated", "temporary-closure", "high")} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 font-semibold text-amber-900 hover:bg-amber-100">Medicate active canal</button>
        <button onClick={() => onManualEvent("canal.referred", "Refer active canal", "refer-pathway", "refer")} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 font-semibold text-red-800 hover:bg-red-100">Refer active canal</button>
        <button onClick={onResetManualStatus} className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-800 hover:bg-slate-50">Return to automatic status</button>
      </div>
    </SectionCard>
  );
}
