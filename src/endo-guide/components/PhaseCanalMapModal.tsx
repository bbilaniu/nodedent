import React from "react";
import type { EndoCase } from "../types";
import { getCanalStatus, statusLabels } from "../engine/deriveCanalStatus";
import { formatCanalMeasurements } from "../engine/measurements";
import { getCanalPhaseIndicator, getGlobalPhaseIndicator } from "../engine/phaseProgress";
import { phases } from "../protocol/phases";

export function PhaseCanalMapModal({
  caseData,
  currentPhase,
  progressPhase,
  onSelectProgressPhase,
  onSelectCanal,
  onClose,
}: {
  caseData: EndoCase;
  currentPhase: string;
  progressPhase: string;
  onSelectProgressPhase: (phase: string) => void;
  onSelectCanal: (canalName: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-brand-navy-deep/30 p-4">
      <button aria-label="Close phase details" onClick={onClose} className="absolute inset-0" />
      <section className="relative mt-6 w-full max-w-3xl rounded-3xl border border-brand-light-node bg-white p-5 shadow-2xl">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-slate">Phase / canal map</p>
            <h2 className="mt-1 text-2xl font-bold text-brand-navy">{progressPhase}</h2>
            <p className="mt-1 text-sm text-brand-slate">Inspect phase progress by canal. Selecting a canal changes the active canal, but does not advance the workflow.</p>
          </div>
          <button onClick={onClose} className="rounded-xl border border-brand-light-node bg-brand-light-slate px-4 py-2 text-sm font-semibold text-brand-slate hover:bg-brand-light-node">
            Close
          </button>
        </div>

        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-5">
          {phases.map((phase, idx) => {
            const indicator = getGlobalPhaseIndicator(caseData, phase, currentPhase);
            const isSelected = phase === progressPhase;
            return (
              <button
                key={phase}
                onClick={() => onSelectProgressPhase(phase)}
                className={`flex items-center gap-2 rounded-2xl border p-2 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${isSelected ? "border-brand-navy bg-brand-navy text-white" : "border-brand-light-node bg-white hover:bg-brand-light-slate"}`}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isSelected ? "bg-white text-brand-navy" : indicator.className}`}>{idx + 1}</span>
                <span className={`min-w-0 truncate text-sm ${isSelected ? "font-semibold text-white" : indicator.textClassName}`}>{phase}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-2xl border border-brand-light-node bg-brand-light-slate p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-brand-slate">Selected phase</p>
              <h3 className="text-lg font-bold text-brand-navy">{progressPhase}</h3>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-brand-slate">
              <span className="rounded-full border border-brand-navy bg-brand-navy px-2 py-1 text-white">● Current</span>
              <span className="rounded-full border border-brand-mint/50 bg-brand-mint/15 px-2 py-1 text-brand-navy">✓ Recorded</span>
              <span className="rounded-full border border-brand-light-node bg-white px-2 py-1 text-brand-slate">· Not recorded</span>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {caseData.canals.map((canal) => {
              const indicator = getCanalPhaseIndicator(caseData, canal.name, progressPhase, currentPhase, caseData.currentCanal);
              return (
                <button
                  key={`${progressPhase}-${canal.name}`}
                  onClick={() => onSelectCanal(canal.name)}
                  className={`rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${indicator.className}`}
                  title={`${canal.name} · ${progressPhase}: ${indicator.label}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong>{canal.name}</strong>
                    <span className="text-lg font-black">{indicator.symbol}</span>
                  </div>
                  <div className="mt-1 text-xs opacity-80">{statusLabels[getCanalStatus(canal)]}</div>
                  <div className="mt-2 text-[11px] leading-4 opacity-75">{formatCanalMeasurements(canal) || "No measurements yet"}</div>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
