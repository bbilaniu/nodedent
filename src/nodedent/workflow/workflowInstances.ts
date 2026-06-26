import type { AppointmentWorkflowInstanceState, ClinicalEvent, EndoCase, WorkflowMapTargetScope, WorkflowScope } from "../types";
import { getCanalStatus } from "../engine/deriveCanalStatus";
import { getCaseStatus } from "../engine/deriveCaseStatus";
import {
  getLatestOperativeWorkflowSetup,
  getOperativeRestorationEvents,
  isOperativeScopeRecordedEvent,
  normalizeOperativeSurfaces,
  operativeDirectRestorationWorkflowId,
} from "./operative";
import { endodonticRootWorkflowId } from "./registry";

const endodonticInstanceId = "instance_endo_current";
const legacyOperativeInstanceId = "instance_operative_current";

function compactList(items: readonly string[] = []) {
  return items.filter(Boolean).join(", ");
}

export function appointmentTarget(label = "Appointment"): WorkflowMapTargetScope {
  return { type: "appointment", label };
}

export function toothTarget(tooth?: string, fallback = "Tooth not set"): WorkflowMapTargetScope {
  return tooth ? { type: "tooth", label: `tooth ${tooth}`, teeth: [tooth] } : appointmentTarget(fallback);
}

export function surfacesTarget(tooth?: string, surfaces: readonly string[] = []): WorkflowMapTargetScope {
  const normalizedSurfaces = normalizeOperativeSurfaces([...surfaces]);
  if (!normalizedSurfaces.length) return toothTarget(tooth);
  return {
    type: normalizedSurfaces.length > 1 ? "surfaces" : "surface",
    label: `tooth ${tooth || "not set"} surfaces ${compactList(normalizedSurfaces)}`,
    teeth: tooth ? [tooth] : undefined,
    surfaces: normalizedSurfaces,
  };
}

export function workflowScopeToWorkflowMapTarget(scope?: WorkflowScope, fallbackLabel = "Appointment"): WorkflowMapTargetScope {
  if (!scope) return appointmentTarget(fallbackLabel);
  if (scope.surfaces?.length) return surfacesTarget(scope.tooth || scope.teeth?.[0], scope.surfaces);
  if (scope.surface) return surfacesTarget(scope.tooth || scope.teeth?.[0], [scope.surface]);
  if (scope.teeth?.length) return { type: "teeth", label: `teeth ${compactList(scope.teeth)}`, teeth: scope.teeth, regionLabel: scope.regionLabel };
  if (scope.tooth) return toothTarget(scope.tooth);
  if (scope.kind === "quadrant") return { type: "quadrant", label: scope.regionLabel || "quadrant", regionLabel: scope.regionLabel };
  if (scope.kind === "procedure") return { type: "procedure", label: scope.procedureId || scope.regionLabel || "procedure", procedureId: scope.procedureId, regionLabel: scope.regionLabel };
  if (scope.regionLabel) return { type: "custom", label: scope.regionLabel, regionLabel: scope.regionLabel };
  return { type: "custom", label: scope.label || fallbackLabel };
}

function collectEvents(caseData: Pick<EndoCase, "globalEvents" | "events" | "canals">) {
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

function hasEndodonticActivity(caseData: EndoCase, currentNodeId?: string) {
  return Boolean(
    caseData.tooth ||
      currentNodeId && currentNodeId !== "preop" ||
      caseData.globalEvents.some((event) => !event.workflowId || event.workflowId === endodonticRootWorkflowId) ||
      caseData.canals.some((canal) => (canal.events || []).length > 0 || getCanalStatus(canal) !== "notStarted")
  );
}

function endodonticSourceEventIds(caseData: EndoCase) {
  return collectEvents(caseData)
    .filter((event) => !event.workflowId || event.workflowId === endodonticRootWorkflowId)
    .map((event) => event.id)
    .filter(Boolean);
}

function createEndodonticWorkflowInstance(caseData: EndoCase, currentNodeId?: string, timestamp = new Date().toISOString()): AppointmentWorkflowInstanceState | null {
  if (!hasEndodonticActivity(caseData, currentNodeId)) return null;
  const sourceEventIds = endodonticSourceEventIds(caseData);
  return {
    id: endodonticInstanceId,
    workflowType: "endo.rct",
    workflowId: endodonticRootWorkflowId,
    label: "Endodontic RCT",
    target: {
      ...toothTarget(caseData.tooth),
      details: {
        canals: caseData.canals.map((canal) => ({ name: canal.name, status: getCanalStatus(canal) })),
      },
    },
    status: currentNodeId && currentNodeId !== "preop" || sourceEventIds.length ? "inProgress" : "notStarted",
    createdAt: timestamp,
    updatedAt: timestamp,
    workflowRunId: "run_endo_root",
    sourceEventIds,
  };
}

function operativeSourceEvents(caseData: EndoCase) {
  return collectEvents(caseData).filter((event) => event.workflowId === operativeDirectRestorationWorkflowId);
}

function createLegacyOperativeWorkflowInstance(caseData: EndoCase, timestamp = new Date().toISOString()): AppointmentWorkflowInstanceState | null {
  const setup = getLatestOperativeWorkflowSetup(caseData);
  const restorationEvents = getOperativeRestorationEvents(caseData);
  const latestRestorationEvent = restorationEvents.at(-1);
  const setupEvents = operativeSourceEvents(caseData).filter(isOperativeScopeRecordedEvent);
  const latestSetupEvent = setupEvents.at(-1);
  const surfaces = normalizeOperativeSurfaces(setup.surfaces || latestRestorationEvent?.scope?.surfaces || latestRestorationEvent?.scope?.surface);
  const tooth = setup.tooth || latestRestorationEvent?.scope?.tooth || latestRestorationEvent?.tooth || caseData.tooth;
  const hasSetup = Boolean(setup.tooth || setup.surfaces || setup.restorationIntent || setup.material || setup.shade);
  if (!hasSetup && !latestRestorationEvent) return null;
  const sourceEvents = operativeSourceEvents(caseData);

  return {
    id: latestRestorationEvent?.details?.workflowInstanceId || latestSetupEvent?.details?.workflowInstanceId || legacyOperativeInstanceId,
    workflowType: "operative.direct-restoration",
    workflowId: operativeDirectRestorationWorkflowId,
    label: "Operative direct restoration",
    target: surfacesTarget(tooth, surfaces),
    status: latestRestorationEvent ? "complete" : "inProgress",
    createdAt: sourceEvents[0]?.timestamp || timestamp,
    updatedAt: sourceEvents.at(-1)?.timestamp || timestamp,
    workflowRunId: latestRestorationEvent?.workflowRunId || latestSetupEvent?.workflowRunId || "run_operative_current",
    sourceEventIds: sourceEvents.map((event) => event.id).filter(Boolean),
  };
}

function normalizeTarget(value: unknown): WorkflowMapTargetScope {
  const target = value && typeof value === "object" ? value as Partial<WorkflowMapTargetScope> : {};
  const type = target.type || (target.teeth?.length ? "teeth" : "appointment");
  return {
    type,
    label: target.label || (target.teeth?.length ? `teeth ${compactList(target.teeth)}` : type),
    teeth: Array.isArray(target.teeth) ? target.teeth.map(String).filter(Boolean) : undefined,
    surfaces: Array.isArray(target.surfaces) ? normalizeOperativeSurfaces(target.surfaces.map(String)) : undefined,
    regionLabel: typeof target.regionLabel === "string" ? target.regionLabel : undefined,
    procedureId: typeof target.procedureId === "string" ? target.procedureId : undefined,
    details: target.details && typeof target.details === "object" ? target.details : undefined,
  };
}

function normalizeInstance(value: unknown, fallbackUpdatedAt: string): AppointmentWorkflowInstanceState | null {
  if (!value || typeof value !== "object") return null;
  const instance = value as Partial<AppointmentWorkflowInstanceState>;
  if (!instance.id || !instance.workflowType) return null;
  const status = instance.status === "complete" || instance.status === "inProgress" || instance.status === "modelOnly" || instance.status === "notStarted"
    ? instance.status
    : "notStarted";
  return {
    id: String(instance.id),
    workflowType: String(instance.workflowType),
    workflowId: instance.workflowId ? String(instance.workflowId) : undefined,
    label: instance.label ? String(instance.label) : String(instance.workflowType),
    target: normalizeTarget(instance.target),
    status,
    createdAt: instance.createdAt ? String(instance.createdAt) : fallbackUpdatedAt,
    updatedAt: instance.updatedAt ? String(instance.updatedAt) : fallbackUpdatedAt,
    workflowRunId: instance.workflowRunId ? String(instance.workflowRunId) : undefined,
    sourceEventIds: Array.isArray(instance.sourceEventIds) ? instance.sourceEventIds.map(String).filter(Boolean) : [],
  };
}

export function normalizeWorkflowInstances(caseData: EndoCase, currentNodeId?: string, timestamp = new Date().toISOString()): AppointmentWorkflowInstanceState[] {
  const existing = Array.isArray(caseData.workflowInstances)
    ? caseData.workflowInstances
        .map((instance) => normalizeInstance(instance, caseData.autosavedAt || timestamp))
        .filter(Boolean) as AppointmentWorkflowInstanceState[]
    : [];

  if (existing.length) return existing;

  return [
    createEndodonticWorkflowInstance(caseData, currentNodeId, timestamp),
    createLegacyOperativeWorkflowInstance(caseData, timestamp),
  ].filter(Boolean) as AppointmentWorkflowInstanceState[];
}

export function getWorkflowInstanceById(caseData: EndoCase, workflowInstanceId?: string | null) {
  if (!workflowInstanceId) return undefined;
  return normalizeWorkflowInstances(caseData, caseData.currentNodeId).find((instance) => instance.id === workflowInstanceId);
}

export function getEventWorkflowInstanceId(event?: ClinicalEvent | null) {
  return typeof event?.details?.workflowInstanceId === "string" ? event.details.workflowInstanceId : undefined;
}

