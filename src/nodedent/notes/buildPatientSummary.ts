import type { EndoCase } from "../types";
import { isEndodonticProcedureType } from "../engine/deriveCaseStatus";
import { getOperativeRestorationEvents, isOperativeScopeRecordedEvent } from "../workflow/operative";

export function buildPatientSummary(caseData: EndoCase) {
  const tooth = caseData.tooth || "the tooth";
  if (!isEndodonticProcedureType(caseData.procedureType)) {
    if (getOperativeRestorationEvents(caseData).length) {
      return `Direct restoration treatment was documented for tooth ${tooth}. The clinician recorded the operative scope and restoration details.`;
    }
    if ((caseData.globalEvents || []).some(isOperativeScopeRecordedEvent)) {
      return `Direct restoration treatment was started for tooth ${tooth}. The clinician recorded the planned operative tooth and surface scope.`;
    }
    return `Direct restoration workflow was opened for tooth ${tooth}. The clinician may record operative scope and restoration details.`;
  }
  if ((caseData.globalEvents || []).some((event) => event.type === "medication.calciumHydroxidePlaced")) {
    return `Root canal treatment was started on tooth ${tooth}. The canals were cleaned as appropriate today, medication was placed, and a temporary filling was placed. Further treatment or referral may be needed.`;
  }
  if ((caseData.globalEvents || []).some((event) => event.type === "shaping.completed")) {
    return `Root canal treatment steps were performed on tooth ${tooth}. The canals were located, measured, cleaned, shaped, and disinfected according to the recorded workflow.`;
  }
  return `Endodontic treatment workflow was started for tooth ${tooth}. The clinician recorded procedural information to guide care and documentation.`;
}
