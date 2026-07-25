import type { EndoCase } from "../types";

export function isAppointmentDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function appointmentDateFromTimestamp(timestamp?: string) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getAppointmentDate(
  caseData: Pick<EndoCase, "appointmentDate" | "createdAt">
) {
  if (isAppointmentDate(caseData.appointmentDate)) return caseData.appointmentDate;
  return appointmentDateFromTimestamp(caseData.createdAt);
}
