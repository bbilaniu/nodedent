import type { CapabilityName, DiagnosisRecord, EndoCase, WorkflowScopeKind } from "../types";

export type DiagnosisSectionId = "endodontic";
export type EndodonticDiagnosisFieldId = keyof DiagnosisRecord;
export type DiagnosisFieldId = string;
export type DiagnosisCaptureSurface = "panel" | "workflow";

export type DiagnosisFieldDefinition = {
  id: DiagnosisFieldId;
  label: string;
  placeholder: string;
};

export type DiagnosisSectionDefinition = {
  id: DiagnosisSectionId;
  label: string;
  disciplineLabel: string;
  description: string;
  captureSurface: DiagnosisCaptureSurface;
  capabilityName: CapabilityName;
  scopeKind: WorkflowScopeKind;
  completionPolicy: "anyField" | "allFields" | "custom";
  fields: readonly DiagnosisFieldDefinition[];
  readField: (caseData: EndoCase, fieldId: DiagnosisFieldId) => string;
  writeField: (caseData: EndoCase, fieldId: DiagnosisFieldId, value: string) => EndoCase;
  isRecorded: (caseData: EndoCase) => boolean;
  emptySummary: string;
  completeSummary: string;
};

function isEndodonticDiagnosisFieldId(fieldId: DiagnosisFieldId): fieldId is EndodonticDiagnosisFieldId {
  return fieldId === "pulpal" || fieldId === "apical";
}

export const endodonticDiagnosisSection: DiagnosisSectionDefinition = {
  id: "endodontic",
  label: "Endodontic diagnosis",
  disciplineLabel: "Endodontics",
  description: "Record the pulpal and apical diagnosis associated with the current endodontic treatment target.",
  captureSurface: "panel",
  capabilityName: "diagnosis.recorded",
  scopeKind: "tooth",
  completionPolicy: "anyField",
  fields: [
    { id: "pulpal", label: "Pulpal diagnosis", placeholder: "optional" },
    { id: "apical", label: "Apical diagnosis", placeholder: "optional" },
  ],
  readField: (caseData, fieldId) => isEndodonticDiagnosisFieldId(fieldId) ? caseData.diagnosis?.[fieldId] || "" : "",
  writeField: (caseData, fieldId, value) => isEndodonticDiagnosisFieldId(fieldId) ? {
    ...caseData,
    diagnosis: { ...(caseData.diagnosis || {}), [fieldId]: value },
  } : caseData,
  isRecorded: (caseData) => Boolean(
    caseData.diagnosis?.pulpal?.trim() || caseData.diagnosis?.apical?.trim()
  ),
  emptySummary: "No diagnosis recorded",
  completeSummary: "Pulpal and apical diagnoses recorded",
};

/**
 * Diagnosis sections are registered independently from executable workflows.
 * A future discipline must own its fields, storage adapter, readiness capability,
 * and scope instead of reusing the endodontic compatibility capability by default.
 */
export const diagnosisSectionRegistry = [endodonticDiagnosisSection] as const satisfies readonly DiagnosisSectionDefinition[];

export function getDiagnosisSection(sectionId: DiagnosisSectionId) {
  return diagnosisSectionRegistry.find((section) => section.id === sectionId);
}

export function getDiagnosisFieldValue(caseData: EndoCase, sectionId: DiagnosisSectionId, fieldId: DiagnosisFieldId) {
  const section = getDiagnosisSection(sectionId);
  if (!section || !section.fields.some((field) => field.id === fieldId)) return "";
  return section.readField(caseData, fieldId);
}

export function updateDiagnosisField(caseData: EndoCase, sectionId: DiagnosisSectionId, fieldId: DiagnosisFieldId, value: string) {
  const section = getDiagnosisSection(sectionId);
  if (!section || !section.fields.some((field) => field.id === fieldId)) return caseData;
  return section.writeField(caseData, fieldId, value);
}

export function getRecordedDiagnosisFieldIds(caseData: EndoCase, sectionId: DiagnosisSectionId) {
  const section = getDiagnosisSection(sectionId);
  if (!section) return [];
  return section.fields
    .filter((field) => getDiagnosisFieldValue(caseData, sectionId, field.id).trim().length > 0)
    .map((field) => field.id);
}

export function hasDiagnosisSectionRecord(caseData: EndoCase, sectionId: DiagnosisSectionId) {
  return getDiagnosisSection(sectionId)?.isRecorded(caseData) || false;
}

export function getDiagnosisSectionSummary(caseData: EndoCase, sectionId: DiagnosisSectionId) {
  const section = getDiagnosisSection(sectionId);
  if (!section) return "Diagnosis section unavailable";
  const recordedFieldIds = getRecordedDiagnosisFieldIds(caseData, sectionId);
  if (!recordedFieldIds.length) return section.emptySummary;
  if (recordedFieldIds.length === section.fields.length) return section.completeSummary;
  const field = section.fields.find((candidate) => candidate.id === recordedFieldIds[0]);
  return `${field?.label || "Diagnosis"} recorded`;
}

export const diagnosisWorkflowPromotionCriteria = [
  "The capture has a clinically meaningful ordered sequence rather than a grouped set of fields.",
  "The sequence needs resumable progress, branching, validation gates, or repeated events.",
  "The module must emit auditable events or outputs that downstream workflows consume.",
] as const;
