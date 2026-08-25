import React, { useEffect } from "react";
import type { EndoCase } from "../types";
import {
  diagnosisSectionRegistry,
  type DiagnosisFieldId,
  type DiagnosisSectionId,
  getDiagnosisFieldValue,
  getDiagnosisSectionSummary,
  hasDiagnosisSectionRecord,
} from "../workflow/diagnosis";
import { ClinicalDataNotice } from "./ClinicalDataNotice";
import { TextInput } from "./FormControls";
import { cx, panelSurface, sectionText, semanticActionButton, statusBadge } from "./uiStyles";

export function DiagnosisPage({
  caseData,
  onUpdateDiagnosis,
  onClose,
  returnLabel = "Return to workspace",
}: {
  caseData: EndoCase;
  onUpdateDiagnosis: (sectionId: DiagnosisSectionId, fieldId: DiagnosisFieldId, value: string) => void;
  onClose: () => void;
  returnLabel?: string;
}) {
  const targetTooth = caseData.tooth.trim();
  const targetLabel = targetTooth ? `Tooth ${targetTooth}` : "Default tooth not set";

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="min-h-screen bg-brand-light-slate p-4 text-brand-navy">
      <section className="mx-auto w-full max-w-5xl rounded-3xl border border-brand-light-node bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className={sectionText.eyebrow}>Shared clinical context</p>
            <h1 className="mt-1 text-2xl font-bold text-brand-navy sm:text-3xl">Diagnosis</h1>
            <p className="mt-1 text-sm leading-6 text-brand-slate">
              Record diagnosis by discipline. Entries are autosaved to the protected case draft.
            </p>
          </div>
          <button type="button" onClick={onClose} className={semanticActionButton.secondary}>
            {returnLabel}
          </button>
        </div>

        <ClinicalDataNotice compact />

        <section className={cx(panelSurface.muted, "mt-4")} aria-label="Diagnosis target">
          <p className={sectionText.eyebrow}>Current target</p>
          <p className="mt-1 text-lg font-bold text-brand-navy">{targetLabel}</p>
          <p className={sectionText.descriptionSmall}>
            Diagnosis readiness currently follows the case default tooth for compatibility with existing notes and exports.
          </p>
        </section>

        <div className="mt-4 grid gap-4">
          {diagnosisSectionRegistry.map((section) => {
            const recorded = hasDiagnosisSectionRecord(caseData, section.id);
            const targetNeeded = recorded && !targetTooth;
            return (
              <section key={section.id} className={panelSurface.cardPaddedLarge} aria-labelledby={`diagnosis-${section.id}-title`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className={sectionText.eyebrow}>{section.disciplineLabel}</p>
                    <h2 id={`diagnosis-${section.id}-title`} className={sectionText.title}>{section.label}</h2>
                    <p className={sectionText.description}>{section.description}</p>
                  </div>
                  <span className={cx(statusBadge.base, targetNeeded ? statusBadge.attention : recorded ? statusBadge.ready : statusBadge.neutral)}>
                    {targetNeeded ? "Target needed" : recorded ? "Recorded" : "Not recorded"}
                  </span>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {section.fields.map((field) => (
                    <TextInput
                      key={field.id}
                      label={field.label}
                      value={getDiagnosisFieldValue(caseData, section.id, field.id)}
                      onChange={(value) => onUpdateDiagnosis(section.id, field.id, value)}
                      placeholder={field.placeholder}
                    />
                  ))}
                </div>

                <p role="status" className="mt-4 text-xs font-semibold leading-5 text-brand-slate">
                  {getDiagnosisSectionSummary(caseData, section.id)}.
                  {targetNeeded ? " Set the default tooth in Case Setup to establish readiness." : ""}
                  {" "}This panel records context; it does not advance a treatment workflow.
                </p>
              </section>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-brand-light-node pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-brand-slate">Changes are saved automatically. No separate record button is required.</p>
          <button type="button" onClick={onClose} className={semanticActionButton.primaryLarge}>
            {returnLabel}
          </button>
        </div>
      </section>
    </main>
  );
}
