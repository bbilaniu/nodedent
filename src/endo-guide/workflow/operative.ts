import type { CapabilityName, CapabilityRequirement, WorkflowDefinition, WorkflowModuleCall, WorkflowScope } from "../types";
import { sharedAnesthesiaWorkflowId } from "./anesthesia";
import { sharedIsolationWorkflowId } from "./isolation";

export const sharedDiagnosisWorkflowId = "shared.diagnosis";
export const operativeDirectRestorationWorkflowId = "operative.direct-restoration";
export const operativeDirectRestorationWorkflowVersion = "0.1.0";

export type OperativeSurfaceScopeInput = {
  tooth?: string;
  surface?: string;
  surfaces?: string[];
  procedureId?: string;
  label?: string;
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

function normalizeSurfaces(input: OperativeSurfaceScopeInput) {
  const values = input.surfaces?.length ? input.surfaces : input.surface ? [input.surface] : [];
  return values.map((surface) => surface.trim()).filter(Boolean);
}

export function createOperativeSurfaceScope(input: OperativeSurfaceScopeInput): WorkflowScope {
  const surfaces = normalizeSurfaces(input);

  return {
    kind: "surface",
    tooth: input.tooth,
    procedureId: input.procedureId,
    surface: surfaces[0],
    surfaces: surfaces.length > 1 ? surfaces : undefined,
    label: input.label || [input.tooth, surfaces.join("")].filter(Boolean).join(" "),
  };
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
