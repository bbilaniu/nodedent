import React from "react";
import type { EndoCase } from "../types";
import { ClinicalDataNotice } from "./ClinicalDataNotice";

function formatStartedAt(createdAt?: string) {
  if (!createdAt) return "Not recorded";
  const timestamp = new Date(createdAt);
  return Number.isFinite(timestamp.getTime()) ? timestamp.toLocaleString() : "Not recorded";
}

export function CaseEntryGate({
  activeCase,
  hasMeaningfulActiveCase,
  otherCaseCount,
  persistentStorage,
  onContinueCurrentCase,
  onStartNewCase,
  onReviewSavedCases,
  onLockVault,
}: {
  activeCase: EndoCase;
  hasMeaningfulActiveCase: boolean;
  otherCaseCount: number;
  persistentStorage: boolean;
  onContinueCurrentCase: () => void;
  onStartNewCase: () => void;
  onReviewSavedCases: () => void;
  onLockVault: () => void;
}) {
  return (
    <main className="min-h-screen bg-brand-light-slate p-4 text-brand-navy">
      <div className="mx-auto max-w-4xl space-y-4">
        <ClinicalDataNotice />
        {!persistentStorage ? (
          <div role="status" className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            This browser did not grant persistent storage. It may remove the encrypted vault under storage pressure; download encrypted backups regularly.
          </div>
        ) : null}

        <section className="rounded-3xl border border-brand-light-node bg-white p-5 shadow-xl sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-slate">Protected vault opened</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl">
            {hasMeaningfulActiveCase ? "Continue the current case?" : "Start a new case"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-slate">
            {hasMeaningfulActiveCase
              ? "Confirm that this is the case you intend to continue before returning to its clinical workspace."
              : "No meaningful active case was found in this vault. Start a new case to enter the patient, treatment area, and workflow context."}
          </p>

          {hasMeaningfulActiveCase ? (
            <dl className="mt-5 grid gap-3 rounded-2xl border border-brand-light-node bg-brand-light-slate p-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-brand-slate">Started</dt>
                <dd className="mt-1 text-sm font-semibold text-brand-navy">{formatStartedAt(activeCase.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-brand-slate">Patient number</dt>
                <dd className="mt-1 text-sm font-semibold text-brand-navy">{activeCase.patientNumber || "Not recorded"}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-brand-slate">Procedure / area</dt>
                <dd className="mt-1 text-sm font-semibold text-brand-navy">
                  {activeCase.procedureType}{activeCase.tooth ? ` · Tooth ${activeCase.tooth}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-brand-slate">Saved context</dt>
                <dd className="mt-1 text-sm font-semibold text-brand-navy">
                  {activeCase.caseStatus || "Visit status not recorded"} · {activeCase.globalEvents.length} workflow event{activeCase.globalEvents.length === 1 ? "" : "s"}
                </dd>
              </div>
            </dl>
          ) : null}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {hasMeaningfulActiveCase ? (
              <button
                type="button"
                onClick={onContinueCurrentCase}
                className="rounded-xl bg-brand-navy px-4 py-3 text-sm font-bold text-white hover:bg-brand-navy-deep"
              >
                Continue current case
              </button>
            ) : null}
            <button
              type="button"
              onClick={onStartNewCase}
              className={hasMeaningfulActiveCase
                ? "rounded-xl border border-brand-light-node bg-white px-4 py-3 text-sm font-bold text-brand-navy hover:bg-brand-light-slate"
                : "rounded-xl bg-brand-navy px-4 py-3 text-sm font-bold text-white hover:bg-brand-navy-deep"}
            >
              Start new case
            </button>
            {otherCaseCount > 0 ? (
              <button
                type="button"
                onClick={onReviewSavedCases}
                className="rounded-xl border border-brand-blue-light bg-brand-blue-light/20 px-4 py-3 text-sm font-bold text-brand-navy hover:bg-brand-blue-light/30"
              >
                Review {otherCaseCount} other saved case{otherCaseCount === 1 ? "" : "s"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onLockVault}
              className="rounded-xl border border-brand-light-node bg-white px-4 py-3 text-sm font-semibold text-brand-slate hover:bg-brand-light-slate sm:ml-auto"
            >
              Lock vault
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
