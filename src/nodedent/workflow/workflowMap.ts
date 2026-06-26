import type { AppointmentWorkflowInstanceState, ClinicalEvent, EndoCase, WorkflowMapTargetKind, WorkflowMapTargetScope } from "../types";
import { sharedAnesthesiaWorkflowId } from "./anesthesia";
import { sharedIsolationWorkflowId } from "./isolation";
import { operativeDirectRestorationWorkflowId } from "./operative";
import { sharedRadiologyWorkflowId } from "./radiology";
import { endodonticRootWorkflowId } from "./registry";
import { getCaseCapabilitySummary } from "./selectors";
import { normalizeWorkflowInstances, toothTarget, workflowScopeToWorkflowMapTarget } from "./workflowInstances";

export type WorkflowMapDefinition = {
  workflowType: string;
  label: string;
  category: "primary" | "sharedModule" | "output";
  status: "ready" | "modelOnly";
  supportedTargetTypes: WorkflowMapTargetKind[];
  sourceWorkflowId?: string;
  summary: string;
};

export type AppointmentWorkflowInstance = {
  id: string;
  workflowType: string;
  label: string;
  target: WorkflowMapTargetScope;
  statusLabel: string;
  sourceWorkflowId?: string;
  workflowRunId?: string;
  sourceEventIds?: string[];
};

export type AppointmentSharedModule = {
  id: string;
  moduleType: string;
  label: string;
  scope: WorkflowMapTargetScope;
  statusLabel: string;
  usedBy: string[];
  sourceEventId?: string;
};

export type ConditionalWorkflowHandoff = {
  id: string;
  fromWorkflowType: string;
  toWorkflowType: string;
  triggerLabel: string;
};

export type AppointmentWorkflowMap = {
  appointmentId: string;
  workflowDefinitions: WorkflowMapDefinition[];
  workflowInstances: AppointmentWorkflowInstance[];
  sharedModules: AppointmentSharedModule[];
  conditionalHandoffs: ConditionalWorkflowHandoff[];
  finalNoteAggregation: {
    workflowInstanceIds: string[];
    sharedModuleIds: string[];
  };
};

export const workflowMapDefinitions = [
  {
    workflowType: "endo.rct",
    label: "Endodontic RCT",
    category: "primary",
    status: "ready",
    supportedTargetTypes: ["tooth", "teeth"],
    sourceWorkflowId: endodonticRootWorkflowId,
    summary: "Current endodontic protocol runner with canal-specific progress.",
  },
  {
    workflowType: "operative.direct-restoration",
    label: "Operative direct restoration",
    category: "primary",
    status: "ready",
    supportedTargetTypes: ["tooth", "surface", "surfaces"],
    sourceWorkflowId: operativeDirectRestorationWorkflowId,
    summary: "Current operative runner with tooth and surface scope.",
  },
  {
    workflowType: "extraction.surgery",
    label: "Extraction Surgery",
    category: "primary",
    status: "modelOnly",
    supportedTargetTypes: ["tooth", "teeth"],
    summary: "Seed definition only; no clinical runner is implemented yet.",
  },
  {
    workflowType: "hygiene.cleaning",
    label: "Cleaning / Hygiene",
    category: "primary",
    status: "modelOnly",
    supportedTargetTypes: ["fullMouth", "arch", "quadrant"],
    summary: "Seed definition only; no clinical runner is implemented yet.",
  },
  {
    workflowType: "shared.diagnostics",
    label: "Shared Diagnostics",
    category: "sharedModule",
    status: "ready",
    supportedTargetTypes: ["appointment", "tooth", "problem"],
    summary: "Shared case diagnosis context currently backed by case setup fields.",
  },
  {
    workflowType: "shared.treatment-planning",
    label: "Shared Treatment Planning",
    category: "sharedModule",
    status: "modelOnly",
    supportedTargetTypes: ["appointment", "tooth", "teeth", "problem"],
    summary: "Seed definition only; planning does not yet create workflow instances.",
  },
  {
    workflowType: "shared.consent",
    label: "Shared Consent",
    category: "sharedModule",
    status: "modelOnly",
    supportedTargetTypes: ["appointment", "tooth", "teeth", "surface", "surfaces", "problem"],
    summary: "Seed definition only; consent capture is not implemented yet.",
  },
  {
    workflowType: "shared.anesthesia",
    label: "Shared Anesthesia",
    category: "sharedModule",
    status: "ready",
    supportedTargetTypes: ["appointment", "quadrant", "tooth", "teeth", "custom"],
    sourceWorkflowId: sharedAnesthesiaWorkflowId,
    summary: "Shared module records scoped anesthesia events and capability output.",
  },
  {
    workflowType: "shared.isolation",
    label: "Shared Isolation",
    category: "sharedModule",
    status: "ready",
    supportedTargetTypes: ["quadrant", "tooth", "teeth", "custom"],
    sourceWorkflowId: sharedIsolationWorkflowId,
    summary: "Shared module records scoped isolation events and capability output.",
  },
  {
    workflowType: "shared.radiology",
    label: "Shared Radiology",
    category: "sharedModule",
    status: "ready",
    supportedTargetTypes: ["tooth", "teeth", "quadrant", "procedure", "custom"],
    sourceWorkflowId: sharedRadiologyWorkflowId,
    summary: "Shared module records scoped radiograph review events.",
  },
  {
    workflowType: "final-note",
    label: "Final note generation",
    category: "output",
    status: "ready",
    supportedTargetTypes: ["appointment"],
    summary: "Aggregates case setup, workflow instances, shared events, and handoffs.",
  },
] as const satisfies readonly WorkflowMapDefinition[];

export const workflowMapConditionalHandoffs: ConditionalWorkflowHandoff[] = [
  {
    id: "endo-to-operative-restoration",
    fromWorkflowType: "endo.rct",
    toWorkflowType: "operative.direct-restoration",
    triggerLabel: "Definitive restoration needed after RCT",
  },
  {
    id: "endo-to-extraction",
    fromWorkflowType: "endo.rct",
    toWorkflowType: "extraction.surgery",
    triggerLabel: "Non-restorable or extraction selected",
  },
  {
    id: "operative-to-endo",
    fromWorkflowType: "operative.direct-restoration",
    toWorkflowType: "endo.rct",
    triggerLabel: "Endodontic treatment indicated during diagnosis or excavation",
  },
];

function compactList(items: readonly string[] = []) {
  return items.filter(Boolean).join(", ");
}

export function formatWorkflowMapTarget(scope: WorkflowMapTargetScope) {
  if (scope.label) return scope.label;
  if (scope.teeth?.length && scope.surfaces?.length) return `teeth ${compactList(scope.teeth)} surfaces ${compactList(scope.surfaces)}`;
  if (scope.teeth?.length) return `teeth ${compactList(scope.teeth)}`;
  if (scope.surfaces?.length) return `surfaces ${compactList(scope.surfaces)}`;
  return scope.regionLabel || scope.procedureId || scope.type;
}

function appointmentScope(label = "Appointment"): WorkflowMapTargetScope {
  return { type: "appointment", label };
}

function collectEvents(caseData: EndoCase) {
  const seen = new Set<string>();
  return [...(caseData.globalEvents || []), ...(caseData.events || []), ...(caseData.canals || []).flatMap((canal) => canal.events || [])]
    .filter((event) => {
      const key = event.id || `${event.timestamp}:${event.type}:${event.canal || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => String(a.timestamp || "").localeCompare(String(b.timestamp || "")));
}

function latestWorkflowEvent(events: readonly ClinicalEvent[], workflowId: string) {
  return events.filter((event) => event.workflowId === workflowId).at(-1);
}

function targetsOverlap(moduleScope: WorkflowMapTargetScope, instanceTarget: WorkflowMapTargetScope) {
  if (moduleScope.type === "appointment") return true;
  const moduleTeeth = moduleScope.teeth || [];
  const instanceTeeth = instanceTarget.teeth || [];
  if (moduleTeeth.length && instanceTeeth.length) return instanceTeeth.some((tooth) => moduleTeeth.includes(tooth));
  if (moduleScope.type === "custom" && moduleScope.regionLabel && instanceTarget.regionLabel) return moduleScope.regionLabel === instanceTarget.regionLabel;
  return false;
}

function usedByInstances(moduleScope: WorkflowMapTargetScope, instances: readonly AppointmentWorkflowInstance[]) {
  return instances.filter((instance) => targetsOverlap(moduleScope, instance.target)).map((instance) => instance.id);
}

function statusLabelForInstance(instance: AppointmentWorkflowInstanceState) {
  if (instance.workflowType === "operative.direct-restoration") {
    if (instance.status === "complete") return "Restoration recorded";
    if (instance.status === "inProgress") return "Setup recorded";
    return "Not started";
  }
  if (instance.workflowType === "endo.rct") {
    if (instance.status === "complete") return "Completed";
    if (instance.status === "inProgress") return "In progress";
    return "Not started";
  }
  return instance.status === "modelOnly" ? "Model only" : instance.status;
}

function mapWorkflowInstance(instance: AppointmentWorkflowInstanceState): AppointmentWorkflowInstance {
  return {
    id: instance.id,
    workflowType: instance.workflowType,
    label: instance.label,
    target: instance.target,
    statusLabel: statusLabelForInstance(instance),
    sourceWorkflowId: instance.workflowId,
    workflowRunId: instance.workflowRunId,
    sourceEventIds: instance.sourceEventIds || [],
  };
}

export function buildAppointmentWorkflowMap(caseData: EndoCase, currentNodeId?: string): AppointmentWorkflowMap {
  const events = collectEvents(caseData);
  const capabilitySummary = getCaseCapabilitySummary(caseData);
  const workflowInstances = normalizeWorkflowInstances(caseData, currentNodeId).map(mapWorkflowInstance);
  const anesthesiaEvent = latestWorkflowEvent(events, sharedAnesthesiaWorkflowId);
  const isolationEvent = latestWorkflowEvent(events, sharedIsolationWorkflowId);
  const radiologyEvent = latestWorkflowEvent(events, sharedRadiologyWorkflowId);
  const diagnosisScope = capabilitySummary.diagnosis.scope ? workflowScopeToWorkflowMapTarget(capabilitySummary.diagnosis.scope) : toothTarget(caseData.tooth);
  const radiologyScope = radiologyEvent?.scope
    ? workflowScopeToWorkflowMapTarget(radiologyEvent.scope)
    : capabilitySummary.radiographs.scope
      ? workflowScopeToWorkflowMapTarget(capabilitySummary.radiographs.scope)
      : toothTarget(caseData.tooth);
  const anesthesiaScope = anesthesiaEvent?.scope
    ? workflowScopeToWorkflowMapTarget(anesthesiaEvent.scope, "Anesthesia scope not recorded")
    : capabilitySummary.anesthesia.scope
      ? workflowScopeToWorkflowMapTarget(capabilitySummary.anesthesia.scope)
      : workflowScopeToWorkflowMapTarget(undefined, "Anesthesia scope not recorded");
  const isolationScope = isolationEvent?.scope
    ? workflowScopeToWorkflowMapTarget(isolationEvent.scope, "Isolation scope not recorded")
    : capabilitySummary.isolation.scope
      ? workflowScopeToWorkflowMapTarget(capabilitySummary.isolation.scope)
      : workflowScopeToWorkflowMapTarget(undefined, "Isolation scope not recorded");

  const sharedModules: AppointmentSharedModule[] = [
    {
      id: "module_diagnostics",
      moduleType: "shared.diagnostics",
      label: "Shared Diagnostics",
      scope: diagnosisScope,
      statusLabel: capabilitySummary.diagnosis.satisfied ? "Recorded" : "Not recorded",
      usedBy: usedByInstances(diagnosisScope, workflowInstances),
    },
    {
      id: "module_radiology",
      moduleType: "shared.radiology",
      label: "Shared Radiology",
      scope: radiologyScope,
      statusLabel: radiologyEvent || capabilitySummary.radiographs.satisfied ? "Recorded" : "Not recorded",
      usedBy: usedByInstances(radiologyScope, workflowInstances),
      sourceEventId: radiologyEvent?.id,
    },
    {
      id: "module_anesthesia",
      moduleType: "shared.anesthesia",
      label: "Shared Anesthesia",
      scope: anesthesiaScope,
      statusLabel: anesthesiaEvent || capabilitySummary.anesthesia.satisfied ? "Ready" : capabilitySummary.anesthesia.needsReassessment ? "Review" : "Not recorded",
      usedBy: usedByInstances(anesthesiaScope, workflowInstances),
      sourceEventId: anesthesiaEvent?.id,
    },
    {
      id: "module_isolation",
      moduleType: "shared.isolation",
      label: "Shared Isolation",
      scope: isolationScope,
      statusLabel: isolationEvent || capabilitySummary.isolation.satisfied ? "Ready" : capabilitySummary.isolation.needsReassessment ? "Review" : "Not recorded",
      usedBy: usedByInstances(isolationScope, workflowInstances),
      sourceEventId: isolationEvent?.id,
    },
    {
      id: "module_treatment_planning",
      moduleType: "shared.treatment-planning",
      label: "Shared Treatment Planning",
      scope: appointmentScope(),
      statusLabel: "Model only",
      usedBy: workflowInstances.map((instance) => instance.id),
    },
    {
      id: "module_consent",
      moduleType: "shared.consent",
      label: "Shared Consent",
      scope: appointmentScope(),
      statusLabel: "Model only",
      usedBy: workflowInstances.map((instance) => instance.id),
    },
  ];

  return {
    appointmentId: caseData.autosavedAt || "current",
    workflowDefinitions: [...workflowMapDefinitions],
    workflowInstances,
    sharedModules,
    conditionalHandoffs: workflowMapConditionalHandoffs,
    finalNoteAggregation: {
      workflowInstanceIds: workflowInstances.map((instance) => instance.id),
      sharedModuleIds: sharedModules.map((module) => module.id),
    },
  };
}
