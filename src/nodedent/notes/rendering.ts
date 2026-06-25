import type { CanalRecord, ClinicalEvent, EndoCase } from "../types";
import { getCanalStatus, statusLabels } from "../engine/deriveCanalStatus";
import { isBlank } from "../engine/measurements";
import { protocolNodes } from "../protocol/nodes";
import { eventFragment } from "./fragments";

export function renderRecordedValue(value: unknown, fallback = "not recorded") {
  return isBlank(value) ? fallback : String(value).trim();
}

export function renderMeasurementValue(value: unknown, unit = "mm") {
  return isBlank(value) ? "not recorded" : `${String(value).trim()} ${unit}`;
}

export function renderReviewStatus(reviewed?: boolean) {
  return reviewed ? "reviewed" : "not recorded";
}

export function hasEventType(caseData: EndoCase, type: string) {
  return (caseData.globalEvents || []).some((event) => event.type === type);
}

export function groupClinicalEventsByPrefix(caseData: EndoCase, prefixes: string[], excludeTypes: string[] = []) {
  return (caseData.globalEvents || [])
    .filter((event) => prefixes.some((prefix) => event.type.startsWith(prefix)))
    .filter((event) => !excludeTypes.includes(event.type))
    .map(eventFragment);
}

function eventHasDifficultyFlag(event: ClinicalEvent) {
  const nodeId = event.nodeId || event.details?.nodeId;
  const decisionLabel = event.details?.decisionLabel;
  if (!nodeId || !decisionLabel) return false;
  const node = protocolNodes[nodeId];
  return Boolean(node?.options?.some((option) => option.label === decisionLabel && option.difficultyFlag));
}

function isDifficultyReasonEvent(event: ClinicalEvent) {
  return eventHasDifficultyFlag(event)
    || event.type.startsWith("difficulty.")
    || event.type === "treatment.referralSelected"
    || event.type === "treatment.referralRecommended"
    || event.type === "treatment.referralOnlyCompleted"
    || event.type === "canal.referred";
}

function formatDifficultyReason(event: ClinicalEvent) {
  const reason = event.details?.decisionLabel || eventFragment(event);
  const normalizedReason = String(reason).trim().replace(/[.。]+$/, "");
  const canal = event.canal && event.canal !== "All" && event.canal !== "N/A" ? `${event.canal}: ` : "";
  return `${canal}${normalizedReason}`;
}

export function getDifficultyReasonLines(caseData: EndoCase) {
  return (caseData.globalEvents || [])
    .filter(isDifficultyReasonEvent)
    .map(formatDifficultyReason);
}

export function getCompactDifficultyLine(caseData: EndoCase) {
  if (caseData.difficulty === "none") return null;
  const reasons = getDifficultyReasonLines(caseData);
  if (!reasons.length) return `Difficulty flag: ${caseData.difficulty}; reason not recorded.`;
  const suffix = reasons.length > 1 ? " Additional difficulty context in full note." : "";
  return `Difficulty flag: ${caseData.difficulty}; reason: ${reasons.at(-1)}.${suffix}`;
}

export function getFullDifficultyLines(caseData: EndoCase) {
  if (caseData.difficulty === "none") return [];
  const reasons = getDifficultyReasonLines(caseData);
  return [
    `Difficulty flag: ${caseData.difficulty}`,
    ...(reasons.length ? reasons.map((reason) => `Reason: ${reason}`) : ["Reason: not recorded"]),
  ];
}

function formatCanalFieldList(canals: CanalRecord[], field: keyof CanalRecord) {
  if (!canals.length) return "not recorded";
  return canals.map((canal) => `${canal.name}: ${renderRecordedValue(canal[field])}`).join("; ");
}

export function getCompactRadiographLines(caseData: EndoCase, options: { includeEndodonticStatuses?: boolean } = {}) {
  const paReviewed = caseData.preOp?.paReviewed ?? caseData.preOp?.radiographsReviewed;
  const canals = caseData.canals || [];
  const lines = [
    `Pre-op radiographs: PA ${renderReviewStatus(paReviewed)}; BW ${renderReviewStatus(caseData.preOp?.bwReviewed)}; CBCT ${renderReviewStatus(caseData.preOp?.cbctReviewed)}.`,
  ];

  if (options.includeEndodonticStatuses !== false) {
    lines.push(
      `WL PA: ${formatCanalFieldList(canals, "wlRadiographStatus")}.`,
      `Cone-fit PA: ${formatCanalFieldList(canals, "coneFitRadiograph")}.`,
      "Final obturation PA: not recorded.",
    );
  }

  return lines;
}

function isEalConventionRecorded(canal: CanalRecord) {
  const eal0 = Number(canal.eal0);
  const patency = Number(canal.patencyLength);
  const shaping = Number(canal.shapingLength);
  if (![eal0, patency, shaping].every(Number.isFinite)) return false;
  return patency === eal0 + 1 && shaping === eal0 - 1;
}

export function getFinalCanalSummaryLines(caseData: EndoCase) {
  const canals = caseData.canals || [];
  if (!canals.length) return [];

  const rows = [
    "Canal | Status | EAL0 | Patency | Shaping | Final file | Gauge | Master cone | WL PA | Cone-fit PA",
    ...canals.map((canal) => [
      canal.name,
      statusLabels[getCanalStatus(canal)],
      renderRecordedValue(canal.eal0),
      renderRecordedValue(canal.patencyLength),
      renderRecordedValue(canal.shapingLength),
      renderRecordedValue(canal.finalShape),
      renderRecordedValue(canal.obturationGauge),
      renderRecordedValue(canal.masterCone),
      renderRecordedValue(canal.wlRadiographStatus),
      renderRecordedValue(canal.coneFitRadiograph),
    ].join(" | ")),
  ];

  const conventionCanals = canals.filter(isEalConventionRecorded).map((canal) => canal.name);
  if (conventionCanals.length) {
    rows.push(`Length convention: ${conventionCanals.join(", ")} ${conventionCanals.length === 1 ? "shows" : "show"} shaping length 1 mm short of EAL0 and patency 1 mm beyond EAL0.`);
  }

  return rows;
}
