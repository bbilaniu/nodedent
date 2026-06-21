import React from "react";
import type { CaseSetupFocusTarget, EndoCase } from "../types";
import type { CaseCapabilitySummary, CapabilityStatus } from "../workflow/selectors";
import { getCaseCapabilitySummary } from "../workflow/selectors";
import { sharedCapabilityStatusClass, sharedCapabilityStatusLabel, sharedModuleActionLabel, sharedModuleEntryNodeId } from "./sharedModuleUi";
import { cx, panelSurface, sectionText } from "./uiStyles";

export type SharedReadinessAction = {
  label: string;
  actionLabel: string;
  status: CapabilityStatus;
  onClick: () => void;
};

export function getSharedReadinessActions({
  capabilitySummary,
  onOpenCaseSetupStatus,
  onOpenAnesthesiaWorkflow,
  onOpenIsolationWorkflow,
  onOpenRadiologyWorkflow,
}: {
  capabilitySummary: CaseCapabilitySummary;
  onOpenCaseSetupStatus: (focusTarget?: CaseSetupFocusTarget) => void;
  onOpenAnesthesiaWorkflow: (entryNodeId?: string) => void;
  onOpenIsolationWorkflow: (entryNodeId?: string) => void;
  onOpenRadiologyWorkflow: (entryNodeId?: string) => void;
}): SharedReadinessAction[] {
  const anesthesiaEntryNodeId = sharedModuleEntryNodeId("anesthesia", capabilitySummary.anesthesia);
  const isolationEntryNodeId = sharedModuleEntryNodeId("isolation", capabilitySummary.isolation);
  const radiologyEntryNodeId = sharedModuleEntryNodeId("radiology", capabilitySummary.radiographs);

  return [
    {
      label: "Diagnosis",
      actionLabel: "Review diagnosis",
      status: capabilitySummary.diagnosis,
      onClick: () => onOpenCaseSetupStatus("diagnosis"),
    },
    {
      label: "Radiographs",
      actionLabel: sharedModuleActionLabel("radiology", capabilitySummary.radiographs),
      status: capabilitySummary.radiographs,
      onClick: () => onOpenRadiologyWorkflow(radiologyEntryNodeId),
    },
    {
      label: "Anesthesia",
      actionLabel: sharedModuleActionLabel("anesthesia", capabilitySummary.anesthesia),
      status: capabilitySummary.anesthesia,
      onClick: () => onOpenAnesthesiaWorkflow(anesthesiaEntryNodeId),
    },
    {
      label: "Isolation",
      actionLabel: sharedModuleActionLabel("isolation", capabilitySummary.isolation),
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
  onOpenRadiologyWorkflow,
  disabledActionLabels = [],
  className = "",
}: {
  caseData: EndoCase;
  capabilitySummary?: CaseCapabilitySummary;
  onOpenCaseSetupStatus: (focusTarget?: CaseSetupFocusTarget) => void;
  onOpenAnesthesiaWorkflow: (entryNodeId?: string) => void;
  onOpenIsolationWorkflow: (entryNodeId?: string) => void;
  onOpenRadiologyWorkflow: (entryNodeId?: string) => void;
  disabledActionLabels?: string[];
  className?: string;
}) {
  const summary = capabilitySummary || getCaseCapabilitySummary(caseData);
  const items = getSharedReadinessActions({
    capabilitySummary: summary,
    onOpenCaseSetupStatus,
    onOpenAnesthesiaWorkflow,
    onOpenIsolationWorkflow,
    onOpenRadiologyWorkflow,
  });

  return (
    <section className={cx("min-w-0", panelSurface.cardPadded, className)}>
      <div>
        <p className={sectionText.eyebrow}>Shared context</p>
        <h3 className={sectionText.title}>Shared readiness</h3>
        <p className={sectionText.descriptionSmall}>Reusable diagnosis, radiographs, anesthesia, and isolation context for the active workflow.</p>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {items.map(({ label, actionLabel, status, onClick }) => {
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
                sharedCapabilityStatusClass(status),
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold">
                  {disabled ? "Open" : sharedCapabilityStatusLabel(status)}
                </span>
              </span>
              <span className="mt-1 block text-xs leading-5 opacity-85">
                {disabled ? "Currently open in the workspace." : status.summary}
              </span>
              {!disabled ? <span className="mt-2 block text-xs font-semibold">{actionLabel}</span> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
