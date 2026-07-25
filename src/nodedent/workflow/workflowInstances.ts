import { getCanalStatus } from "../engine/deriveCanalStatus";
import { protocolNodes } from "../protocol/nodes";
import type { ClinicalEvent, EndoCase, PrimaryWorkflowInstance, WorkflowScope } from "../types";
import {
  endodonticProcedureOptions,
  multidisciplinaryProcedure,
  noTreatmentSelectedProcedure,
} from "./procedures";
import {
  getLatestOperativeWorkflowSetup,
  getOperativeRestorationEvents,
  isOperativeScopeRecordedEvent,
  normalizeOperativeSurfaces,
  operativeDirectRestorationWorkflowId,
} from "./operative";
import { endodonticRootWorkflowId } from "./registry";

// Transitional compatibility boundary:
// `procedureType`, untagged endodontic events, and pre-instance operative events are
// read only to recover older protected cases/exports. This fallback is intentionally
// time-bounded and should be removed in a future major cleanup after the supported
// migration/export window closes; do not expand it into a permanent parallel model.
export const endodonticWorkflowType = "endo.rct";
export const operativeDirectRestorationWorkflowType = "operative.direct-restoration";

export const selectablePrimaryWorkflows = [
  {
    workflowType: endodonticWorkflowType,
    workflowId: endodonticRootWorkflowId,
    discipline: "endo",
    label: "Endodontic RCT",
    defaultProcedureLabel: "RCT",
    summary: "Canal-specific endodontic decision and documentation workflow.",
  },
  {
    workflowType: operativeDirectRestorationWorkflowType,
    workflowId: operativeDirectRestorationWorkflowId,
    discipline: "operative",
    label: "Operative direct restoration",
    defaultProcedureLabel: "Direct restoration",
    summary: "Tooth- and surface-scoped direct restoration workflow.",
  },
] as const;

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueEvents(caseData: Pick<EndoCase, "globalEvents" | "events" | "canals">) {
  const seen = new Set<string>();
  return [...(caseData.globalEvents || []), ...(caseData.events || []), ...(caseData.canals || []).flatMap((canal) => canal.events || [])]
    .filter((event) => {
      const key = event.id || `${event.timestamp}:${event.type}:${event.canal || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => String(left.timestamp || "").localeCompare(String(right.timestamp || "")));
}

function endodonticEvents(caseData: EndoCase) {
  return uniqueEvents(caseData).filter((event) => !event.workflowId || event.workflowId === endodonticRootWorkflowId);
}

function operativeEvents(caseData: EndoCase) {
  return uniqueEvents(caseData).filter((event) => event.workflowId === operativeDirectRestorationWorkflowId);
}

function eventMatchesWorkflowInstance(event: ClinicalEvent, instance: PrimaryWorkflowInstance) {
  const eventInstanceId = hasText(event.details?.workflowInstanceId)
    ? String(event.details?.workflowInstanceId)
    : undefined;
  if (eventInstanceId) return eventInstanceId === instance.id;
  if (hasText(event.workflowRunId)) return event.workflowRunId === instance.workflowRunId;

  // Untagged events are accepted only at this transitional compatibility
  // boundary. Current event writers attach both durable identities.
  return true;
}

function hasEndodonticActivity(caseData: EndoCase, currentNodeId = caseData.currentNodeId || "preop") {
  return (
    endodonticProcedureOptions.includes(caseData.procedureType) ||
    caseData.procedureType === multidisciplinaryProcedure ||
    (currentNodeId !== "preop" && Boolean(protocolNodes[currentNodeId])) ||
    endodonticEvents(caseData).length > 0 ||
    caseData.canals.some((canal) => getCanalStatus(canal) !== "notStarted" || (canal.events || []).length > 0)
  );
}

function hasOperativeActivity(caseData: EndoCase) {
  const setup = getLatestOperativeWorkflowSetup(caseData);
  return (
    caseData.procedureType === "Direct restoration" ||
    caseData.procedureType === multidisciplinaryProcedure ||
    Object.values(setup).some(hasText) ||
    getOperativeRestorationEvents(caseData).length > 0
  );
}

function toothScope(tooth: string, label = "Tooth not set"): WorkflowScope {
  return {
    kind: "tooth",
    tooth: tooth || undefined,
    label: tooth ? `Tooth ${tooth}` : label,
  };
}

function operativeScope(caseData: EndoCase): WorkflowScope {
  const setup = getLatestOperativeWorkflowSetup(caseData);
  const surfaces = normalizeOperativeSurfaces(setup.surfaces);
  const tooth = setup.tooth || caseData.tooth;
  return {
    kind: surfaces.length ? "surface" : "tooth",
    tooth: tooth || undefined,
    surfaces: surfaces.length ? surfaces : undefined,
    label: tooth
      ? surfaces.length
        ? `Tooth ${tooth} · ${surfaces.join(" ")}`
        : `Tooth ${tooth}`
      : "Operative target not set",
  };
}

function makeWorkflowRunId(workflowType: string) {
  return `run_${workflowType.replaceAll(".", "_").replaceAll("-", "_")}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function makeWorkflowInstanceId(workflowType: string) {
  return `instance_${workflowType.replaceAll(".", "_").replaceAll("-", "_")}_${globalThis.crypto.randomUUID()}`;
}

function createInstance(
  workflowId: string,
  caseData: EndoCase,
  now: string,
  options: { id?: string; workflowRunId?: string; status?: PrimaryWorkflowInstance["status"] } = {}
): PrimaryWorkflowInstance {
  const definition = selectablePrimaryWorkflows.find((item) => item.workflowId === workflowId);
  if (!definition) throw new Error(`Unsupported primary workflow: ${workflowId}`);
  return {
    id: options.id || makeWorkflowInstanceId(definition.workflowType),
    workflowType: definition.workflowType,
    workflowId: definition.workflowId,
    discipline: definition.discipline,
    label: definition.label,
    procedureLabel: definition.defaultProcedureLabel,
    target: workflowId === operativeDirectRestorationWorkflowId ? operativeScope(caseData) : toothScope(caseData.tooth),
    status: options.status || "notStarted",
    createdAt: now,
    updatedAt: now,
    workflowRunId: options.workflowRunId || makeWorkflowRunId(definition.workflowType),
    sourceEventIds: [],
  };
}

function normalizeScope(value: unknown, fallback: WorkflowScope): WorkflowScope {
  if (!value || typeof value !== "object") return fallback;
  const scope = value as Partial<WorkflowScope>;
  return {
    kind: scope.kind || fallback.kind,
    patientId: hasText(scope.patientId) ? String(scope.patientId) : undefined,
    visitId: hasText(scope.visitId) ? String(scope.visitId) : undefined,
    procedureId: hasText(scope.procedureId) ? String(scope.procedureId) : undefined,
    tooth: hasText(scope.tooth) ? String(scope.tooth) : undefined,
    teeth: Array.isArray(scope.teeth) ? scope.teeth.map(String).filter(Boolean) : undefined,
    canal: hasText(scope.canal) ? String(scope.canal) : undefined,
    surface: hasText(scope.surface) ? String(scope.surface) : undefined,
    surfaces: Array.isArray(scope.surfaces) ? scope.surfaces.map(String).filter(Boolean) : undefined,
    regionLabel: hasText(scope.regionLabel) ? String(scope.regionLabel) : undefined,
    label: hasText(scope.label) ? String(scope.label) : fallback.label,
    details: scope.details && typeof scope.details === "object" ? scope.details : undefined,
  };
}

function normalizeInstance(value: unknown, caseData: EndoCase, now: string): PrimaryWorkflowInstance | null {
  if (!value || typeof value !== "object") return null;
  const instance = value as Partial<PrimaryWorkflowInstance>;
  const definition = selectablePrimaryWorkflows.find(
    (item) => item.workflowId === instance.workflowId || item.workflowType === instance.workflowType
  );
  if (!definition || !hasText(instance.id)) return null;
  const fallbackScope = definition.workflowId === operativeDirectRestorationWorkflowId
    ? operativeScope(caseData)
    : toothScope(caseData.tooth);
  const status = instance.status === "complete" || instance.status === "inProgress" ? instance.status : "notStarted";
  return {
    id: String(instance.id),
    workflowType: definition.workflowType,
    workflowId: definition.workflowId,
    discipline: definition.discipline,
    label: definition.label,
    procedureLabel: hasText(instance.procedureLabel) ? String(instance.procedureLabel) : definition.defaultProcedureLabel,
    target: normalizeScope(instance.target, fallbackScope),
    status,
    createdAt: hasText(instance.createdAt) ? String(instance.createdAt) : now,
    updatedAt: hasText(instance.updatedAt) ? String(instance.updatedAt) : now,
    workflowRunId: hasText(instance.workflowRunId) ? String(instance.workflowRunId) : makeWorkflowRunId(definition.workflowType),
    sourceEventIds: Array.isArray(instance.sourceEventIds) ? instance.sourceEventIds.map(String).filter(Boolean) : [],
  };
}

function updateKnownInstance(instance: PrimaryWorkflowInstance, caseData: EndoCase, currentNodeId: string) {
  if (instance.workflowId === endodonticRootWorkflowId) {
    const events = endodonticEvents(caseData).filter((event) => eventMatchesWorkflowInstance(event, instance));
    const matchingInstanceIsActive = caseData.activeWorkflowInstanceId
      ? caseData.activeWorkflowInstanceId === instance.id
      : (caseData.workflowInstances || []).filter((item) => item.workflowId === endodonticRootWorkflowId).length <= 1;
    const endodonticNodeActive = matchingInstanceIsActive && currentNodeId !== "preop" && Boolean(protocolNodes[currentNodeId]);
    const complete = events.some((event) => event.type === "closure.finalRestoration")
      || (matchingInstanceIsActive && currentNodeId === "endodontic-pathway-complete");
    return {
      ...instance,
      status: complete ? "complete" as const : events.length > 0 || endodonticNodeActive ? "inProgress" as const : instance.status,
      updatedAt: events.at(-1)?.timestamp || instance.updatedAt,
      sourceEventIds: Array.from(new Set([...(instance.sourceEventIds || []), ...events.map((event) => event.id).filter(Boolean)])),
    };
  }

  if (instance.workflowId === operativeDirectRestorationWorkflowId) {
    const events = operativeEvents(caseData).filter((event) => eventMatchesWorkflowInstance(event, instance));
    const complete = events.some((event) => event.type === "finalRestoration.placed");
    const hasSetup = events.some(isOperativeScopeRecordedEvent);
    const latestTargetEvent = events.filter((event) => isOperativeScopeRecordedEvent(event) || event.type === "finalRestoration.placed").at(-1);
    return {
      ...instance,
      target: latestTargetEvent?.scope ? normalizeScope(latestTargetEvent.scope, instance.target) : instance.target,
      status: complete ? "complete" as const : hasSetup ? "inProgress" as const : instance.status,
      updatedAt: events.at(-1)?.timestamp || instance.updatedAt,
      sourceEventIds: Array.from(new Set([...(instance.sourceEventIds || []), ...events.map((event) => event.id).filter(Boolean)])),
    };
  }

  return instance;
}

function createLegacyInstances(caseData: EndoCase, currentNodeId: string, now: string) {
  const instances: PrimaryWorkflowInstance[] = [];
  if (hasEndodonticActivity(caseData, currentNodeId)) {
    const instance = createInstance(endodonticRootWorkflowId, caseData, caseData.createdAt || now, {
      id: "instance_endo_legacy",
      workflowRunId: "run_endo_legacy",
    });
    instance.procedureLabel = endodonticProcedureOptions.includes(caseData.procedureType) ? caseData.procedureType : "RCT";
    instances.push(updateKnownInstance(instance, caseData, currentNodeId));
  }
  if (hasOperativeActivity(caseData)) {
    const sourceEvents = operativeEvents(caseData);
    const instanceId = sourceEvents.find((event) => hasText(event.details?.workflowInstanceId))?.details?.workflowInstanceId;
    const workflowRunId = sourceEvents.find((event) => hasText(event.workflowRunId))?.workflowRunId;
    instances.push(updateKnownInstance(
      createInstance(operativeDirectRestorationWorkflowId, caseData, sourceEvents[0]?.timestamp || caseData.createdAt || now, {
        id: instanceId || "instance_operative_legacy",
        workflowRunId: workflowRunId || "run_operative_legacy",
      }),
      caseData,
      currentNodeId
    ));
  }
  return instances;
}

export function normalizeWorkflowInstances(caseData: EndoCase, currentNodeId = caseData.currentNodeId || "preop", now = new Date().toISOString()) {
  const normalized = (Array.isArray(caseData.workflowInstances) ? caseData.workflowInstances : [])
    .map((instance) => normalizeInstance(instance, caseData, caseData.autosavedAt || now))
    .filter(Boolean) as PrimaryWorkflowInstance[];
  const byId = new Map(normalized.map((instance) => [instance.id, updateKnownInstance(instance, caseData, currentNodeId)]));

  for (const legacyInstance of createLegacyInstances(caseData, currentNodeId, now)) {
    const hasWorkflow = [...byId.values()].some((instance) => instance.workflowId === legacyInstance.workflowId);
    if (!hasWorkflow) byId.set(legacyInstance.id, legacyInstance);
  }

  return [...byId.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function normalizeCaseWorkflowInstances(caseData: EndoCase, currentNodeId = caseData.currentNodeId || "preop", now = new Date().toISOString()): EndoCase {
  const workflowInstances = normalizeWorkflowInstances(caseData, currentNodeId, now);
  const activeWorkflowInstanceId = workflowInstances.some((instance) => instance.id === caseData.activeWorkflowInstanceId)
    ? caseData.activeWorkflowInstanceId
    : "";
  return {
    ...caseData,
    workflowInstances,
    activeWorkflowInstanceId,
    procedureType: compatibilityProcedureForInstances(workflowInstances),
  };
}

export function getWorkflowInstance(caseData: EndoCase, workflowId: string, currentNodeId = caseData.currentNodeId || "preop") {
  return normalizeWorkflowInstances(caseData, currentNodeId).find((instance) => instance.workflowId === workflowId);
}

export function getActiveWorkflowInstance(
  caseData: EndoCase,
  currentNodeId = caseData.currentNodeId || "preop",
  workflowId?: string
) {
  const instances = normalizeWorkflowInstances(caseData, currentNodeId);
  const active = instances.find((instance) => instance.id === caseData.activeWorkflowInstanceId);
  if (active && (!workflowId || active.workflowId === workflowId)) return active;
  if (workflowId) return instances.find((instance) => instance.workflowId === workflowId);
  return instances.length === 1 ? instances[0] : undefined;
}

export function getWorkflowTargetTooth(
  caseData: EndoCase,
  workflowId: string,
  currentNodeId = caseData.currentNodeId || "preop"
) {
  const instance = getActiveWorkflowInstance(caseData, currentNodeId, workflowId);
  if (!instance) return caseData.tooth;
  return instance.target.tooth?.trim()
    || instance.target.teeth?.find((tooth) => tooth.trim())?.trim()
    || "";
}

export function getPrimaryCaseTargetTooth(
  caseData: EndoCase,
  currentNodeId = caseData.currentNodeId || "preop"
) {
  const instances = normalizeWorkflowInstances(caseData, currentNodeId);
  const endodontic = instances.find((instance) => instance.workflowId === endodonticRootWorkflowId);
  const preferred = endodontic
    || instances.find((instance) => instance.id === caseData.activeWorkflowInstanceId)
    || instances[0];
  if (!preferred) return caseData.tooth;
  return preferred.target.tooth?.trim()
    || preferred.target.teeth?.find((tooth) => tooth.trim())?.trim()
    || "";
}

export function getWorkflowTargetEditability(
  caseData: EndoCase,
  instanceId: string,
  currentNodeId = caseData.currentNodeId || "preop"
) {
  const instance = normalizeWorkflowInstances(caseData, currentNodeId).find((item) => item.id === instanceId);
  if (!instance) return { editable: false, reason: "Workflow instance not found." };
  if (instance.status !== "notStarted" || instance.sourceEventIds.length > 0) {
    return {
      editable: false,
      reason: "The target is locked because this workflow has recorded clinical activity.",
    };
  }
  return { editable: true, reason: "" };
}

export function updateWorkflowInstanceTarget(
  caseData: EndoCase,
  instanceId: string,
  target: WorkflowScope,
  currentNodeId = caseData.currentNodeId || "preop",
  now = new Date().toISOString()
) {
  if (!getWorkflowTargetEditability(caseData, instanceId, currentNodeId).editable) return caseData;
  const workflowInstances = normalizeWorkflowInstances(caseData, currentNodeId, now).map((instance) =>
    instance.id === instanceId
      ? { ...instance, target: normalizeScope(target, instance.target), updatedAt: now }
      : instance
  );
  return {
    ...caseData,
    workflowInstances,
  };
}

export function isPrimaryWorkflowSelected(caseData: EndoCase, workflowId: string, currentNodeId = caseData.currentNodeId || "preop") {
  return Boolean(getWorkflowInstance(caseData, workflowId, currentNodeId));
}

function compatibilityProcedureForInstances(instances: PrimaryWorkflowInstance[]) {
  const endodontic = instances.find((instance) => instance.workflowId === endodonticRootWorkflowId);
  const operative = instances.find((instance) => instance.workflowId === operativeDirectRestorationWorkflowId);
  if (endodontic && operative) return multidisciplinaryProcedure;
  if (endodontic) return endodontic.procedureLabel || "RCT";
  if (operative) return "Direct restoration";
  return noTreatmentSelectedProcedure;
}

export function addPrimaryWorkflow(
  caseData: EndoCase,
  workflowId: string,
  currentNodeId = caseData.currentNodeId || "preop",
  options: { id?: string; workflowRunId?: string; makeActive?: boolean; now?: string } = {}
) {
  const now = options.now || new Date().toISOString();
  const existing = normalizeWorkflowInstances(caseData, currentNodeId, now);
  const selected = existing.find((instance) => instance.workflowId === workflowId);
  const nextInstance = selected || createInstance(workflowId, caseData, now, options);
  const workflowInstances = selected ? existing : [...existing, nextInstance];
  return {
    ...caseData,
    workflowInstances,
    activeWorkflowInstanceId: options.makeActive ? nextInstance.id : caseData.activeWorkflowInstanceId,
    procedureType: compatibilityProcedureForInstances(workflowInstances),
  };
}

export function canRemovePrimaryWorkflow(instance: PrimaryWorkflowInstance) {
  return instance.status === "notStarted" && instance.sourceEventIds.length === 0;
}

export function removePrimaryWorkflow(caseData: EndoCase, workflowId: string, currentNodeId = caseData.currentNodeId || "preop") {
  const existing = normalizeWorkflowInstances(caseData, currentNodeId);
  const target = existing.find((instance) => instance.workflowId === workflowId);
  if (!target || !canRemovePrimaryWorkflow(target)) return caseData;
  const workflowInstances = existing.filter((instance) => instance.id !== target.id);
  return {
    ...caseData,
    workflowInstances,
    activeWorkflowInstanceId: caseData.activeWorkflowInstanceId === target.id ? "" : caseData.activeWorkflowInstanceId,
    procedureType: compatibilityProcedureForInstances(workflowInstances),
  };
}

export function updateWorkflowProcedureLabel(
  caseData: EndoCase,
  workflowId: string,
  procedureLabel: string,
  currentNodeId = caseData.currentNodeId || "preop"
) {
  const workflowInstances = normalizeWorkflowInstances(caseData, currentNodeId).map((instance) =>
    instance.workflowId === workflowId
      ? { ...instance, procedureLabel, updatedAt: new Date().toISOString() }
      : instance
  );
  return {
    ...caseData,
    workflowInstances,
    procedureType: compatibilityProcedureForInstances(workflowInstances),
  };
}

export function getEventWorkflowInstanceId(event?: ClinicalEvent | null) {
  return hasText(event?.details?.workflowInstanceId) ? String(event?.details?.workflowInstanceId) : undefined;
}
