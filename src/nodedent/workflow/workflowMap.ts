import type { ClinicalEvent, EndoCase, WorkflowScope } from "../types";
import { getCanalStatus } from "../engine/deriveCanalStatus";
import { getCaseStatus } from "../engine/deriveCaseStatus";
import { sharedAnesthesiaWorkflowId } from "./anesthesia";
import { sharedIsolationWorkflowId } from "./isolation";
import { getLatestOperativeWorkflowSetup, getOperativeRestorationEvents, normalizeOperativeSurfaces, operativeDirectRestorationWorkflowId } from "./operative";
import { sharedRadiologyWorkflowId } from "./radiology";
import { endodonticRootWorkflowId } from "./registry";
import { getCaseCapabilitySummary } from "./selectors";

export type WorkflowMapTargetKind =
  | "appointment"
  | "fullMouth"
  | "arch"
  | "quadrant"
  | "tooth"
  | "teeth"
  | "surface"
  | "surfaces"
  | "problem"
  | "procedure"
  | "custom";

export type WorkflowMapTargetScope = {
  type: WorkflowMapTargetKind;
  label: string;
  teeth?: string[];
  surfaces?: string[];
  regionLabel?: string;
  procedureId?: string;
  details?: Record<string, unknown>;
};

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

function toothScope(tooth?: string, fallback = "Tooth not set"): WorkflowMapTargetScope {
  return tooth ? { type: "tooth", label: `tooth ${tooth}`, teeth: [tooth] } : appointmentScope(fallback);
}

function workflowScopeToMapTarget(scope?: WorkflowScope, fallbackLabel = "Appointment"): WorkflowMapTargetScope {
  if (!scope) return appointmentScope(fallbackLabel);
  if (scope.surfaces?.length) {
    const teeth = scope.tooth ? [scope.tooth] : scope.teeth;
    return {
      type: "surfaces",
      label: `${teeth?.length ? `tooth ${compactList(teeth)} ` : ""}surfaces ${compactList(scope.surfaces)}`.trim(),
      teeth,
      surfaces: scope.surfaces,
      procedureId: scope.procedureId,
    };
  }
  if (scope.surface) {
    const teeth = scope.tooth ? [scope.tooth] : scope.teeth;
    return {
      type: "surface",
      label: `${teeth?.length ? `tooth ${compactList(teeth)} ` : ""}surface ${scope.surface}`.trim(),
      teeth,
      surfaces: [scope.surface],
      procedureId: scope.procedureId,
    };
  }
  if (scope.teeth?.length) return { type: "teeth", label: `teeth ${compactList(scope.teeth)}`, teeth: scope.teeth, regionLabel: scope.regionLabel };
  if (scope.tooth) return toothScope(scope.tooth);
  if (scope.kind === "quadrant") return { type: "quadrant", label: scope.regionLabel || "quadrant", regionLabel: scope.regionLabel };
  if (scope.kind === "procedure") return { type: "procedure", label: scope.procedureId || scope.regionLabel || "procedure", procedureId: scope.procedureId, regionLabel: scope.regionLabel };
  if (scope.regionLabel) return { type: "custom", label: scope.regionLabel, regionLabel: scope.regionLabel };
  return { type: "custom", label: scope.label || fallbackLabel };
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

function hasEndodonticActivity(caseData: EndoCase, currentNodeId?: string) {
  return Boolean(
    caseData.tooth ||
      currentNodeId && currentNodeId !== "preop" ||
      caseData.globalEvents.some((event) => !event.workflowId || event.workflowId === endodonticRootWorkflowId) ||
      caseData.canals.some((canal) => (canal.events || []).length > 0 || getCanalStatus(canal) !== "notStarted")
  );
}

function endodonticInstance(caseData: EndoCase, currentNodeId?: string): AppointmentWorkflowInstance | undefined {
  if (!hasEndodonticActivity(caseData, currentNodeId)) return undefined;

  return {
    id: "instance_endo_current",
    workflowType: "endo.rct",
    label: "Endodontic RCT",
    target: {
      ...toothScope(caseData.tooth),
      details: {
        canals: caseData.canals.map((canal) => ({ name: canal.name, status: getCanalStatus(canal) })),
      },
    },
    statusLabel: getCaseStatus(caseData),
    sourceWorkflowId: endodonticRootWorkflowId,
  };
}

function operativeInstance(caseData: EndoCase): AppointmentWorkflowInstance | undefined {
  const setup = getLatestOperativeWorkflowSetup(caseData);
  const restorationEvents = getOperativeRestorationEvents(caseData);
  const latestRestorationEvent = restorationEvents.at(-1);
  const surfaces = normalizeOperativeSurfaces(setup.surfaces || latestRestorationEvent?.scope?.surfaces || latestRestorationEvent?.scope?.surface);
  const tooth = setup.tooth || latestRestorationEvent?.scope?.tooth || latestRestorationEvent?.tooth || caseData.tooth;
  const hasSetup = Boolean(setup.tooth || setup.surfaces || setup.restorationIntent || setup.material || setup.shade);
  if (!hasSetup && !latestRestorationEvent) return undefined;

  return {
    id: "instance_operative_current",
    workflowType: "operative.direct-restoration",
    label: "Operative direct restoration",
    target: surfaces.length
      ? { type: surfaces.length > 1 ? "surfaces" : "surface", label: `tooth ${tooth || "not set"} surfaces ${compactList(surfaces)}`, teeth: tooth ? [tooth] : undefined, surfaces }
      : toothScope(tooth),
    statusLabel: latestRestorationEvent ? "Restoration recorded" : "Setup recorded",
    sourceWorkflowId: operativeDirectRestorationWorkflowId,
  };
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

export function buildAppointmentWorkflowMap(caseData: EndoCase, currentNodeId?: string): AppointmentWorkflowMap {
  const events = collectEvents(caseData);
  const capabilitySummary = getCaseCapabilitySummary(caseData);
  const workflowInstances = [endodonticInstance(caseData, currentNodeId), operativeInstance(caseData)].filter(Boolean) as AppointmentWorkflowInstance[];
  const diagnosisScope = capabilitySummary.diagnosis.scope ? workflowScopeToMapTarget(capabilitySummary.diagnosis.scope) : toothScope(caseData.tooth);
  const radiologyScope = capabilitySummary.radiographs.scope ? workflowScopeToMapTarget(capabilitySummary.radiographs.scope) : toothScope(caseData.tooth);
  const anesthesiaEvent = latestWorkflowEvent(events, sharedAnesthesiaWorkflowId);
  const isolationEvent = latestWorkflowEvent(events, sharedIsolationWorkflowId);
  const radiologyEvent = latestWorkflowEvent(events, sharedRadiologyWorkflowId);
  const anesthesiaScope = capabilitySummary.anesthesia.scope ? workflowScopeToMapTarget(capabilitySummary.anesthesia.scope) : workflowScopeToMapTarget(anesthesiaEvent?.scope, "Anesthesia scope not recorded");
  const isolationScope = capabilitySummary.isolation.scope ? workflowScopeToMapTarget(capabilitySummary.isolation.scope) : workflowScopeToMapTarget(isolationEvent?.scope, "Isolation scope not recorded");

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
      statusLabel: capabilitySummary.radiographs.satisfied ? "Recorded" : "Not recorded",
      usedBy: usedByInstances(radiologyScope, workflowInstances),
      sourceEventId: radiologyEvent?.id,
    },
    {
      id: "module_anesthesia",
      moduleType: "shared.anesthesia",
      label: "Shared Anesthesia",
      scope: anesthesiaScope,
      statusLabel: capabilitySummary.anesthesia.satisfied ? "Ready" : capabilitySummary.anesthesia.needsReassessment ? "Review" : "Not recorded",
      usedBy: usedByInstances(anesthesiaScope, workflowInstances),
      sourceEventId: anesthesiaEvent?.id,
    },
    {
      id: "module_isolation",
      moduleType: "shared.isolation",
      label: "Shared Isolation",
      scope: isolationScope,
      statusLabel: capabilitySummary.isolation.satisfied ? "Ready" : capabilitySummary.isolation.needsReassessment ? "Review" : "Not recorded",
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
