import React from "react";
import type { EndoCase } from "../types";
import { getCaseStatus } from "../engine/deriveCaseStatus";
import { getCaseCapabilitySummary } from "../workflow/selectors";
import {
  endodonticRootWorkflowId,
  getPrimaryWorkflowLauncherEntries,
  getSharedModuleLauncherEntries,
  workflowLauncherEntries,
} from "../workflow/registry";
import { sharedIsolationWorkflowId } from "../workflow/isolation";

function formatTimestamp(timestamp?: string) {
  if (!timestamp) return "not yet";
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "not yet";
  return date.toLocaleString();
}

function availabilityClass(availability: string) {
  if (availability === "ready") return "border-brand-mint/40 bg-brand-mint/10 text-brand-navy";
  return "border-brand-light-node bg-white text-brand-slate";
}

function compactScopeList(scopes: readonly string[]) {
  return scopes.join(", ");
}

export function WorkflowLauncher({
  caseData,
  currentNodeTitle,
  currentNodePhase,
  savedCaseCount,
  onClose,
  onContinueEndodonticWorkflow,
  onOpenCaseSetupStatus,
  onOpenSavedCases,
  onOpenPriorVisit,
  onOpenNewCaseConfirm,
  onOpenIsolationWorkflow,
}: {
  caseData: EndoCase;
  currentNodeTitle: string;
  currentNodePhase: string;
  savedCaseCount: number;
  onClose: () => void;
  onContinueEndodonticWorkflow: () => void;
  onOpenCaseSetupStatus: () => void;
  onOpenSavedCases: () => void;
  onOpenPriorVisit: () => void;
  onOpenNewCaseConfirm: () => void;
  onOpenIsolationWorkflow: () => void;
}) {
  const primaryEntries = getPrimaryWorkflowLauncherEntries(workflowLauncherEntries);
  const sharedModuleEntries = getSharedModuleLauncherEntries(workflowLauncherEntries).filter((entry) => entry.availability === "ready");
  const capabilitySummary = getCaseCapabilitySummary(caseData);
  const isolationStatus = capabilitySummary.isolation.needsReassessment ? "Review" : capabilitySummary.isolation.satisfied ? "Ready" : "Pending";
  const activeCaseFacts = [
    `Patient ${caseData.patientNumber || "not set"}`,
    `Tooth ${caseData.tooth || "not set"}`,
    caseData.procedureType || "RCT",
    getCaseStatus(caseData),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-brand-navy-deep/30 p-4">
      <section className="mt-6 w-full max-w-6xl rounded-3xl border border-brand-light-node bg-white p-5 shadow-2xl">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-slate">Clinical workspace</p>
            <h2 className="mt-1 text-2xl font-bold text-brand-navy">NodeDent Home</h2>
            <p className="mt-1 text-sm text-brand-slate">{activeCaseFacts.join(" · ")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-brand-light-node bg-brand-light-slate px-4 py-2 text-sm font-semibold text-brand-slate transition hover:bg-brand-light-node"
          >
            Close
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <section className="rounded-2xl border border-brand-light-node bg-brand-light-slate p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-sm font-bold text-brand-navy">Active endodontic workflow</h3>
                <p className="mt-1 text-lg font-bold text-brand-navy">{currentNodeTitle}</p>
                <p className="mt-1 text-sm leading-6 text-brand-slate">
                  {currentNodePhase} · Active canal {caseData.currentCanal || "not set"} · Autosaved {formatTimestamp(caseData.autosavedAt)}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-brand-mint/40 bg-brand-mint/10 px-3 py-1 text-xs font-semibold text-brand-navy">
                Fast resume
              </span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <button
                type="button"
                onClick={onContinueEndodonticWorkflow}
                className="rounded-xl border border-brand-navy bg-brand-navy px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-navy-deep"
              >
                Continue workflow
              </button>
              <button
                type="button"
                onClick={onOpenCaseSetupStatus}
                className="rounded-xl border border-brand-light-node bg-white px-3 py-2 text-sm font-semibold text-brand-navy transition hover:bg-brand-light-slate"
              >
                Case Setup & Status
              </button>
              <button
                type="button"
                onClick={onOpenSavedCases}
                className="rounded-xl border border-brand-blue-light bg-brand-blue-light/20 px-3 py-2 text-sm font-semibold text-brand-navy transition hover:bg-brand-blue-light/30"
              >
                Saved cases ({savedCaseCount})
              </button>
              <button
                type="button"
                onClick={onOpenNewCaseConfirm}
                className="rounded-xl border border-brand-light-node bg-white px-3 py-2 text-sm font-semibold text-brand-navy transition hover:bg-brand-light-slate"
              >
                New case
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-brand-light-node bg-brand-light-slate p-4">
            <h3 className="text-sm font-bold text-brand-navy">Shared module status</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className={`rounded-xl border px-3 py-2 ${capabilitySummary.diagnosis.satisfied ? "border-brand-mint/40 bg-white text-brand-navy" : "border-brand-light-node bg-white text-brand-slate"}`}>
                <p className="text-xs font-bold uppercase tracking-wide">Diagnosis</p>
                <p className="mt-1 text-sm font-semibold">{capabilitySummary.diagnosis.summary}</p>
              </div>
              <div className={`rounded-xl border px-3 py-2 ${capabilitySummary.radiographs.satisfied ? "border-brand-mint/40 bg-white text-brand-navy" : "border-brand-light-node bg-white text-brand-slate"}`}>
                <p className="text-xs font-bold uppercase tracking-wide">Radiographs</p>
                <p className="mt-1 text-sm font-semibold">{capabilitySummary.radiographs.summary}</p>
              </div>
              <div className="rounded-xl border border-brand-light-node bg-white px-3 py-2 text-brand-slate">
                <p className="text-xs font-bold uppercase tracking-wide">Anesthesia</p>
                <p className="mt-1 text-sm font-semibold">{capabilitySummary.anesthesia.summary}</p>
              </div>
              <div className={`rounded-xl border px-3 py-2 ${availabilityClass(capabilitySummary.isolation.satisfied && !capabilitySummary.isolation.needsReassessment ? "ready" : "modelOnly")}`}>
                <p className="text-xs font-bold uppercase tracking-wide">Isolation</p>
                <p className="mt-1 text-sm font-semibold">{isolationStatus}</p>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-brand-light-node bg-white p-4">
            <h3 className="text-sm font-bold text-brand-navy">Primary workflows</h3>
            <div className="mt-3 grid gap-3">
              {primaryEntries.map((entry) => {
                const isEndo = entry.workflowId === endodonticRootWorkflowId;
                return (
                  <div key={entry.workflowId} className="rounded-xl border border-brand-light-node bg-brand-light-slate p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-bold text-brand-navy">{entry.title}</p>
                        <p className="mt-1 text-xs leading-5 text-brand-slate">{entry.summary}</p>
                        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-brand-slate">{compactScopeList(entry.supportedScopes)}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${availabilityClass(entry.availability)}`}>
                        {entry.statusLabel}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={isEndo ? onContinueEndodonticWorkflow : undefined}
                      disabled={!isEndo}
                      className="mt-3 rounded-xl border border-brand-navy bg-brand-navy px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-navy-deep disabled:cursor-not-allowed disabled:border-brand-light-node disabled:bg-white disabled:text-brand-slate"
                    >
                      {entry.launchLabel}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-brand-light-node bg-white p-4">
            <h3 className="text-sm font-bold text-brand-navy">Ready shared modules</h3>
            <div className="mt-3 grid gap-3">
              {sharedModuleEntries.map((entry) => {
                const isIsolation = entry.workflowId === sharedIsolationWorkflowId;
                return (
                  <div key={entry.workflowId} className="rounded-xl border border-brand-light-node bg-brand-light-slate p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-bold text-brand-navy">{entry.title}</p>
                        <p className="mt-1 text-xs leading-5 text-brand-slate">{entry.summary}</p>
                        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-brand-slate">{compactScopeList(entry.supportedScopes)}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${availabilityClass(entry.availability)}`}>
                        {entry.statusLabel}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={isIsolation ? onOpenIsolationWorkflow : undefined}
                      disabled={!isIsolation}
                      className="mt-3 rounded-xl border border-brand-blue-light bg-white px-3 py-2 text-sm font-semibold text-brand-navy transition hover:bg-brand-blue-light/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {entry.launchLabel}
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={onOpenPriorVisit}
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-100"
              >
                Prior visit
              </button>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
