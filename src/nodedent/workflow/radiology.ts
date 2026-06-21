import type { CapabilitySatisfaction, ClinicalEvent, WorkflowScope } from "../types";

export const sharedRadiologyWorkflowId = "shared.radiology";
export const sharedRadiologyWorkflowVersion = "0.1.0";

export const radiologyEventTypes = {
  reviewed: "radiology.reviewed",
} as const;

export const radiologyModalities = ["pa", "bw", "cbct", "other"] as const;
export const radiologyRegionKinds = ["tooth", "teeth", "quadrant", "archSegment", "procedure", "custom"] as const;

export type RadiologyEventType = typeof radiologyEventTypes[keyof typeof radiologyEventTypes];
export type RadiologyModality = typeof radiologyModalities[number];
export type RadiologyRegionKind = typeof radiologyRegionKinds[number];

export type RadiologyEventDetails = {
  modalities?: RadiologyModality[];
  otherModalityLabel?: string;
  tooth?: string;
  teeth?: string[];
  regionKind?: RadiologyRegionKind;
  regionLabel?: string;
  procedureId?: string;
  imageDate?: string;
  sourceLabel?: string;
  limitations?: string;
  notes?: string;
};

const modalityLabels = {
  pa: "PA",
  bw: "BW",
  cbct: "CBCT",
  other: "Other",
} as const satisfies Record<RadiologyModality, string>;

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : undefined;
}

function normalizeEnum<T extends readonly string[]>(value: unknown, allowed: T): T[number] | undefined {
  const normalized = normalizeString(value);
  return normalized && (allowed as readonly string[]).includes(normalized) ? normalized as T[number] : undefined;
}

function normalizeModalities(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const modalities = value
    .map((item) => normalizeEnum(item, radiologyModalities))
    .filter(Boolean) as RadiologyModality[];
  return modalities.length ? [...new Set(modalities)] : undefined;
}

export function getRadiologyEventDetails(event: ClinicalEvent): RadiologyEventDetails {
  const details = event.details && typeof event.details === "object" ? event.details : {};
  return {
    modalities: normalizeModalities(details.modalities),
    otherModalityLabel: normalizeString(details.otherModalityLabel),
    tooth: normalizeString(details.tooth) || event.scope?.tooth || event.tooth,
    teeth: normalizeStringArray(details.teeth) || event.scope?.teeth,
    regionKind: normalizeEnum(details.regionKind, radiologyRegionKinds),
    regionLabel: normalizeString(details.regionLabel) || event.scope?.regionLabel,
    procedureId: normalizeString(details.procedureId) || event.scope?.procedureId,
    imageDate: normalizeString(details.imageDate),
    sourceLabel: normalizeString(details.sourceLabel),
    limitations: normalizeString(details.limitations),
    notes: normalizeString(details.notes),
  };
}

export function getRadiologyScopeFromDetails(details: RadiologyEventDetails, fallbackTooth?: string): WorkflowScope {
  if (details.teeth?.length) {
    return {
      kind: "custom",
      teeth: details.teeth,
      regionLabel: details.regionLabel,
      details: { regionKind: "teeth" },
    };
  }

  const tooth = details.tooth || fallbackTooth;
  if (details.regionKind === "tooth" && tooth) return { kind: "tooth", tooth };
  if (!details.regionKind && tooth) return { kind: "tooth", tooth };
  if (details.regionKind === "quadrant" || details.regionKind === "archSegment" || details.regionKind === "custom") {
    return { kind: details.regionKind, regionLabel: details.regionLabel };
  }
  if (details.regionKind === "procedure") {
    return { kind: "procedure", procedureId: details.procedureId, regionLabel: details.regionLabel };
  }
  if (details.regionLabel) return { kind: "custom", regionLabel: details.regionLabel };
  return { kind: "custom", label: "Radiology review scope not specified" };
}

export function getRadiologyScopeFromEvent(event: ClinicalEvent): WorkflowScope {
  return event.scope || getRadiologyScopeFromDetails(getRadiologyEventDetails(event), event.tooth);
}

export function buildRadiographsReviewedCapability(event: ClinicalEvent): CapabilitySatisfaction {
  return {
    name: "radiographs.reviewed",
    scope: getRadiologyScopeFromEvent(event),
    sourceEventId: event.id,
    workflowId: event.workflowId || sharedRadiologyWorkflowId,
    workflowRunId: event.workflowRunId,
    satisfiedAt: event.timestamp,
  };
}

export function getRadiographsReviewedCapabilityOutput(event: ClinicalEvent): CapabilitySatisfaction | undefined {
  return event.type === radiologyEventTypes.reviewed ? buildRadiographsReviewedCapability(event) : undefined;
}

export function isRadiologyReviewedEvent(event: ClinicalEvent) {
  return event.type === radiologyEventTypes.reviewed;
}

function formatModalities(details: RadiologyEventDetails) {
  const modalities = details.modalities?.map((modality) => modality === "other" && details.otherModalityLabel ? details.otherModalityLabel : modalityLabels[modality]);
  return modalities?.length ? modalities.join(", ") : "modality not specified";
}

function formatScope(scope: WorkflowScope) {
  if (scope.teeth?.length) return `teeth ${scope.teeth.join(", ")}`;
  if (scope.tooth) return `tooth ${scope.tooth}`;
  if (scope.regionLabel) return scope.regionLabel;
  if (scope.procedureId) return `procedure ${scope.procedureId}`;
  return scope.label || "scope not specified";
}

export function formatRadiologyEventFragment(event: ClinicalEvent) {
  const details = getRadiologyEventDetails(event);
  const scope = getRadiologyScopeFromEvent(event);
  const context = [
    `modalities: ${formatModalities(details)}`,
    formatScope(scope),
    details.imageDate ? `image date: ${details.imageDate}` : null,
    details.sourceLabel ? `source: ${details.sourceLabel}` : null,
    details.limitations ? `limitations: ${details.limitations}` : null,
  ].filter(Boolean).join("; ");
  return `Radiograph review recorded (${context})${details.notes ? `. Notes: ${details.notes}.` : "."}`;
}
