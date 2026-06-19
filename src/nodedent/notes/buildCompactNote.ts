import type { EndoCase } from "../types";
import { getCaseStatus } from "../engine/deriveCaseStatus";
import { formatCanalMeasurements } from "../engine/measurements";
import { getPriorVisitLines } from "./priorVisit";

export function buildCompactNote(caseData: EndoCase) {
  const canals = caseData.canals || [];
  const located = canals.map((canal) => canal.name).filter(Boolean);
  const measurements = canals.map(formatCanalMeasurements).filter(Boolean);
  const events = (caseData.globalEvents || []).map((event) => event.type);
  const note = [];
  note.push(`${caseData.tooth || "Tooth ___"} ${caseData.procedureType || "RCT"}.`);
  if (caseData.patientNumber) note.push(`Patient #: ${caseData.patientNumber}.`);
  note.push(`Visit status: ${getCaseStatus(caseData)}.`);
  const priorVisitLines = getPriorVisitLines(caseData);
  if (priorVisitLines.length) note.push(`Prior visit history: ${priorVisitLines.join(" ")}`);
  note.push("RD isolation planned/used as clinically appropriate.");
  if (caseData.preOp?.estimatedChamberDepth) note.push(`Estimated chamber depth ${caseData.preOp.estimatedChamberDepth} mm.`);
  if (events.some((type) => type.startsWith("access."))) note.push("Access completed/refined and chamber/canal negotiation documented.");
  if (located.length) note.push(`Canals: ${located.join("/")}.`);
  if (measurements.length) note.push(`WL/shape data: ${measurements.join(" | ")}.`);
  if (events.includes("smearLayer.edtaPlaced") || events.includes("smearLayer.edtaAgitated")) note.push("17% EDTA smear layer removal performed.");
  if (events.includes("disinfection.finalNaOClCompleted") || events.includes("disinfection.readyForObturation")) note.push("Final NaOCl disinfection completed.");
  if (events.includes("coneFit.radiographAcceptable")) note.push("Master cone fit confirmed radiographically.");
  if (events.includes("sealer.applied") || events.includes("sealer.reapplied")) note.push("Bioceramic sealer placed.");
  if (events.includes("gpSeating.coneSeated")) note.push("Pre-fit GP cone seated to shaping length.");
  if (events.includes("backfill.completed") || events.includes("backfill.compactedStable")) note.push("Thermoplastic GP backfill completed and compacted.");
  if (events.includes("medication.calciumHydroxidePlaced")) note.push("Calcium hydroxide placed.");
  if (events.includes("closure.temporary")) note.push("Access closed with sponge and temporary restorative material.");
  if (events.includes("closure.orificeBarrierTemporary")) note.push("Orifice barrier and temporary restoration placed.");
  if (events.includes("closure.finalRestoration")) note.push("Final restoration placed.");
  if (caseData.nextVisitPlan) note.push(`Next visit/plan: ${caseData.nextVisitPlan}.`);
  if (caseData.difficulty !== "none") note.push(`Difficulty flag: ${caseData.difficulty}.`);
  note.push("POIG.");
  return note.join(" ");
}
