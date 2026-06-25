import type { EndoCase } from "../types";
import { getOutputCaseStatus, isEndodonticProcedureType } from "../engine/deriveCaseStatus";
import { getCanalStatus, statusLabels } from "../engine/deriveCanalStatus";
import { appendSection } from "./fragments";
import { buildCompactNote } from "./buildCompactNote";
import { getPriorVisitLines } from "./priorVisit";
import { getCapabilityStatus } from "../workflow/selectors";
import { getDiagnosisLines, getFinalCanalSummaryLines, getFullDifficultyLines, groupClinicalEventsByPrefix, hasEventType, renderMeasurementValue, renderRecordedValue } from "./rendering";

export function buildFullNote(caseData: EndoCase) {
  const lines: string[] = [];
  const isEndodonticProcedure = isEndodonticProcedureType(caseData.procedureType);
  const paReviewed = caseData.preOp?.paReviewed ?? caseData.preOp?.radiographsReviewed;
  const bwReviewed = caseData.preOp?.bwReviewed;
  const radiographStatus = getCapabilityStatus(
    caseData,
    "radiographs.reviewed",
    caseData.tooth ? { kind: "tooth", tooth: caseData.tooth } : undefined
  );
  const compatibilityRadiographFields = [
    paReviewed ? "PA" : null,
    bwReviewed ? "BW" : null,
    caseData.preOp?.cbctReviewed ? "CBCT" : null,
  ].filter(Boolean);
  lines.push(`${caseData.tooth || "Tooth ___"} ${caseData.procedureType || "RCT"}`);
  if (caseData.patientNumber) lines.push(`Patient #: ${caseData.patientNumber}`);
  lines.push(`Visit status: ${getOutputCaseStatus(caseData)}`);
  lines.push("");
  appendSection(lines, "Diagnosis / visit context:", [
    ...getDiagnosisLines(caseData),
    caseData.nextVisitPlan ? `Next visit / plan: ${caseData.nextVisitPlan}` : null,
  ].filter(Boolean) as string[]);
  appendSection(lines, "Pre-op:", [
    `Radiograph review: ${radiographStatus.summary}`,
    radiographStatus.reason ? `Radiograph context: ${radiographStatus.reason}` : null,
    compatibilityRadiographFields.length ? `Compatibility radiograph fields: ${compatibilityRadiographFields.join(", ")}` : null,
    caseData.preOp?.estimatedChamberDepth ? `Estimated chamber depth: ${caseData.preOp.estimatedChamberDepth} mm` : null,
  ].filter(Boolean) as string[]);
  appendSection(lines, "Prior visit history:", getPriorVisitLines(caseData));
  appendSection(lines, "Radiology:", groupClinicalEventsByPrefix(caseData, ["radiology."]));
  appendSection(lines, "Anesthesia:", groupClinicalEventsByPrefix(caseData, ["anesthesia."]));
  appendSection(lines, "Isolation:", groupClinicalEventsByPrefix(caseData, ["isolation."]));
  const restorationLines = groupClinicalEventsByPrefix(caseData, ["operative.", "finalRestoration."]);
  if (hasEventType(caseData, "closure.finalRestoration")) {
    restorationLines.push("Closure recorded as final restoration; material/details not recorded.");
  }
  appendSection(lines, "Restoration / operative details:", restorationLines);
  if (isEndodonticProcedure) {
    appendSection(lines, "Access / canals:", groupClinicalEventsByPrefix(caseData, ["access."]));
    const canalLines: string[] = [];
    caseData.canals.forEach((canal) => {
      canalLines.push(`${canal.name} (${statusLabels[getCanalStatus(canal)]})`);
      canalLines.push(`  ${canal.name} estimated WL: ${renderMeasurementValue(canal.estimatedWorkingLength)}`);
      canalLines.push(`  ${canal.name} 10C terminal length: ${renderMeasurementValue(canal.fileTerminalLength)}`);
      canalLines.push(`  ${canal.name} available treatment space: ${renderMeasurementValue(canal.availableTreatmentSpace)}`);
      canalLines.push(`  ${canal.name} reference point: ${renderRecordedValue(canal.referencePoint)}`);
      canalLines.push(`  ${canal.name} EAL 0: ${renderMeasurementValue(canal.eal0)}`);
      canalLines.push(`  ${canal.name} WL PA: ${renderRecordedValue(canal.wlRadiographStatus)}`);
      canalLines.push(`  ${canal.name} patency length: ${renderMeasurementValue(canal.patencyLength)}`);
      canalLines.push(`  ${canal.name} shaping length: ${renderMeasurementValue(canal.shapingLength)}`);
      canalLines.push(`  ${canal.name} final shaping file: ${renderRecordedValue(canal.finalShape)}`);
      canalLines.push(`  ${canal.name} obturation gauge: ${renderRecordedValue(canal.obturationGauge)}`);
      canalLines.push(`  ${canal.name} master cone: ${renderRecordedValue(canal.masterCone)}`);
      canalLines.push(`  ${canal.name} cone fit PA: ${renderRecordedValue(canal.coneFitRadiograph)}`);
    });
    appendSection(lines, "Canal measurements / status:", canalLines);
    appendSection(lines, "Final canal summary:", getFinalCanalSummaryLines(caseData));
    appendSection(lines, "Working length / glide path / shaping:", groupClinicalEventsByPrefix(caseData, ["scouting.", "workingLength.", "glidePath.", "shaping."], ["workingLength.established"]));
    appendSection(lines, "Irrigation / smear layer / disinfection:", groupClinicalEventsByPrefix(caseData, ["smearLayer.", "disinfection."]));
    appendSection(lines, "Cone fit / obturation:", groupClinicalEventsByPrefix(caseData, ["obturationGauge.", "coneFit.", "drying.", "sealer.", "gpSeating.", "downpack.", "backfill."]));
    appendSection(lines, "Closure:", groupClinicalEventsByPrefix(caseData, ["closure.", "medication."]));
    appendSection(lines, "Difficulty summary:", getFullDifficultyLines(caseData));
    appendSection(lines, "Difficulty / referral / canal controls:", groupClinicalEventsByPrefix(caseData, ["difficulty.", "treatment.", "canal."]));
  }
  lines.push("Compact note:");
  lines.push(buildCompactNote(caseData));
  return lines.join(String.fromCharCode(10));
}
