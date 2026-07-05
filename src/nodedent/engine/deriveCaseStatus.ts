import type { EndoCase } from "../types";
import { isNoTreatmentSelected, noTreatmentSelectedProcedure } from "../workflow/procedures";

export const difficultyStyles = {
  none: "bg-brand-mint/10 text-brand-navy border-brand-mint/40",
  caution: "bg-amber-50 text-amber-900 border-amber-200",
  high: "bg-orange-50 text-orange-900 border-orange-200",
  refer: "bg-red-50 text-red-900 border-red-200",
};

export const difficultyLabels = {
  none: "Green · routine pathway",
  caution: "Yellow · proceed with caution",
  high: "Orange · high difficulty",
  refer: "Red · consider temporization/referral",
};

const suggestedStatusLabels = new Set([
  noTreatmentSelectedProcedure,
  "RCT planned",
  "Retreatment planned",
  "Emergency pulpectomy planned",
  "Direct restoration planned",
]);

export function deriveSuggestedCaseStatus(caseData: EndoCase) {
  const events = (caseData.globalEvents || [])
    .map((event) => event.type)
    .filter((type) => !type.startsWith("radiology.") && !type.startsWith("anesthesia.") && !type.startsWith("isolation.") && !type.startsWith("operative.") && !type.startsWith("finalRestoration."));
  if (!events.length && isNoTreatmentSelected(caseData.procedureType)) return noTreatmentSelectedProcedure;
  if (events.includes("treatment.referralRecommended") || events.includes("treatment.referralSelected") || events.includes("canal.referred")) return "Referred";
  if (events.includes("medication.calciumHydroxidePlaced") || events.includes("canal.medicated")) return "Medicated and temporized";
  if (events.includes("canal.paused")) return "Resume next visit";
  if (events.includes("closure.finalRestoration") || events.includes("closure.orificeBarrierTemporary") || events.includes("closure.temporary")) return "RCT completed";
  return events.length ? "RCT initiated" : `${caseData.procedureType || "Treatment"} planned`;
}

export function getCaseStatus(caseData: EndoCase) {
  if (!caseData.caseStatus || suggestedStatusLabels.has(caseData.caseStatus)) return deriveSuggestedCaseStatus(caseData);
  return caseData.caseStatus;
}

export function hydrateCaseStatusOverride(caseData: Partial<EndoCase>) {
  if (!caseData?.caseStatus || suggestedStatusLabels.has(caseData.caseStatus)) return "";
  return caseData.caseStatus;
}
