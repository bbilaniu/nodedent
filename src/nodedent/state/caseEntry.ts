import type { EndoCase } from "../types";
import { isNoTreatmentSelected } from "../workflow/procedures";
import type { SavedCaseSummary } from "./clinicalVault";

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export function isMeaningfulCase(caseData: EndoCase, currentNodeId: string) {
  if (currentNodeId !== "preop") return true;
  if (hasText(caseData.patientNumber) || hasText(caseData.tooth) || !isNoTreatmentSelected(caseData.procedureType)) return true;
  if (hasText(caseData.caseStatus) || hasText(caseData.nextVisitPlan) || caseData.difficulty !== "none" || caseData.closure) return true;
  if (hasText(caseData.diagnosis?.pulpal) || hasText(caseData.diagnosis?.apical)) return true;

  const priorVisit = caseData.priorVisit;
  if (
    priorVisit?.continuedFromPriorVisit ||
    hasText(priorVisit?.priorVisitDate) ||
    priorVisit?.accessPreviouslyOpened ||
    priorVisit?.temporaryRestorationPresent ||
    hasText(priorVisit?.medicationPresent) ||
    priorVisit?.priorRadiographsAvailable ||
    hasText(priorVisit?.sourceNote)
  ) {
    return true;
  }

  const preOp = caseData.preOp;
  if (
    preOp.radiographsReviewed ||
    preOp.paReviewed ||
    preOp.bwReviewed ||
    preOp.cbctReviewed ||
    hasText(preOp.estimatedChamberDepth)
  ) {
    return true;
  }

  if ((caseData.globalEvents || []).length > 0 || caseData.canals.length > 1) return true;
  if ((caseData.workflowInstances || []).length > 0) return true;

  return caseData.canals.some((canal) => {
    if (canal.name !== "Main" || (canal.events || []).length > 0) return true;
    return Object.entries(canal).some(([field, value]) => {
      if (field === "name" || field === "events") return false;
      return hasText(value);
    });
  });
}

export function isMeaningfulSavedCaseSummary(summary: SavedCaseSummary) {
  if (typeof summary.meaningful === "boolean") return summary.meaningful;
  const hasPatientNumber = hasText(summary.patientNumber) && summary.patientNumber !== "No chart #";
  const hasTooth = hasText(summary.tooth) && summary.tooth !== "Tooth ___";
  return (
    hasPatientNumber ||
    hasTooth ||
    !isNoTreatmentSelected(summary.procedureType) ||
    summary.currentNodeId !== "preop" ||
    summary.canalCount > 1 ||
    summary.eventCount > 0
  );
}

export function getOtherMeaningfulSavedCases(
  savedCases: readonly SavedCaseSummary[],
  activeEncounterId: string
) {
  return savedCases.filter(
    (summary) => summary.id !== activeEncounterId && isMeaningfulSavedCaseSummary(summary)
  );
}
