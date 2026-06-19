import React from "react";
import type { CaseSetupFocusTarget, EndoCase } from "../types";
import { getCaseCapabilitySummary } from "../workflow/selectors";
import { panelActionButton } from "./uiStyles";

function statusLabel(satisfied: boolean, needsReassessment: boolean) {
  if (needsReassessment) return "Review";
  return satisfied ? "Ready" : "Pending";
}

function statusClass(satisfied: boolean, needsReassessment: boolean) {
  if (needsReassessment) return "border-amber-200 bg-amber-50 text-amber-900";
  if (satisfied) return "border-brand-mint/40 bg-brand-mint/10 text-brand-navy";
  return "border-brand-light-node bg-white text-brand-slate";
}

export function SharedReadinessCard({
  caseData,
  onOpenCaseSetupStatus,
  onOpenAnesthesiaWorkflow,
  onOpenIsolationWorkflow,
  className = "",
}: {
  caseData: EndoCase;
  onOpenCaseSetupStatus: (focusTarget?: CaseSetupFocusTarget) => void;
  onOpenAnesthesiaWorkflow: (entryNodeId?: string) => void;
  onOpenIsolationWorkflow: (entryNodeId?: string) => void;
  className?: string;
}) {
  const capabilitySummary = getCaseCapabilitySummary(caseData);
  const anesthesiaEntryNodeId = capabilitySummary.anesthesia.needsReassessment ? "anesthesia-needs-reassessment" : undefined;
  const isolationEntryNodeId =
    capabilitySummary.isolation.satisfied || capabilitySummary.isolation.needsReassessment
      ? "isolation-needs-reassessment"
      : undefined;
  const items = [
    {
      label: "Diagnosis",
      status: capabilitySummary.diagnosis,
      onClick: () => onOpenCaseSetupStatus("diagnosis"),
    },
    {
      label: "Radiographs",
      status: capabilitySummary.radiographs,
      onClick: () => onOpenCaseSetupStatus("radiographs"),
    },
    {
      label: "Anesthesia",
      status: capabilitySummary.anesthesia,
      onClick: () => onOpenAnesthesiaWorkflow(anesthesiaEntryNodeId),
    },
    {
      label: "Isolation",
      status: capabilitySummary.isolation,
      onClick: () => onOpenIsolationWorkflow(isolationEntryNodeId),
    },
  ];

  return (
    <section className={`min-w-0 rounded-2xl border border-brand-light-node bg-white p-4 shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-brand-navy">Shared readiness</h3>
          <p className="mt-1 text-xs leading-5 text-brand-slate">Reusable case context for the active workflow.</p>
        </div>
        <button type="button" onClick={() => onOpenCaseSetupStatus()} className={panelActionButton.secondaryMuted}>
          Case Setup
        </button>
      </div>
      <div className="mt-3 grid gap-2">
        {items.map(({ label, status, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className={`rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${statusClass(status.satisfied, status.needsReassessment)}`}
          >
            <span className="flex items-start justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold">
                {statusLabel(status.satisfied, status.needsReassessment)}
              </span>
            </span>
            <span className="mt-1 block text-xs leading-5 opacity-85">{status.summary}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
