import type { CanalRecord } from "../types";

export function isBlank(value: unknown) {
  return value === undefined || value === null || String(value).trim() === "";
}

export function isPositiveMeasurement(value: unknown) {
  if (isBlank(value)) return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
}

export function formatLength(value: number) {
  if (!Number.isFinite(value)) return "";
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

export function getSuggestedLengths(canal?: CanalRecord | null) {
  const eal0 = Number(canal?.eal0);
  if (!Number.isFinite(eal0) || eal0 <= 0) return { patency: "", shaping: "" };
  return {
    patency: formatLength(eal0 + 1),
    shaping: formatLength(Math.max(eal0 - 1, 0)),
  };
}

export function isLikelyShape(value: unknown) {
  if (isBlank(value)) return false;
  const compact = String(value).trim().split(" ").join("");
  const parts = compact.split("/");
  if (parts.length !== 2) return false;
  const size = Number(parts[0]);
  const taper = parts[1];
  return Number.isFinite(size) && size > 0 && taper.startsWith(".") && Number.isFinite(Number(taper));
}

export function isValidFinalShape(value: unknown) {
  return isLikelyShape(value);
}

export function compactList(values: string[] = []) {
  return values.filter(Boolean).join(", ");
}

export function formatCanalMeasurements(canal: CanalRecord) {
  const bits = [];
  if (canal.estimatedWorkingLength) bits.push(`est WL ${canal.estimatedWorkingLength} mm`);
  if (canal.fileTerminalLength) bits.push(`10C terminal ${canal.fileTerminalLength} mm`);
  if (canal.availableTreatmentSpace) bits.push(`ATS ${canal.availableTreatmentSpace} mm`);
  if (canal.eal0) bits.push(`EAL0 ${canal.eal0} mm`);
  if (canal.patencyLength) bits.push(`patency ${canal.patencyLength} mm`);
  if (canal.shapingLength) bits.push(`shape ${canal.shapingLength} mm`);
  if (canal.finalShape) bits.push(`final ${canal.finalShape}`);
  if (canal.obturationGauge) bits.push(`gauge ${canal.obturationGauge}`);
  if (canal.masterCone) bits.push(`MC ${canal.masterCone}`);
  return bits.length ? `${canal.name}: ${bits.join("; ")}` : null;
}
