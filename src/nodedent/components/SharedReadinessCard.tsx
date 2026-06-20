import React from "react";
import type { CaseSetupFocusTarget, EndoCase } from "../types";
import type { CaseCapabilitySummary, CapabilityStatus } from "../workflow/selectors";
import { getCaseCapabilitySummary } from "../workflow/selectors";
import { cx, panelSurface, sectionText } from "./uiStyles";

function statusLabel(satisfied: boolean, needsReassessment: boolean) {
  if (needsReassessment) return "Review";
  return satisfied ? "Ready" : "Pending";
}

function statusClass(satisfied: boolean, needsReassessment: boolean) {
  if (needsReassessment) return "border-amber-200 bg-amber-50 text-amber-900";
  if (satisfied) return "border-brand-mint/40 bg-brand-mint/10 text-brand-navy";
  return "border-brand-light-node bg-white text-brand-slate";
}

export type SharedReadinessAction = {
  label: string;
  status: CapabilityStatus;
  onClick: () => void;
};

export function getSharedReadinessActions({
  capabilitySummary,
  onOpenCaseSetupStatus,
  onOpenAnesthesiaWorkflow,
  onOpenIsolationWorkflow,
}: {
  capabilitySummary: CaseCapabilitySummary;
  onOpenCaseSetupStatus: (focusTarget?: CaseSetupFocusTarget) => void;
  onOpenAnesthesiaWorkflow: (entryNodeId?: string) => void;
  onOpenIsolationWorkflow: (entryNodeId?: string) => void;
}): SharedReadinessAction[] {
  const anesthesiaEntryNodeId = capabilitySummary.anesthesia.needsReassessment ? "anesthesia-needs-reassessment" : undefined;
  const isolationEntryNodeId =
    capabilitySummary.isolation.satisfied || capabilitySummary.isolation.needsReassessment
      ? "isolation-needs-reassessment"
      : undefined;

  return [
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
}

export function SharedReadinessCard({
  caseData,
  capabilitySummary,
  onOpenCaseSetupStatus,
  onOpenAnesthesiaWorkflow,
  onOpenIsolationWorkflow,
  disabledActionLabels = [],
  className = "",
}: {
  caseData: EndoCase;
  capabilitySummary?: CaseCapabilitySummary;
  onOpenCaseSetupStatus: (focusTarget?: CaseSetupFocusTarget) => void;
  onOpenAnesthesiaWorkflow: (entryNodeId?: string) => void;
  onOpenIsolationWorkflow: (entryNodeId?: string) => void;
  disabledActionLabels?: string[];
  className?: string;
}) {
  const summary = capabilitySummary || getCaseCapabilitySummary(caseData);
  const items = getSharedReadinessActions({
    capabilitySummary: summary,
    onOpenCaseSetupStatus,
    onOpenAnesthesiaWorkflow,
    onOpenIsolationWorkflow,
  });

  return (
    <section className={cx("min-w-0", panelSurface.cardPadded, className)}>
      <div>
        <p className={sectionText.eyebrow}>Shared context</p>
        <h3 className={sectionText.title}>Shared readiness</h3>
        <p className={sectionText.descriptionSmall}>Reusable diagnosis, radiographs, anesthesia, and isolation context for the active workflow.</p>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {items.map(({ label, status, onClick }) => {
          const disabled = disabledActionLabels.includes(label);
          return (
            <button
              key={label}
              type="button"
              disabled={disabled}
              onClick={onClick}
              className={cx(
                "min-h-[6.25rem] rounded-xl border px-3 py-2 text-left transition",
                disabled ? "cursor-not-allowed opacity-60" : "hover:-translate-y-0.5 hover:shadow-sm",
                statusClass(status.satisfied, status.needsReassessment),
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold">
                  {disabled ? "Open" : statusLabel(status.satisfied, status.needsReassessment)}
                </span>
              </span>
              <span className="mt-1 block text-xs leading-5 opacity-85">
                {disabled ? "Currently open in the workspace." : status.summary}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
