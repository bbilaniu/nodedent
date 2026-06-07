import type { EndoCase } from "../types";

export function buildPatientSummary(caseData: EndoCase) {
  const tooth = caseData.tooth || "the tooth";
  if ((caseData.globalEvents || []).some((event) => event.type === "medication.calciumHydroxidePlaced")) {
    return `Root canal treatment was started on tooth ${tooth}. The canals were cleaned as appropriate today, medication was placed, and a temporary filling was placed. Further treatment or referral may be needed.`;
  }
  if ((caseData.globalEvents || []).some((event) => event.type === "shaping.completed")) {
    return `Root canal treatment steps were performed on tooth ${tooth}. The canals were located, measured, cleaned, shaped, and disinfected according to the recorded workflow.`;
  }
  return `Endodontic treatment workflow was started for tooth ${tooth}. The clinician recorded procedural information to guide care and documentation.`;
}
