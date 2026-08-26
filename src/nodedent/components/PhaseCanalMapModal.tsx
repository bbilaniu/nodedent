import React from "react";
import type { EndoCase } from "../types";
import { getCanalStatus, statusLabels } from "../engine/deriveCanalStatus";
import { formatCanalMeasurements } from "../engine/measurements";
import { getCanalPhaseIndicator, getGlobalPhaseIndicator } from "../engine/phaseProgress";
import { phases } from "../protocol/phases";
import { cx, semanticActionButton, semanticChoiceControl, semanticChoiceSurfaceControl, semanticDialogSurface, semanticStatusTone, statusBadge } from "./uiStyles";

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
    <div className={semanticDialogSurface.overlay}>
      <button type="button" tabIndex={-1} aria-label="Close phase details" onClick={onClose} className={semanticDialogSurface.backdropButton} />
      <section role="dialog" aria-modal="true" aria-labelledby="phase-canal-map-title" className={cx(semanticDialogSurface.panel, "max-w-3xl")}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-slate">Phase / canal map</p>
            <h2 id="phase-canal-map-title" className="mt-1 text-2xl font-bold text-brand-navy">{progressPhase}</h2>
            <p className="mt-1 text-sm text-brand-slate">Inspect phase progress by canal. Selecting a canal changes the active canal, but does not advance the workflow.</p>
          </div>
          <button type="button" onClick={onClose} className={semanticActionButton.secondary}>
            Close
          </button>
        </div>

        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-5">
          {phases.map((phase, idx) => {
            const indicator = getGlobalPhaseIndicator(caseData, phase, currentPhase);
            const isSelected = phase === progressPhase;
            return (
              <button
                type="button"
                key={phase}
                aria-pressed={isSelected}
                onClick={() => onSelectProgressPhase(phase)}
                className={cx(isSelected ? semanticChoiceSurfaceControl.selected : semanticChoiceSurfaceControl.unselected, "flex items-center gap-2 p-2")}
              >
                <span aria-hidden="true" className={cx(semanticChoiceControl.indicator, isSelected ? semanticChoiceControl.indicatorSelected : semanticChoiceControl.indicatorUnselected)}>✓</span>
                <span className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold", indicator.className)}>{idx + 1}</span>
                <span className={cx("min-w-0 truncate text-sm", indicator.textClassName)}>{phase}</span>
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
              <span className={cx(statusBadge.base, semanticStatusTone.neutral)}>● Current phase</span>
              <span className={cx(statusBadge.base, semanticStatusTone.positive)}>✓ Recorded</span>
              <span className={cx(statusBadge.base, semanticStatusTone.neutral)}>· Not recorded</span>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {caseData.canals.map((canal) => {
              const indicator = getCanalPhaseIndicator(caseData, canal.name, progressPhase, currentPhase, caseData.currentCanal);
              const isSelected = canal.name === caseData.currentCanal;
              return (
                <button
                  type="button"
                  key={`${progressPhase}-${canal.name}`}
                  aria-pressed={isSelected}
                  onClick={() => onSelectCanal(canal.name)}
                  className={cx(isSelected ? semanticChoiceSurfaceControl.selected : semanticChoiceSurfaceControl.unselected, "rounded-2xl")}
                  title={`${canal.name} · ${progressPhase}: ${indicator.label}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true" className={cx(semanticChoiceControl.indicator, isSelected ? semanticChoiceControl.indicatorSelected : semanticChoiceControl.indicatorUnselected)}>✓</span>
                      <strong>{canal.name}</strong>
                    </span>
                    <span data-phase-status={indicator.label} className={cx("rounded-full border px-2 py-1 text-xs font-black", indicator.className)}>{indicator.symbol} <span className="sr-only">{indicator.label}</span></span>
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
