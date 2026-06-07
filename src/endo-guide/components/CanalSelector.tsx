import React from "react";
import type { EndoCase } from "../types";
import { getCanalStatus, statusLabels, statusStyles } from "../engine/deriveCanalStatus";
import { formatCanalMeasurements } from "../engine/measurements";
import { SectionCard } from "./FormControls";

export function CanalSelector({
  caseData,
  newCanalName,
  renameCanalName,
  onNewCanalNameChange,
  onRenameCanalNameChange,
  onSelectCanal,
  onAddCanal,
  onRenameActiveCanal,
  onDeleteActiveCanal,
  className = "",
}: {
  caseData: EndoCase;
  newCanalName: string;
  renameCanalName: string;
  onNewCanalNameChange: (value: string) => void;
  onRenameCanalNameChange: (value: string) => void;
  onSelectCanal: (canalName: string) => void;
  onAddCanal: () => void;
  onRenameActiveCanal: () => void;
  onDeleteActiveCanal: () => void;
  className?: string;
}) {
  return (
    <SectionCard title="Canal selector" className={className}>
      <div className="mb-3 grid gap-2">
        {caseData.canals.map((canal) => {
          const status = getCanalStatus(canal);
          return (
            <button
              key={canal.name}
              onClick={() => onSelectCanal(canal.name)}
              className={`rounded-xl border p-3 text-left text-sm transition hover:-translate-y-0.5 hover:shadow-sm ${canal.name === caseData.currentCanal ? "border-slate-900 bg-slate-900 text-white shadow-sm" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
            >
              <span className="flex items-center justify-between gap-2">
                <strong>{canal.name}</strong>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${canal.name === caseData.currentCanal ? "border-white/30 bg-white/10 text-white" : statusStyles[status]}`}>{statusLabels[status]}</span>
              </span>
              <span className="mt-1 block text-xs opacity-75">{formatCanalMeasurements(canal) || "No measurements yet"}</span>
            </button>
          );
        })}
      </div>
      <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Add / rename canals</summary>
        <div className="mt-3 grid gap-3">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Add canal</p>
            <div className="grid gap-2">
              <input value={newCanalName} onChange={(event) => onNewCanalNameChange(event.target.value)} className="min-w-0 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400" placeholder="blank = New" />
              <button onClick={onAddCanal} className="w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Add</button>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Rename active canal</p>
            <div className="grid gap-2">
              <input value={renameCanalName} onChange={(event) => onRenameCanalNameChange(event.target.value)} className="min-w-0 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400" placeholder="e.g., B, L, P" />
              <button onClick={onRenameActiveCanal} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Rename</button>
            </div>
            <button onClick={onDeleteActiveCanal} className="mt-2 w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100">Delete active canal</button>
          </div>
        </div>
      </details>
    </SectionCard>
  );
}
