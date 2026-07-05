import React from "react";
import type { EndoCase } from "../types";
import { getCaseStatus } from "../engine/deriveCaseStatus";
import type { CaseCapabilitySummary } from "../workflow/selectors";
import { getCaseCapabilitySummary } from "../workflow/selectors";
import {
  endodonticRootWorkflowId,
  getPrimaryWorkflowLauncherEntries,
  getSharedModuleLauncherEntries,
  workflowLauncherEntries,
} from "../workflow/registry";
import { sharedIsolationWorkflowId } from "../workflow/isolation";
import { sharedAnesthesiaWorkflowId } from "../workflow/anesthesia";
import { sharedRadiologyWorkflowId } from "../workflow/radiology";
import {
  getLatestOperativeWorkflowSetup,
  getOperativeRestorationEvents,
  operativeDirectRestorationWorkflowId,
} from "../workflow/operative";
import { noTreatmentSelectedProcedure } from "../workflow/procedures";
import { sharedAvailabilityClass, sharedCapabilityStatusClass, sharedCapabilityStatusLabel, sharedModuleActionLabel, sharedStatusLabelClass } from "./sharedModuleUi";
import { cx, panelActionButton, panelSurface, sectionText, statusBadge, workspaceSurface } from "./uiStyles";

function formatTimestamp(timestamp?: string) {
  if (!timestamp) return "not yet";
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "not yet";
  return date.toLocaleString();
}

function compactScopeList(scopes: readonly string[]) {
  return scopes.join(", ");
}

function hasOperativeSetupProgress(caseData: EndoCase) {
  const setup = getLatestOperativeWorkflowSetup(caseData);
  return Object.values(setup).some((value) => value.trim());
}

export function WorkflowLauncher({
  caseData,
  capabilitySummary: providedCapabilitySummary,
  currentNodeTitle,
  currentNodePhase,
  savedCaseCount,
  presentation = "modal",
  onClose,
  onContinueEndodonticWorkflow,
  onOpenCaseSetupStatus,
  onOpenSavedCases,
  onOpenPriorVisit,
  onOpenNewCaseConfirm,
  onOpenPrimaryWorkflowSetup,
  onOpenAnesthesiaWorkflow,
  onOpenIsolationWorkflow,
  onOpenRadiologyWorkflow,
}: {
  caseData: EndoCase;
  capabilitySummary?: CaseCapabilitySummary;
  currentNodeTitle: string;
  currentNodePhase: string;
  savedCaseCount: number;
  presentation?: "modal" | "page";
  onClose: () => void;
  onContinueEndodonticWorkflow: () => void;
  onOpenCaseSetupStatus: () => void;
  onOpenSavedCases: () => void;
  onOpenPriorVisit: () => void;
  onOpenNewCaseConfirm: () => void;
  onOpenPrimaryWorkflowSetup: (workflowId: string) => void;
  onOpenAnesthesiaWorkflow: () => void;
  onOpenIsolationWorkflow: () => void;
  onOpenRadiologyWorkflow: () => void;
}) {
  const primaryEntries = getPrimaryWorkflowLauncherEntries(workflowLauncherEntries);
  const sharedModuleEntries = getSharedModuleLauncherEntries(workflowLauncherEntries);
  const capabilitySummary = providedCapabilitySummary || getCaseCapabilitySummary(caseData);
  const anesthesiaStatus = sharedCapabilityStatusLabel(capabilitySummary.anesthesia);
  const isolationStatus = sharedCapabilityStatusLabel(capabilitySummary.isolation);
  const radiologyStatus = sharedCapabilityStatusLabel(capabilitySummary.radiographs);
  const endodonticStarted = currentNodePhase !== "Pre-op" || (currentNodeTitle !== "Pre-op setup" && currentNodeTitle !== "Pre-op");
  const endodonticStatusLabel = endodonticStarted ? "In progress" : "Not started";
  const endodonticLaunchLabel = endodonticStarted ? "Continue workflow" : "Start workflow";
  const operativeCompleted = getOperativeRestorationEvents(caseData).length > 0;
  const operativeStarted = hasOperativeSetupProgress(caseData);
  const operativeStatusLabel = operativeCompleted ? "Complete" : operativeStarted ? "In progress" : "Not started";
  const operativeLaunchLabel = operativeCompleted ? "Review workflow" : operativeStarted ? "Resume workflow" : "Start workflow";
  const procedureLabel = caseData.procedureType || noTreatmentSelectedProcedure;
  const caseStatusLabel = getCaseStatus(caseData);
  const activeCaseFacts = [
    `Patient ${caseData.patientNumber || "not set"}`,
    `Tooth ${caseData.tooth || "not set"}`,
    procedureLabel,
    caseStatusLabel,
  ].filter((fact, index, facts) => index === facts.indexOf(fact));

  const content = (
      <section className={cx(workspaceSurface.shell, presentation === "modal" ? "mt-6 shadow-2xl" : "shadow-sm")}>
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className={sectionText.eyebrow}>Clinical workspace</p>
            <h2 className="mt-1 text-2xl font-bold text-brand-navy">NodeDent Home</h2>
            <p className="mt-1 text-sm text-brand-slate">{activeCaseFacts.join(" · ")}</p>
          </div>
          {presentation === "modal" ? (
            <button
              type="button"
              onClick={onClose}
              className={panelActionButton.muted}
            >
              Close
            </button>
          ) : null}
        </div>

        <div className={cx("grid gap-4", presentation === "modal" ? "xl:grid-cols-[1.2fr_1fr]" : "xl:grid-cols-1")}>
          {presentation === "modal" ? (
            <section className={panelSurface.muted}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className={sectionText.titleSmall}>Workflow quick actions</h3>
                  <p className="mt-1 text-lg font-bold text-brand-navy">{currentNodeTitle}</p>
                  <p className="mt-1 text-sm leading-6 text-brand-slate">
                    {currentNodePhase} · Active canal {caseData.currentCanal || "not set"} · Autosaved {formatTimestamp(caseData.autosavedAt)}
                  </p>
                </div>
                <span className={cx(statusBadge.base, endodonticStarted ? statusBadge.ready : statusBadge.neutral)}>
                  {endodonticStarted ? "Fast resume" : "Start"}
                </span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                <button
                  type="button"
                  onClick={onContinueEndodonticWorkflow}
                  className={panelActionButton.primary}
                >
                  {endodonticLaunchLabel}
                </button>
                <button
                  type="button"
                  onClick={onOpenCaseSetupStatus}
                  className={panelActionButton.secondary}
                >
                  Case Setup & Status
                </button>
                <button
                  type="button"
                  onClick={onOpenSavedCases}
                  className={panelActionButton.info}
                >
                  Saved cases ({savedCaseCount})
                </button>
                <button
                  type="button"
                  onClick={onOpenPriorVisit}
                  className={panelActionButton.warning}
                >
                  Prior visit
                </button>
                <button
                  type="button"
                  onClick={onOpenNewCaseConfirm}
                  className={panelActionButton.secondary}
                >
                  New case
                </button>
              </div>
            </section>
          ) : null}

          <section className={panelSurface.muted}>
            <h3 className={sectionText.titleSmall}>Shared module status</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className={cx(workspaceSurface.statusTile, sharedCapabilityStatusClass(capabilitySummary.diagnosis))}>
                <p className="text-xs font-bold uppercase tracking-wide">Diagnosis</p>
                <p className="mt-1 text-sm font-semibold">{capabilitySummary.diagnosis.summary}</p>
              </div>
              <div className={cx(workspaceSurface.statusTile, sharedCapabilityStatusClass(capabilitySummary.radiographs))}>
                <p className="text-xs font-bold uppercase tracking-wide">Radiographs</p>
                <p className="mt-1 text-sm font-semibold">{capabilitySummary.radiographs.summary}</p>
              </div>
              <div className={cx(workspaceSurface.statusTile, sharedAvailabilityClass(capabilitySummary.anesthesia.satisfied && !capabilitySummary.anesthesia.needsReassessment ? "ready" : "modelOnly"))}>
                <p className="text-xs font-bold uppercase tracking-wide">Anesthesia</p>
                <p className="mt-1 text-sm font-semibold">{anesthesiaStatus}</p>
              </div>
              <div className={cx(workspaceSurface.statusTile, sharedAvailabilityClass(capabilitySummary.isolation.satisfied && !capabilitySummary.isolation.needsReassessment ? "ready" : "modelOnly"))}>
                <p className="text-xs font-bold uppercase tracking-wide">Isolation</p>
                <p className="mt-1 text-sm font-semibold">{isolationStatus}</p>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className={panelSurface.cardPadded}>
            <h3 className={sectionText.titleSmall}>Primary workflows</h3>
            <div className="mt-3 grid gap-3">
              {primaryEntries.map((entry) => {
                const isEndo = entry.workflowId === endodonticRootWorkflowId;
                const isOperative = entry.workflowId === operativeDirectRestorationWorkflowId;
                const statusLabel = isEndo ? endodonticStatusLabel : isOperative ? operativeStatusLabel : entry.statusLabel;
                const launchLabel = isEndo ? endodonticLaunchLabel : isOperative ? operativeLaunchLabel : entry.launchLabel;
                return (
                  <div key={entry.workflowId} className={workspaceSurface.launcherCard}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-bold text-brand-navy">{entry.title}</p>
                        <p className="mt-1 text-xs leading-5 text-brand-slate">{entry.summary}</p>
                        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-brand-slate">{compactScopeList(entry.supportedScopes)}</p>
                      </div>
                      <span className={cx(statusBadge.base, isEndo ? sharedStatusLabelClass(statusLabel) : sharedAvailabilityClass(entry.availability))}>
                        {statusLabel}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={isEndo ? onContinueEndodonticWorkflow : () => onOpenPrimaryWorkflowSetup(entry.workflowId)}
                      className={cx(panelActionButton.primary, "mt-3 disabled:cursor-not-allowed disabled:border-brand-light-node disabled:bg-white disabled:text-brand-slate")}
                    >
                      {launchLabel}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className={panelSurface.cardPadded}>
            <h3 className={sectionText.titleSmall}>Shared modules</h3>
            <div className="mt-3 grid gap-3">
              {sharedModuleEntries.map((entry) => {
                const isIsolation = entry.workflowId === sharedIsolationWorkflowId;
                const isAnesthesia = entry.workflowId === sharedAnesthesiaWorkflowId;
                const isRadiology = entry.workflowId === sharedRadiologyWorkflowId;
                const canLaunch = entry.availability === "ready" && (isIsolation || isAnesthesia || isRadiology);
                const moduleStatus = isAnesthesia
                  ? capabilitySummary.anesthesia
                  : isIsolation
                    ? capabilitySummary.isolation
                    : isRadiology
                      ? capabilitySummary.radiographs
                      : null;
                const moduleKind = isAnesthesia ? "anesthesia" : isIsolation ? "isolation" : isRadiology ? "radiology" : null;
                const moduleStatusLabel = isAnesthesia ? anesthesiaStatus : isIsolation ? isolationStatus : isRadiology ? radiologyStatus : entry.statusLabel;
                const launchLabel = moduleStatus && moduleKind ? sharedModuleActionLabel(moduleKind, moduleStatus) : entry.launchLabel;
                const onLaunch = isIsolation ? onOpenIsolationWorkflow : isAnesthesia ? onOpenAnesthesiaWorkflow : isRadiology ? onOpenRadiologyWorkflow : undefined;
                return (
                  <div key={entry.workflowId} className={workspaceSurface.launcherCard}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-bold text-brand-navy">{entry.title}</p>
                        <p className="mt-1 text-xs leading-5 text-brand-slate">{entry.summary}</p>
                        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-brand-slate">{compactScopeList(entry.supportedScopes)}</p>
                      </div>
                      <span className={cx(statusBadge.base, sharedStatusLabelClass(moduleStatusLabel))}>
                        {moduleStatusLabel}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={canLaunch ? onLaunch : undefined}
                      disabled={!canLaunch}
                      className={cx(panelActionButton.info, "mt-3 disabled:cursor-not-allowed disabled:opacity-50")}
                    >
                      {launchLabel}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </section>
  );

  if (presentation === "page") {
    return <div className="flex justify-center">{content}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-brand-navy-deep/30 p-4">
      {content}
    </div>
  );
}
