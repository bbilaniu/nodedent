import type { CapabilityName, CapabilityRequirement, ClinicalEvent, EndoCase, WorkflowDefinition, WorkflowModuleCall, WorkflowScope } from "../types";
import { sharedAnesthesiaWorkflowId } from "./anesthesia";
import { sharedIsolationWorkflowId } from "./isolation";

export const sharedDiagnosisWorkflowId = "shared.diagnosis";
export const operativeDirectRestorationWorkflowId = "operative.direct-restoration";
export const operativeDirectRestorationWorkflowVersion = "0.1.0";
export const operativeScopeRecordedEventType = "operative.scope.recorded";

export type OperativeWorkflowSetupState = {
  tooth: string;
  surfaces: string;
  restorationIntent: string;
  material: string;
  shade: string;
};

export type OperativeScopeRecordedDetails = {
  tooth?: string;
  surfaces?: string[];
  restorationIntent?: string;
  material?: string;
  shade?: string;
};

export type OperativeSurfaceScopeInput = {
  tooth?: string;
  surface?: string;
  surfaces?: string | string[];
  procedureId?: string;
  label?: string;
};

export const blankOperativeWorkflowSetup: OperativeWorkflowSetupState = {
  tooth: "",
  surfaces: "",
  restorationIntent: "",
  material: "",
  shade: "",
};

export const operativeReadinessCapabilityRequirements: CapabilityRequirement[] = [
  { name: "diagnosis.recorded", scopeKind: "tooth", message: "Diagnosis recorded for the planned tooth" },
  { name: "radiographs.reviewed", scopeKind: "tooth", message: "Radiographs reviewed for the planned tooth" },
  { name: "anesthesia.adequate", scopeKind: "tooth", allowReassessment: true, message: "Current-visit anesthesia adequacy can be recorded for the planned tooth when needed" },
  { name: "isolation.established", scopeKind: "tooth", allowReassessment: true, message: "Current-visit isolation can be recorded for the planned tooth when needed" },
];

export const operativeReadinessModuleCalls: WorkflowModuleCall[] = [
  {
    workflowId: sharedDiagnosisWorkflowId,
    title: "Diagnosis",
    reason: "Provides reusable diagnosis and radiograph review context for the operative workflow when that context is not already available.",
    returnedCapabilities: ["diagnosis.recorded", "radiographs.reviewed"],
  },
  {
    workflowId: sharedAnesthesiaWorkflowId,
    title: "Anesthesia",
    reason: "Provides current-visit anesthesia adequacy context when the clinician needs to record or refresh it.",
    returnedCapabilities: ["anesthesia.adequate"],
  },
  {
    workflowId: sharedIsolationWorkflowId,
    title: "Isolation",
    reason: "Provides current-visit isolation status when the clinician needs to record or refresh it.",
    returnedCapabilities: ["isolation.established"],
  },
];

export const operativeRestorationOutputCapabilities = ["finalRestoration.placed"] as const satisfies readonly CapabilityName[];
export const operativeRestorationCompletionRequirements: CapabilityRequirement[] = [
  { name: "finalRestoration.placed", scopeKind: "surface", message: "Final restoration recorded for the planned tooth and surface scope" },
];

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.flatMap((item) => normalizeString(item)).filter(Boolean) : [];
}

const compactSurfaceCodeCharacters = new Set(["M", "O", "D", "B", "L", "I", "F", "P"]);

function splitSurfaceToken(token: string) {
  const trimmed = token.trim();
  if (!trimmed) return [];

  const upper = trimmed.toUpperCase();
  const isCompactNotation = /^[A-Z]{2,6}$/.test(upper) && Array.from(upper).every((character) => compactSurfaceCodeCharacters.has(character));
  if (isCompactNotation) return Array.from(upper);

  return /^[A-Za-z]$/.test(trimmed) ? [upper] : [trimmed];
}

export function normalizeOperativeSurfaces(input?: string | readonly string[] | null) {
  const tokens = Array.isArray(input)
    ? input.flatMap((value) => String(value || "").split(/[,\s/]+/))
    : String(input || "").split(/[,\s/]+/);
  const seen = new Set<string>();

  return tokens
    .flatMap(splitSurfaceToken)
    .filter((surface) => {
      if (!surface || seen.has(surface)) return false;
      seen.add(surface);
      return true;
    });
}

function displaySurfaces(surfaces: readonly string[]) {
  return surfaces.join(" ");
}

function scopeLabel(tooth: string, surfaces: readonly string[]) {
  return [tooth, surfaces.join("")].filter(Boolean).join(" ");
}

export function createOperativeSurfaceScope(input: OperativeSurfaceScopeInput): WorkflowScope {
  const tooth = normalizeString(input.tooth);
  const surfaces = normalizeOperativeSurfaces(input.surfaces?.length ? input.surfaces : input.surface);

  return {
    kind: "surface",
    tooth: tooth || undefined,
    procedureId: input.procedureId,
    surface: surfaces[0],
    surfaces: surfaces.length > 1 ? surfaces : undefined,
    label: input.label || scopeLabel(tooth, surfaces),
  };
}

export function createOperativeSetupScope(setup: OperativeWorkflowSetupState, fallbackTooth = "") {
  return createOperativeSurfaceScope({
    tooth: normalizeString(setup.tooth) || normalizeString(fallbackTooth),
    surfaces: setup.surfaces,
  });
}

export function buildOperativeSetupEventDetails(setup: OperativeWorkflowSetupState, fallbackTooth = ""): OperativeScopeRecordedDetails {
  const tooth = normalizeString(setup.tooth) || normalizeString(fallbackTooth);
  const surfaces = normalizeOperativeSurfaces(setup.surfaces);
  const details: OperativeScopeRecordedDetails = {};

  if (tooth) details.tooth = tooth;
  if (surfaces.length) details.surfaces = surfaces;
  if (normalizeString(setup.restorationIntent)) details.restorationIntent = normalizeString(setup.restorationIntent);
  if (normalizeString(setup.material)) details.material = normalizeString(setup.material);
  if (normalizeString(setup.shade)) details.shade = normalizeString(setup.shade);

  return details;
}

export function isOperativeScopeRecordedEvent(
  event?: ClinicalEvent | null
): event is ClinicalEvent & { type: typeof operativeScopeRecordedEventType; workflowId: typeof operativeDirectRestorationWorkflowId } {
  return event?.type === operativeScopeRecordedEventType && event.workflowId === operativeDirectRestorationWorkflowId;
}

export function getOperativeSetupFromEvent(event?: ClinicalEvent | null): OperativeWorkflowSetupState {
  if (!isOperativeScopeRecordedEvent(event)) return { ...blankOperativeWorkflowSetup };

  const details = event.details && typeof event.details === "object" ? event.details : {};
  const surfaces = normalizeOperativeSurfaces(
    Array.isArray(details.surfaces)
      ? normalizeStringArray(details.surfaces)
      : normalizeString(details.surfaces) || event.scope?.surfaces || event.scope?.surface
  );

  return {
    tooth: normalizeString(details.tooth) || normalizeString(event.scope?.tooth),
    surfaces: displaySurfaces(surfaces),
    restorationIntent: normalizeString(details.restorationIntent),
    material: normalizeString(details.material),
    shade: normalizeString(details.shade),
  };
}

export function getLatestOperativeWorkflowSetup(caseData: Pick<EndoCase, "globalEvents">): OperativeWorkflowSetupState {
  const latestEvent = (caseData.globalEvents || []).filter(isOperativeScopeRecordedEvent).at(-1);
  return getOperativeSetupFromEvent(latestEvent);
}

export function upsertOperativeScopeRecordedEvent(events: ClinicalEvent[] = [], nextEvent: ClinicalEvent) {
  return [...events.filter((event) => !isOperativeScopeRecordedEvent(event)), nextEvent];
}

export function isOperativeSurfaceScope(scope?: WorkflowScope | null) {
  return Boolean(scope && (scope.kind === "surface" || scope.surface || scope.surfaces?.length));
}

export function isEndodonticCanalScope(scope?: WorkflowScope | null) {
  return Boolean(scope && (scope.kind === "canal" || scope.canal));
}

export function scopesTargetDifferentToothSubstructures(left?: WorkflowScope | null, right?: WorkflowScope | null) {
  return (isEndodonticCanalScope(left) && isOperativeSurfaceScope(right)) || (isOperativeSurfaceScope(left) && isEndodonticCanalScope(right));
}

export const operativeDirectRestorationWorkflow: WorkflowDefinition = {
  workflowId: operativeDirectRestorationWorkflowId,
  version: operativeDirectRestorationWorkflowVersion,
  discipline: "operative",
  title: "Operative direct restoration",
  entryNodeIds: ["operative-readiness"],
  completionNodeIds: ["operative-restoration-complete"],
  supportedScopes: ["tooth", "surface", "procedure"],
  nodes: {
    "operative-readiness": {
      id: "operative-readiness",
      workflowId: operativeDirectRestorationWorkflowId,
      phase: "Operative setup",
      title: "Confirm operative readiness",
      chairsideInstruction: "Confirm the planned tooth and surface scope, then reuse recorded diagnosis, radiograph, anesthesia, and isolation context when it is relevant to that scope.",
      requiredInputs: ["Tooth", "Surface or surfaces"],
      moduleCalls: operativeReadinessModuleCalls,
      options: [{ label: "Readiness context confirmed", nextNodeId: "operative-surface-scope" }],
    },
    "operative-surface-scope": {
      id: "operative-surface-scope",
      workflowId: operativeDirectRestorationWorkflowId,
      phase: "Operative scope",
      title: "Record surface scope",
      chairsideInstruction: "Record the tooth and operative surface scope separately from any endodontic canal scope on the same tooth.",
      requiredInputs: ["Tooth", "Surface or surfaces"],
      options: [{ label: "Surface scope recorded", nextNodeId: "operative-restoration-record" }],
    },
    "operative-restoration-record": {
      id: "operative-restoration-record",
      workflowId: operativeDirectRestorationWorkflowId,
      phase: "Restoration record",
      title: "Record restoration capability",
      chairsideInstruction: "Record the final restoration event against the planned tooth and surface scope.",
      requiredInputs: ["Restoration outcome"],
      options: [{ label: "Restoration capability recorded", nextNodeId: "operative-restoration-complete" }],
    },
    "operative-restoration-complete": {
      id: "operative-restoration-complete",
      workflowId: operativeDirectRestorationWorkflowId,
      phase: "Complete",
      title: "Operative workflow complete",
      chairsideInstruction: "The operative workflow has a final restoration capability recorded for its tooth and surface scope.",
      capabilityRequirements: operativeRestorationCompletionRequirements,
      options: [{ label: "Workflow complete", nextNodeId: "operative-restoration-complete" }],
    },
  },
};
