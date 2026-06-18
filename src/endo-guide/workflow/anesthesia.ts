import type { CapabilitySatisfaction, ClinicalEvent, WorkflowDefinition, WorkflowScope } from "../types";

export const sharedAnesthesiaWorkflowId = "shared.anesthesia";
export const sharedAnesthesiaWorkflowVersion = "0.1.0";

export const anesthesiaEventTypes = {
  administered: "anesthesia.administered",
  adequacyConfirmed: "anesthesia.adequacyConfirmed",
  topUpGiven: "anesthesia.topUpGiven",
  needsReassessment: "anesthesia.needsReassessment",
} as const;

export const anesthesiaRoutes = ["injection", "topical", "other"] as const;
export const anesthesiaAdequacyResponses = ["adequate", "partial", "notAdequate", "notAssessed"] as const;

export const anesthesiaAdequacyEventTypes = [
  anesthesiaEventTypes.adequacyConfirmed,
] as const;

export const anesthesiaInvalidatingEventTypes = [
  anesthesiaEventTypes.needsReassessment,
] as const;

export type AnesthesiaEventType = typeof anesthesiaEventTypes[keyof typeof anesthesiaEventTypes];
export type AnesthesiaRoute = typeof anesthesiaRoutes[number];
export type AnesthesiaAdequacyResponse = typeof anesthesiaAdequacyResponses[number];

export type AnesthesiaEventDetails = {
  route?: AnesthesiaRoute;
  routeLabel?: string;
  agentLabel?: string;
  technique?: string;
  applicationType?: string;
  site?: string;
  dose?: string;
  doseUnit?: string;
  administeredAt?: string;
  vasoconstrictor?: string;
  response?: AnesthesiaAdequacyResponse;
  notes?: string;
  reason?: string;
  tooth?: string;
  teeth?: string[];
  regionLabel?: string;
};

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

export function isAnesthesiaRoute(value: unknown): value is AnesthesiaRoute {
  return Boolean(normalizeEnum(value, anesthesiaRoutes));
}

export function isAnesthesiaAdequacyResponse(value: unknown): value is AnesthesiaAdequacyResponse {
  return Boolean(normalizeEnum(value, anesthesiaAdequacyResponses));
}

export function isAdequateAnesthesiaResponse(value: unknown): value is "adequate" {
  return normalizeEnum(value, anesthesiaAdequacyResponses) === "adequate";
}

export function getAnesthesiaEventDetails(event: ClinicalEvent): AnesthesiaEventDetails {
  const details = event.details && typeof event.details === "object" ? event.details : {};
  return {
    route: normalizeEnum(details.route, anesthesiaRoutes),
    routeLabel: normalizeString(details.routeLabel),
    agentLabel: normalizeString(details.agentLabel),
    technique: normalizeString(details.technique),
    applicationType: normalizeString(details.applicationType),
    site: normalizeString(details.site),
    dose: normalizeString(details.dose),
    doseUnit: normalizeString(details.doseUnit),
    administeredAt: normalizeString(details.administeredAt),
    vasoconstrictor: normalizeString(details.vasoconstrictor),
    response: normalizeEnum(details.response, anesthesiaAdequacyResponses),
    notes: normalizeString(details.notes),
    reason: normalizeString(details.reason),
    tooth: normalizeString(details.tooth) || event.tooth,
    teeth: normalizeStringArray(details.teeth),
    regionLabel: normalizeString(details.regionLabel) || event.scope?.regionLabel,
  };
}

export function getAnesthesiaScopeFromDetails(details: AnesthesiaEventDetails, fallbackTooth?: string): WorkflowScope {
  if (details.teeth?.length) {
    return {
      kind: "custom",
      teeth: details.teeth,
      regionLabel: details.regionLabel,
    };
  }

  const tooth = details.tooth || fallbackTooth;
  if (tooth) return { kind: "tooth", tooth };
  if (details.regionLabel) return { kind: "custom", regionLabel: details.regionLabel };
  return { kind: "custom", label: "Anesthesia scope not specified" };
}

export function getAnesthesiaScopeFromEvent(event: ClinicalEvent): WorkflowScope {
  return event.scope || getAnesthesiaScopeFromDetails(getAnesthesiaEventDetails(event), event.tooth);
}

export function buildAnesthesiaAdequateCapability(event: ClinicalEvent): CapabilitySatisfaction {
  return {
    name: "anesthesia.adequate",
    scope: getAnesthesiaScopeFromEvent(event),
    sourceEventId: event.id,
    workflowId: event.workflowId || sharedAnesthesiaWorkflowId,
    workflowRunId: event.workflowRunId,
    satisfiedAt: event.timestamp,
    expiresAt: event.expiresAt,
  };
}

export function getAnesthesiaAdequateCapabilityOutput(event: ClinicalEvent): CapabilitySatisfaction | undefined {
  if (event.type === anesthesiaEventTypes.adequacyConfirmed) return buildAnesthesiaAdequateCapability(event);
  if (event.type === anesthesiaEventTypes.topUpGiven && isAdequateAnesthesiaResponse(getAnesthesiaEventDetails(event).response)) {
    return buildAnesthesiaAdequateCapability(event);
  }
  return undefined;
}

function formatDose(details: AnesthesiaEventDetails) {
  if (details.dose && details.doseUnit) return `${details.dose} ${details.doseUnit}`;
  return details.dose || details.doseUnit || "";
}

function formatRoute(details: AnesthesiaEventDetails) {
  if (details.route === "other" && details.routeLabel) return `route: ${details.routeLabel}`;
  return details.route ? `route: ${details.route}` : null;
}

function formatAnesthesiaContext(details: AnesthesiaEventDetails) {
  return [
    formatRoute(details),
    details.agentLabel,
    details.technique,
    details.applicationType,
    details.site,
    formatDose(details),
    details.administeredAt ? `time: ${details.administeredAt}` : null,
    details.vasoconstrictor ? `vasoconstrictor: ${details.vasoconstrictor}` : null,
  ].filter(Boolean).join("; ");
}

function formatReassessAfter(event: ClinicalEvent) {
  return event.expiresAt ? ` Reassess after: ${event.expiresAt}.` : "";
}

export function formatAnesthesiaEventFragment(event: ClinicalEvent) {
  const details = getAnesthesiaEventDetails(event);
  const context = formatAnesthesiaContext(details);
  const suffix = context ? ` (${context})` : "";
  const response = details.response ? ` Response: ${details.response}.` : "";
  const reassessAfter = formatReassessAfter(event);

  if (event.type === anesthesiaEventTypes.administered) {
    return `Anesthesia administered${suffix}.${response}${reassessAfter}`;
  }
  if (event.type === anesthesiaEventTypes.adequacyConfirmed) {
    return `Anesthesia adequacy confirmed${suffix}.${response}${reassessAfter}`;
  }
  if (event.type === anesthesiaEventTypes.topUpGiven) {
    return `Anesthesia top-up recorded${suffix}.${response}${reassessAfter}`;
  }
  if (event.type === anesthesiaEventTypes.needsReassessment) {
    return `Anesthesia needs reassessment${details.reason ? `: ${details.reason}` : ""}.`;
  }
  return `${event.type}.`;
}

export const sharedAnesthesiaWorkflow: WorkflowDefinition = {
  workflowId: sharedAnesthesiaWorkflowId,
  version: sharedAnesthesiaWorkflowVersion,
  discipline: "shared",
  title: "Anesthesia",
  entryNodeIds: ["anesthesia-record"],
  completionNodeIds: ["anesthesia-complete", "anesthesia-needs-reassessment"],
  supportedScopes: ["tooth", "quadrant", "sextant", "archSegment", "custom"],
  nodes: {
    "anesthesia-record": {
      id: "anesthesia-record",
      workflowId: sharedAnesthesiaWorkflowId,
      phase: "Anesthesia",
      title: "Record anesthesia status",
      chairsideInstruction: "Record anesthesia documentation and explicitly confirm adequacy only when the clinician has assessed it.",
      requiredInputs: ["Scope", "Adequacy response"],
      options: [
        { label: "Anesthesia administered", nextNodeId: "anesthesia-record", noteEvent: { type: anesthesiaEventTypes.administered } },
        { label: "Adequacy confirmed", nextNodeId: "anesthesia-complete", noteEvent: { type: anesthesiaEventTypes.adequacyConfirmed } },
        { label: "Needs reassessment", nextNodeId: "anesthesia-needs-reassessment", noteEvent: { type: anesthesiaEventTypes.needsReassessment } },
      ],
    },
    "anesthesia-complete": {
      id: "anesthesia-complete",
      workflowId: sharedAnesthesiaWorkflowId,
      phase: "Anesthesia",
      title: "Anesthesia status recorded",
      chairsideInstruction: "Anesthesia adequacy is available to parent workflows for the recorded scope until reassessment is recorded or the capability expires.",
      options: [{ label: "Return to parent workflow", nextNodeId: "anesthesia-complete" }],
    },
    "anesthesia-needs-reassessment": {
      id: "anesthesia-needs-reassessment",
      workflowId: sharedAnesthesiaWorkflowId,
      phase: "Anesthesia",
      title: "Anesthesia needs reassessment",
      chairsideInstruction: "Record a top-up or other reassessment event before a parent workflow relies on anesthesia adequacy.",
      options: [
        { label: "Top-up recorded", nextNodeId: "anesthesia-complete", noteEvent: { type: anesthesiaEventTypes.topUpGiven } },
        { label: "Still needs reassessment", nextNodeId: "anesthesia-needs-reassessment", noteEvent: { type: anesthesiaEventTypes.needsReassessment } },
      ],
    },
  },
};
