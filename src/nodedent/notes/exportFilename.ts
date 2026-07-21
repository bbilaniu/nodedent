export function buildCaseExportFilename(patientNumber: string) {
  const safePatientNumber = patientNumber
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `nodedent-case-${safePatientNumber || "synthetic-patient"}.json`;
}
