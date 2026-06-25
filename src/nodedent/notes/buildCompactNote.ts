import type { EndoCase } from "../types";
import { getOutputCaseStatus, isEndodonticProcedureType } from "../engine/deriveCaseStatus";
import { formatCanalMeasurements } from "../engine/measurements";
import {
  formatOperativeRestorationEventFragment,
  formatOperativeSetupEventFragment,
  getOperativeRestorationEvents,
  isOperativeScopeRecordedEvent,
} from "../workflow/operative";
import { getPriorVisitLines } from "./priorVisit";
import { getCompactRadiographLines, groupClinicalEventsByPrefix } from "./rendering";

export function buildCompactNote(caseData: EndoCase) {
  const canals = caseData.canals || [];
  const located = canals.map((canal) => canal.name).filter(Boolean);
  const measurements = canals.map(formatCanalMeasurements).filter(Boolean);
  const events = (caseData.globalEvents || []).map((event) => event.type);
  const latestOperativeSetupEvent = (caseData.globalEvents || []).filter(isOperativeScopeRecordedEvent).at(-1);
  const operativeRestorationEvents = getOperativeRestorationEvents(caseData);
  const isEndodonticProcedure = isEndodonticProcedureType(caseData.procedureType);
  const note = [];
  note.push(`${caseData.tooth || "Tooth ___"} ${caseData.procedureType || "RCT"}.`);
  if (caseData.patientNumber) note.push(`Patient #: ${caseData.patientNumber}.`);
  note.push(`Visit status: ${getOutputCaseStatus(caseData)}.`);
  const priorVisitLines = getPriorVisitLines(caseData);
  if (priorVisitLines.length) note.push(`Prior visit history: ${priorVisitLines.join(" ")}`);
  const anesthesiaLines = groupClinicalEventsByPrefix(caseData, ["anesthesia."]);
  const isolationLines = groupClinicalEventsByPrefix(caseData, ["isolation."]);
  note.push(anesthesiaLines.length ? `Anesthesia: ${anesthesiaLines.join(" ")}` : "Anesthesia: not recorded.");
  note.push(isolationLines.length ? `Isolation: ${isolationLines.join(" ")}` : "Isolation: not recorded.");
  getCompactRadiographLines(caseData, { includeEndodonticStatuses: isEndodonticProcedure }).forEach((line) => note.push(line));
  if (caseData.preOp?.estimatedChamberDepth) note.push(`Estimated chamber depth ${caseData.preOp.estimatedChamberDepth} mm.`);
  if (isEndodonticProcedure) {
    if (events.some((type) => type.startsWith("access."))) note.push("Access completed/refined and chamber/canal negotiation documented.");
    if (located.length) note.push(`Canals: ${located.join("/")}.`);
    if (measurements.length) note.push(`WL/shape data: ${measurements.join(" | ")}.`);
    if (events.includes("smearLayer.edtaPlaced") || events.includes("smearLayer.edtaAgitated")) note.push("17% EDTA smear layer removal performed.");
    if (events.includes("disinfection.finalNaOClCompleted") || events.includes("disinfection.readyForObturation")) note.push("Final NaOCl disinfection completed.");
    if (events.includes("sealer.applied") || events.includes("sealer.reapplied")) note.push("Bioceramic sealer placed.");
    if (events.includes("gpSeating.coneSeated")) note.push("Pre-fit GP cone seated to shaping length.");
    if (events.includes("backfill.completed") || events.includes("backfill.compactedStable")) note.push("Thermoplastic GP backfill completed and compacted.");
    if (events.includes("medication.calciumHydroxidePlaced")) note.push("Calcium hydroxide placed.");
    if (events.includes("closure.temporary")) note.push("Access closed with sponge and temporary restorative material.");
    if (events.includes("closure.orificeBarrierTemporary")) note.push("Orifice barrier and temporary restoration placed.");
    if (events.includes("closure.finalRestoration")) note.push("Closure recorded as final restoration; material/details not recorded.");
  }
  if (latestOperativeSetupEvent) note.push(formatOperativeSetupEventFragment(latestOperativeSetupEvent));
  operativeRestorationEvents.forEach((event) => note.push(formatOperativeRestorationEventFragment(event)));
  if (caseData.nextVisitPlan) note.push(`Next visit/plan: ${caseData.nextVisitPlan}.`);
  if (caseData.difficulty !== "none") note.push(`Difficulty flag: ${caseData.difficulty}.`);
  note.push("POIG.");
  return note.join(" ");
}
