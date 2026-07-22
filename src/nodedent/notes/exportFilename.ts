import type { EndoCase } from "../types";

const disciplineByProcedure: Record<string, string> = {
  RCT: "ENDO",
  Retreatment: "ENDO",
  "Emergency pulpectomy": "ENDO",
  "Direct restoration": "OPERATIVE",
};

export function sanitizeFilenameSegment(value: string, fallback: string) {
  const sanitized = value
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return sanitized || fallback;
}

export function getCaseDisciplineCode(caseData: Pick<EndoCase, "procedureType">) {
  return disciplineByProcedure[caseData.procedureType] || "GENERAL";
}

function formatFilenameDate(value?: string) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isFinite(date.getTime()) ? date : new Date();
  return [safeDate.getFullYear(), safeDate.getMonth() + 1, safeDate.getDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("_");
}

export function buildClinicalExportFilename(
  caseData: Pick<EndoCase, "patientNumber" | "procedureType" | "encounterId" | "createdAt">,
  extension: "json" | "txt" = "json"
) {
  const date = formatFilenameDate(caseData.createdAt);
  const chartNumber = sanitizeFilenameSegment(caseData.patientNumber, "NO-CHART");
  const discipline = getCaseDisciplineCode(caseData);
  const encounterSuffix = sanitizeFilenameSegment(caseData.encounterId.replaceAll("-", "").slice(0, 6).toUpperCase(), "CASE");
  return `${date}_${chartNumber}_${discipline}_${encounterSuffix}.${extension}`;
}

export function buildVaultBackupFilename(now = new Date()) {
  return `nodedent_encrypted_vault_${formatFilenameDate(now.toISOString())}.nodedent`;
}
