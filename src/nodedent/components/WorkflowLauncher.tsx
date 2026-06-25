import React from "react";
import type { EndoCase } from "../types";
import { getCaseStatus, getOutputCaseStatus } from "../engine/deriveCaseStatus";
import type { CaseCapabilitySummary } from "../workflow/selectors";
import { getCaseCapabilitySummary } from "../workflow/selectors";
import { buildAppointmentWorkflowMap } from "../workflow/workflowMap";
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
  isOperativeRestorationPlacedEvent,
  isOperativeScopeRecordedEvent,
  operativeDirectRestorationWorkflowId,
} from "../workflow/operative";
import { AppointmentWorkflowMapPanel } from "./AppointmentWorkflowMapPanel";
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

type PrimaryWorkflowProgressLabel = "Not started" | "In progress" | "Complete";

function progressStatusClass(label: PrimaryWorkflowProgressLabel) {
  if (label === "Complete" || label === "In progress") return statusBadge.ready;
  return statusBadge.neutral;
}

function getOperativeProgressLabel(caseData: EndoCase): PrimaryWorkflowProgressLabel {
  const events = caseData.globalEvents || [];
  if (events.some(isOperativeRestorationPlacedEvent)) return "Complete";
  if (events.some(isOperativeScopeRecordedEvent)) return "In progress";
  return "Not started";
}

export function WorkflowLauncher({
  caseData,
  capabilitySummary: providedCapabilitySummary,
  currentNodeId,
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
  currentNodeId?: string;
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
  const workflowMap = buildAppointmentWorkflowMap(caseData, currentNodeId);
  const anesthesiaStatus = sharedCapabilityStatusLabel(capabilitySummary.anesthesia);
  const isolationStatus = sharedCapabilityStatusLabel(capabilitySummary.isolation);
  const radiologyStatus = sharedCapabilityStatusLabel(capabilitySummary.radiographs);
  const endodonticStarted = currentNodePhase !== "Pre-op" || (currentNodeTitle !== "Pre-op setup" && currentNodeTitle !== "Pre-op");
  const endodonticStatusLabel: PrimaryWorkflowProgressLabel = endodonticStarted ? "In progress" : "Not started";
  const primaryWorkflowLaunchLabel = "Enter workflow";
  const operativeStatusLabel = getOperativeProgressLabel(caseData);
  const completedWorkflowCount = operativeStatusLabel === "Complete" ? 1 : 0;
  const activeWorkflowSummaries = [
    ...(endodonticStarted
      ? [{
        workflowId: endodonticRootWorkflowId,
        title: "Endodontic RCT",
        description: `Current step: ${currentNodeTitle} · ${currentNodePhase} · Active canal ${caseData.currentCanal || "not set"} · Autosaved ${formatTimestamp(caseData.autosavedAt)}`,
        actionLabel: primaryWorkflowLaunchLabel,
        onAction: onContinueEndodonticWorkflow,
      }]
      : []),
    ...(operativeStatusLabel === "In progress"
      ? [{
        workflowId: operativeDirectRestorationWorkflowId,
        title: "Operative direct restoration",
        description: `Surface scope recorded · Patient ${caseData.patientNumber || "not set"} · Tooth ${caseData.tooth || "not set"} · Autosaved ${formatTimestamp(caseData.autosavedAt)}`,
        actionLabel: primaryWorkflowLaunchLabel,
        onAction: () => onOpenPrimaryWorkflowSetup(operativeDirectRestorationWorkflowId),
      }]
      : []),
  ];
  const workflowStatusTitle = activeWorkflowSummaries.length === 0
    ? completedWorkflowCount > 0
      ? "No workflows in progress"
      : "No workflows started"
    : activeWorkflowSummaries.length === 1
      ? "1 workflow in progress"
      : `${activeWorkflowSummaries.length} workflows in progress`;
  const workflowStatusDescription = activeWorkflowSummaries.length > 0
    ? "Continue from the current workflow card below, or start another primary workflow if needed."
    : completedWorkflowCount > 0
      ? "Completed workflows remain available in the primary workflow list."
    : "Start a primary workflow below, or record shared modules before treatment.";
  const displayProcedureType = operativeStatusLabel !== "Not started" && !endodonticStarted
    ? "Direct restoration"
    : caseData.procedureType || "RCT";
  const displayCaseStatus = operativeStatusLabel !== "Not started" && !endodonticStarted
    ? getOutputCaseStatus({ ...caseData, procedureType: "Direct restoration" })
    : getCaseStatus(caseData);
  const activeCaseFacts = [
    `Patient ${caseData.patientNumber || "not set"}`,
    `Tooth ${caseData.tooth || "not set"}`,
    displayProcedureType,
    displayCaseStatus,
  ];

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

        <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <section className={panelSurface.muted}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className={sectionText.titleSmall}>Workflow status</h3>
                <p className="mt-1 text-lg font-bold text-brand-navy">{workflowStatusTitle}</p>
                <p className="mt-1 text-sm leading-6 text-brand-slate">
                  {workflowStatusDescription}
                </p>
              </div>
              <span className={cx(statusBadge.base, activeWorkflowSummaries.length > 0 ? statusBadge.ready : statusBadge.neutral)}>
                {activeWorkflowSummaries.length > 0 ? "In progress" : completedWorkflowCount > 0 ? "No active workflow" : "No workflow"}
              </span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
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

        {activeWorkflowSummaries.length > 0 ? (
          <section className={cx(panelSurface.muted, "mt-4")}>
            <h3 className={sectionText.titleSmall}>{activeWorkflowSummaries.length > 1 ? "Current workflows" : "Current workflow"}</h3>
            <div className="mt-3 grid gap-3">
              {activeWorkflowSummaries.map((workflow) => (
                <div key={workflow.workflowId} className={workspaceSurface.launcherCard}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-bold text-brand-navy">{workflow.title}</p>
                      <p className="mt-1 text-sm leading-6 text-brand-slate">{workflow.description}</p>
                    </div>
                    <span className={cx(statusBadge.base, statusBadge.ready)}>In progress</span>
                  </div>
                  <button
                    type="button"
                    onClick={workflow.onAction}
                    className={cx(panelActionButton.primary, "mt-4")}
                  >
                    {workflow.actionLabel}
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mt-4">
          <AppointmentWorkflowMapPanel map={workflowMap} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className={panelSurface.cardPadded}>
            <h3 className={sectionText.titleSmall}>Primary workflows</h3>
            <div className="mt-3 grid gap-3">
              {primaryEntries.map((entry) => {
                const isEndo = entry.workflowId === endodonticRootWorkflowId;
                const isOperative = entry.workflowId === operativeDirectRestorationWorkflowId;
                const statusLabel: PrimaryWorkflowProgressLabel | string = isEndo
                  ? endodonticStatusLabel
                  : isOperative
                    ? operativeStatusLabel
                    : entry.statusLabel;
                const launchLabel = isEndo ? primaryWorkflowLaunchLabel : entry.launchLabel;
                return (
                  <div key={entry.workflowId} className={workspaceSurface.launcherCard}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-bold text-brand-navy">{entry.title}</p>
                        <p className="mt-1 text-xs leading-5 text-brand-slate">{entry.summary}</p>
                        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-brand-slate">{compactScopeList(entry.supportedScopes)}</p>
                      </div>
                      <span className={cx(statusBadge.base, isEndo || isOperative ? progressStatusClass(statusLabel as PrimaryWorkflowProgressLabel) : sharedAvailabilityClass(entry.availability))}>
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
