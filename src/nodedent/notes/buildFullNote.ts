import type { EndoCase } from "../types";
import { getCaseStatus } from "../engine/deriveCaseStatus";
import { getCanalStatus, statusLabels } from "../engine/deriveCanalStatus";
import { appendSection, groupEventsByPrefix } from "./fragments";
import { buildCompactNote } from "./buildCompactNote";
import { getPriorVisitLines } from "./priorVisit";
import { getCapabilityStatus } from "../workflow/selectors";

export function buildFullNote(caseData: EndoCase) {
  const lines: string[] = [];
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
  lines.push(`Visit status: ${getCaseStatus(caseData)}`);
  if (caseData.autosavedAt) lines.push(`Autosaved: ${new Date(caseData.autosavedAt).toLocaleString()}`);
  lines.push("");
  appendSection(lines, "Diagnosis / visit context:", [
    caseData.diagnosis?.pulpal ? `Pulpal diagnosis: ${caseData.diagnosis.pulpal}` : null,
    caseData.diagnosis?.apical ? `Apical diagnosis: ${caseData.diagnosis.apical}` : null,
    caseData.nextVisitPlan ? `Next visit / plan: ${caseData.nextVisitPlan}` : null,
  ].filter(Boolean) as string[]);
  appendSection(lines, "Pre-op:", [
    `Radiograph review: ${radiographStatus.summary}`,
    radiographStatus.reason ? `Radiograph context: ${radiographStatus.reason}` : null,
    compatibilityRadiographFields.length ? `Compatibility radiograph fields: ${compatibilityRadiographFields.join(", ")}` : null,
    caseData.preOp?.estimatedChamberDepth ? `Estimated chamber depth: ${caseData.preOp.estimatedChamberDepth} mm` : null,
  ].filter(Boolean) as string[]);
  appendSection(lines, "Prior visit history:", getPriorVisitLines(caseData));
  appendSection(lines, "Radiology:", groupEventsByPrefix(caseData, ["radiology."]));
  appendSection(lines, "Anesthesia:", groupEventsByPrefix(caseData, ["anesthesia."]));
  appendSection(lines, "Isolation:", groupEventsByPrefix(caseData, ["isolation."]));
  appendSection(lines, "Operative:", groupEventsByPrefix(caseData, ["operative.", "finalRestoration."]));
  appendSection(lines, "Access / canals:", groupEventsByPrefix(caseData, ["access."]));
  const canalLines: string[] = [];
  caseData.canals.forEach((canal) => {
    canalLines.push(`${canal.name} (${statusLabels[getCanalStatus(canal)]})`);
    if (canal.estimatedWorkingLength) canalLines.push(`  ${canal.name} estimated WL: ${canal.estimatedWorkingLength} mm`);
    if (canal.availableTreatmentSpace) canalLines.push(`  ${canal.name} available treatment space: ${canal.availableTreatmentSpace} mm`);
    if (canal.referencePoint) canalLines.push(`  ${canal.name} reference point: ${canal.referencePoint}`);
    if (canal.eal0) canalLines.push(`  ${canal.name} EAL 0: ${canal.eal0} mm`);
    if (canal.wlRadiographStatus) canalLines.push(`  ${canal.name} WL PA: ${canal.wlRadiographStatus}`);
    if (canal.patencyLength) canalLines.push(`  ${canal.name} patency length: ${canal.patencyLength} mm`);
    if (canal.shapingLength) canalLines.push(`  ${canal.name} shaping length: ${canal.shapingLength} mm`);
    if (canal.finalShape) canalLines.push(`  ${canal.name} final shaping file: ${canal.finalShape}`);
    if (canal.obturationGauge) canalLines.push(`  ${canal.name} obturation gauge: ${canal.obturationGauge}`);
    if (canal.masterCone) canalLines.push(`  ${canal.name} master cone: ${canal.masterCone}`);
    if (canal.coneFitRadiograph) canalLines.push(`  ${canal.name} cone fit PA: ${canal.coneFitRadiograph}`);
  });
  appendSection(lines, "Canal measurements / status:", canalLines);
  appendSection(lines, "Working length / glide path / shaping:", groupEventsByPrefix(caseData, ["scouting.", "workingLength.", "glidePath.", "shaping."]));
  appendSection(lines, "Irrigation / smear layer / disinfection:", groupEventsByPrefix(caseData, ["smearLayer.", "disinfection."]));
  appendSection(lines, "Cone fit / obturation:", groupEventsByPrefix(caseData, ["obturationGauge.", "coneFit.", "drying.", "sealer.", "gpSeating.", "downpack.", "backfill."]));
  appendSection(lines, "Closure:", groupEventsByPrefix(caseData, ["closure.", "medication."]));
  appendSection(lines, "Difficulty / referral / canal controls:", groupEventsByPrefix(caseData, ["difficulty.", "treatment.", "canal.", "workflow."]));
  lines.push("Compact note:");
  lines.push(buildCompactNote(caseData));
  return lines.join(String.fromCharCode(10));
}
