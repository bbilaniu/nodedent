import React, { useEffect, useState } from "react";
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
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const activeCanalName = caseData.currentCanal || caseData.canals[0]?.name || "active canal";

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
      <div className="grid gap-2">
        <details
          open={isAddOpen}
          onToggle={(event) => setIsAddOpen(event.currentTarget.open)}
          className="rounded-xl border border-slate-200 bg-slate-50 p-3"
        >
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">Add new canal</summary>
          <div className="mt-3 grid gap-2">
            <input
              value={newCanalName}
              onChange={(event) => onNewCanalNameChange(event.target.value)}
              className="min-w-0 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              placeholder="blank = New"
            />
            <button onClick={addCanalAndCollapse} className="w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Add new canal</button>
          </div>
        </details>

        <details
          open={isEditOpen}
          onToggle={(event) => setIsEditOpen(event.currentTarget.open)}
          className="rounded-xl border border-slate-200 bg-slate-50 p-3"
        >
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">Edit active canal</summary>
          <div className="mt-3 grid gap-2">
            <input
              value={renameCanalName}
              onChange={(event) => onRenameCanalNameChange(event.target.value)}
              className="min-w-0 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              placeholder="e.g., B, L, P"
            />
            <button onClick={renameActiveCanalAndCollapse} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Rename active canal</button>
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
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
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
      </div>
    </SectionCard>
  );
}
