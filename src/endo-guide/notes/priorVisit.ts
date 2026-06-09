import type { EndoCase } from "../types";
import { priorCanalStatusLabels } from "../engine/resume";

export function getPriorVisitLines(caseData: EndoCase) {
  const prior = caseData.priorVisit;
  const canalLines = (caseData.canals || [])
    .filter((canal) => canal.priorVisitStatus || canal.priorVisitNote)
    .map((canal) => {
      const status = canal.priorVisitStatus ? priorCanalStatusLabels[canal.priorVisitStatus] : "Prior status not set";
      return `${canal.name}: ${status}${canal.priorVisitNote ? `; ${canal.priorVisitNote}` : ""}`;
    });

  if (!prior?.continuedFromPriorVisit && !canalLines.length) return [];

  return [
    "Continued from prior visit / outside system.",
    prior?.priorVisitDate ? `Prior visit date/timing: ${prior.priorVisitDate}` : null,
    prior?.accessPreviouslyOpened ? "Access previously opened." : null,
    prior?.temporaryRestorationPresent ? "Temporary restoration present at start of system-tracked visit." : null,
    prior?.medicationPresent ? `Medication present: ${prior.medicationPresent}.` : null,
    prior?.priorRadiographsAvailable ? "Prior radiographs/notes available." : null,
    prior?.sourceNote ? `Prior history note/source: ${prior.sourceNote}` : null,
    ...canalLines,
  ].filter(Boolean) as string[];
}
