import type { EndoCase } from "../types";

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

export function deriveSuggestedCaseStatus(caseData: EndoCase) {
  const events = (caseData.globalEvents || []).map((event) => event.type);
  if (events.includes("treatment.referralRecommended") || events.includes("treatment.referralSelected") || events.includes("canal.referred")) return "Referred";
  if (events.includes("medication.calciumHydroxidePlaced") || events.includes("canal.medicated")) return "Medicated and temporized";
  if (events.includes("canal.paused")) return "Resume next visit";
  if (events.includes("closure.finalRestoration") || events.includes("closure.orificeBarrierTemporary") || events.includes("closure.temporary")) return "RCT completed";
  return events.length ? "RCT initiated" : "RCT planned";
}

export function getCaseStatus(caseData: EndoCase) {
  return caseData.caseStatus || deriveSuggestedCaseStatus(caseData);
}

export function hydrateCaseStatusOverride(caseData: Partial<EndoCase>) {
  if (!caseData?.caseStatus || caseData.caseStatus === "RCT planned") return "";
  return caseData.caseStatus;
}
