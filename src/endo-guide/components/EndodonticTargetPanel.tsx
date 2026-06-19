import React, { useEffect, useState } from "react";
import type { DifficultyFlag, EndoCase } from "../types";
import { getCanalStatus, statusLabels, statusStyles } from "../engine/deriveCanalStatus";
import { formatCanalMeasurements } from "../engine/measurements";
import { SectionCard } from "./FormControls";

export function EndodonticTargetPanel({
  caseData,
  newCanalName,
  renameCanalName,
  onNewCanalNameChange,
  onRenameCanalNameChange,
  onSelectCanal,
  onAddCanal,
  onRenameActiveCanal,
  onDeleteActiveCanal,
  onManualEvent,
  onResetManualStatus,
  onOpenPhaseMap,
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
  onManualEvent: (type: string, label: string, nextNodeId?: string | null, difficultyFlag?: DifficultyFlag | null) => void;
  onResetManualStatus: () => void;
  onOpenPhaseMap: () => void;
  className?: string;
}) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const activeCanalName = caseData.currentCanal || caseData.canals[0]?.name || "active canal";
  const activeCanal = caseData.canals.find((canal) => canal.name === activeCanalName) || caseData.canals[0];
  const activeStatus = getCanalStatus(activeCanal);

  useEffect(() => {
    setIsDeleteConfirmOpen(false);
  }, [activeCanalName]);

  function confirmDeleteActiveCanal() {
    setIsDeleteConfirmOpen(false);
    setIsEditOpen(false);
    onDeleteActiveCanal();
  }

  function addCanalAndCollapse() {
    onAddCanal();
    setIsAddOpen(false);
  }

  function renameActiveCanalAndCollapse() {
    onRenameActiveCanal();
    setIsEditOpen(false);
  }

  function requestDeleteActiveCanal() {
    setIsDeleteConfirmOpen(true);
    setIsEditOpen(false);
  }

  return (
    <SectionCard title="Endodontic progress" className={className}>
      <p className="mb-3 rounded-xl border border-brand-light-node bg-brand-light-slate px-3 py-2 text-xs leading-5 text-brand-slate">
        Manage canals for the active endodontic workflow. Operative teeth and surfaces will use their own target panel.
      </p>
      <button
        type="button"
        onClick={onOpenPhaseMap}
        className="mb-3 w-full rounded-xl border border-brand-blue-light bg-white px-3 py-2 text-sm font-semibold text-brand-navy transition hover:bg-brand-blue-light/20"
      >
        Open phase/canal map
      </button>
      <div className="mb-3 grid gap-2">
        {caseData.canals.map((canal) => {
          const status = getCanalStatus(canal);
          return (
            <button
              key={canal.name}
              onClick={() => onSelectCanal(canal.name)}
              className={`rounded-xl border p-3 text-left text-sm transition hover:-translate-y-0.5 hover:shadow-sm ${canal.name === caseData.currentCanal ? "border-brand-navy bg-brand-navy text-white shadow-sm" : "border-brand-light-node bg-brand-light-slate text-brand-slate hover:bg-brand-light-node"}`}
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
      <div className="grid gap-2">
        <details
          open={isAddOpen}
          onToggle={(event) => setIsAddOpen(event.currentTarget.open)}
          className="rounded-xl border border-brand-light-node bg-brand-light-slate p-3"
        >
          <summary className="cursor-pointer text-sm font-semibold text-brand-navy">Add new canal</summary>
          <div className="mt-3 grid gap-2">
            <input
              value={newCanalName}
              onChange={(event) => onNewCanalNameChange(event.target.value)}
              className="min-w-0 w-full rounded-xl border border-brand-light-node px-3 py-2 text-sm outline-none focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20"
              placeholder="blank = New"
            />
            <button onClick={addCanalAndCollapse} className="w-full rounded-xl bg-brand-navy px-3 py-2 text-sm font-semibold text-white hover:bg-brand-navy-deep">Add new canal</button>
          </div>
        </details>

        <details
          open={isEditOpen}
          onToggle={(event) => setIsEditOpen(event.currentTarget.open)}
          className="rounded-xl border border-brand-light-node bg-brand-light-slate p-3"
        >
          <summary className="cursor-pointer text-sm font-semibold text-brand-navy">Edit active canal</summary>
          <div className="mt-3 grid gap-2">
            <input
              value={renameCanalName}
              onChange={(event) => onRenameCanalNameChange(event.target.value)}
              className="min-w-0 w-full rounded-xl border border-brand-light-node px-3 py-2 text-sm outline-none focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20"
              placeholder="e.g., B, L, P"
            />
            <button onClick={renameActiveCanalAndCollapse} className="w-full rounded-xl border border-brand-light-node bg-white px-3 py-2 text-sm font-semibold text-brand-slate hover:bg-brand-light-slate">Rename active canal</button>
            <button
              type="button"
              onClick={requestDeleteActiveCanal}
              className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"
            >
              Delete active canal
            </button>
          </div>
        </details>
        {isDeleteConfirmOpen ? (
          <div role="alertdialog" aria-label={`Confirm deletion of ${activeCanalName}`} className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-semibold text-red-900">Delete {activeCanalName}?</p>
            <p className="mt-1 text-xs leading-5 text-red-800">This removes the canal and its recorded events from this case.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="rounded-xl border border-brand-light-node bg-white px-3 py-2 text-sm font-semibold text-brand-slate hover:bg-brand-light-slate"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteActiveCanal}
                className="rounded-xl border border-red-700 bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800"
              >
                Confirm delete
              </button>
            </div>
          </div>
        ) : null}
        <div className="rounded-xl border border-brand-light-node bg-white p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-brand-navy">Active canal status</span>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusStyles[activeStatus]}`}>{activeCanal?.name || "Canal"}: {statusLabels[activeStatus]}</span>
          </div>
          <div className="grid gap-2 text-sm">
            <button onClick={() => onManualEvent("canal.completed", `Mark ${activeCanalName} complete`, "endodontic-pathway-complete")} className="rounded-xl border border-brand-mint/50 bg-brand-mint/15 px-3 py-2 font-semibold text-brand-navy hover:bg-brand-mint/25">Mark {activeCanalName} complete</button>
            <button onClick={() => onManualEvent("canal.paused", `Pause ${activeCanalName}`, "endodontic-pathway-complete")} className="rounded-xl border border-brand-light-node bg-brand-light-slate px-3 py-2 font-semibold text-brand-slate hover:bg-brand-light-node">Pause {activeCanalName}</button>
            <button onClick={() => onManualEvent("canal.medicated", `Medicate ${activeCanalName}`, "temporary-closure", "high")} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 font-semibold text-amber-900 hover:bg-amber-100">Medicate {activeCanalName}</button>
            <button onClick={() => onManualEvent("canal.referred", `Refer ${activeCanalName}`, "refer-pathway", "refer")} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 font-semibold text-red-800 hover:bg-red-100">Refer {activeCanalName}</button>
            <button onClick={onResetManualStatus} className="rounded-xl border border-brand-light-node bg-white px-3 py-2 font-semibold text-brand-navy hover:bg-brand-light-slate">Return {activeCanalName} to automatic status</button>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
