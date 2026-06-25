import type { CanalRecord, EndoCase } from "../types";
import { getCanalStatus, statusLabels } from "../engine/deriveCanalStatus";
import { isBlank } from "../engine/measurements";
import { eventFragment } from "./fragments";

export function renderRecordedValue(value: unknown, fallback = "not recorded") {
  return isBlank(value) ? fallback : String(value).trim();
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
