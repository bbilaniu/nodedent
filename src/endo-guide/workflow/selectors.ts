import type { CapabilityName, CapabilitySatisfaction, ClinicalEvent, EndoCase, KnownCapabilityName, WorkflowScope } from "../types";
import { isBlank } from "../engine/measurements";
import { capabilityScopeRules, knownCapabilityNames } from "./capabilities";

export type CapabilityStatusSource = "caseField" | "event" | "none";

export type CapabilityStatus = {
  name: KnownCapabilityName;
  satisfied: boolean;
  needsReassessment: boolean;
  source: CapabilityStatusSource;
  sourceEvent?: ClinicalEvent;
  scope?: WorkflowScope;
  summary: string;
  reason?: string;
};

export type CaseCapabilitySummary = {
  diagnosis: CapabilityStatus;
  radiographs: CapabilityStatus;
  anesthesia: CapabilityStatus;
  isolation: CapabilityStatus;
};

const knownCapabilityNameSet = new Set<CapabilityName>(knownCapabilityNames);
const isolationEstablishedEvents = new Set(["isolation.established", "isolation.rubberDamPlaced", "isolation.alternativeIsolationUsed", "isolation.replaced"]);
const isolationInvalidatingEvents = new Set(["isolation.compromised", "isolation.removed", "isolation.failed"]);

export function isKnownCapabilityName(name: CapabilityName): name is KnownCapabilityName {
  return knownCapabilityNameSet.has(name);
}

function collectClinicalEvents(caseData: EndoCase) {
  const seen = new Set<string>();
  const events: ClinicalEvent[] = [];

  [...(caseData.globalEvents || []), ...(caseData.events || []), ...(caseData.canals || []).flatMap((canal) => canal.events || [])].forEach((event) => {
    const key = event.id || `${event.timestamp}:${event.type}:${event.canal || ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    events.push(event);
  });

  return events.sort((a, b) => String(a.timestamp || "").localeCompare(String(b.timestamp || "")));
}

function getEventDetails(event: ClinicalEvent) {
  return event.details && typeof event.details === "object" ? event.details : {};
}

function getEventScope(event: ClinicalEvent): WorkflowScope | undefined {
  if (event.scope) return event.scope;
  const details = getEventDetails(event);
  const exposedTeeth = Array.isArray(details.exposedTeeth) ? details.exposedTeeth.map(String) : undefined;
  const teeth = exposedTeeth || (Array.isArray(details.teeth) ? details.teeth.map(String) : undefined);
  const tooth = typeof details.tooth === "string" ? details.tooth : event.tooth;
  const regionLabel = typeof details.regionLabel === "string" ? details.regionLabel : undefined;

  if (teeth?.length) return { kind: "custom", teeth, regionLabel };
  if (tooth) return { kind: "tooth", tooth };
  if (event.canal && event.canal !== "All" && event.canal !== "N/A") return { kind: "canal", tooth: event.tooth, canal: event.canal };
  if (event.tooth) return { kind: "tooth", tooth: event.tooth };
  return undefined;
}

function scopeMatches(candidate?: WorkflowScope, query?: WorkflowScope) {
  if (!query || !candidate) return true;
  if (query.kind === "patient") return candidate.kind === "patient";
  if (candidate.kind === "patient") return true;

  if (query.tooth) {
    if (candidate.tooth === query.tooth) return true;
    if (candidate.teeth?.includes(query.tooth)) return true;
  }

  if (query.canal && candidate.canal && query.canal !== candidate.canal) return false;
  if (query.surface && candidate.surfaces?.includes(query.surface)) return true;
  if (query.surface && candidate.surface === query.surface) return true;

  if (query.kind === candidate.kind && query.regionLabel && candidate.regionLabel === query.regionLabel) return true;
  if (query.procedureId && candidate.procedureId === query.procedureId) return true;

  return false;
}

function eventSatisfiesCapability(event: ClinicalEvent, name: KnownCapabilityName): CapabilitySatisfaction | undefined {
  return event.capabilitiesSatisfied?.find((capability) => capability.name === name);
}

function isExpired(expiresAt?: string, now = new Date()) {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt);
  return Number.isFinite(expiry.getTime()) && expiry.getTime() <= now.getTime();
}

function statusFromCapabilityEvent(event: ClinicalEvent, capability: CapabilitySatisfaction, name: KnownCapabilityName, now: Date): CapabilityStatus {
  const expired = isExpired(capability.expiresAt || event.expiresAt, now);
  return {
    name,
    satisfied: !expired,
    needsReassessment: expired,
    source: "event",
    sourceEvent: event,
    scope: capability.scope,
    summary: expired ? `${name} was recorded but needs reassessment` : `${name} recorded`,
    reason: expired ? "Recorded capability has expired." : undefined,
  };
}

function diagnosisStatus(caseData: EndoCase): CapabilityStatus {
  const hasDiagnosis = !isBlank(caseData.diagnosis?.pulpal) || !isBlank(caseData.diagnosis?.apical);
  return {
    name: "diagnosis.recorded",
    satisfied: hasDiagnosis,
    needsReassessment: false,
    source: hasDiagnosis ? "caseField" : "none",
    scope: caseData.tooth ? { kind: "tooth", tooth: caseData.tooth } : undefined,
    summary: hasDiagnosis ? "Diagnosis recorded" : "Diagnosis not recorded",
    reason: hasDiagnosis ? undefined : "No pulpal or apical diagnosis is recorded.",
  };
}

function radiographStatus(caseData: EndoCase): CapabilityStatus {
  const hasRadiographs = Boolean(
    caseData.preOp?.paReviewed ||
      caseData.preOp?.radiographsReviewed ||
      caseData.preOp?.bwReviewed ||
      caseData.preOp?.cbctReviewed ||
      caseData.priorVisit?.priorRadiographsAvailable
  );
  return {
    name: "radiographs.reviewed",
    satisfied: hasRadiographs,
    needsReassessment: false,
    source: hasRadiographs ? "caseField" : "none",
    scope: caseData.tooth ? { kind: "tooth", tooth: caseData.tooth } : undefined,
    summary: hasRadiographs ? "Radiographs reviewed" : "Radiographs not recorded",
    reason: hasRadiographs ? undefined : "No pre-op or prior radiograph review is recorded.",
  };
}

function fallbackStatusFromEvents(name: KnownCapabilityName, events: ClinicalEvent[], queryScope: WorkflowScope | undefined): CapabilityStatus | undefined {
  if (name !== "isolation.established") return undefined;

  const matchingEvents = events.filter((event) => {
    const eventScope = getEventScope(event);
    return (isolationEstablishedEvents.has(event.type) || isolationInvalidatingEvents.has(event.type)) && scopeMatches(eventScope, queryScope);
  });
  const latest = matchingEvents.at(-1);
  if (!latest) return undefined;

  const invalidated = isolationInvalidatingEvents.has(latest.type);
  return {
    name,
    satisfied: !invalidated,
    needsReassessment: invalidated,
    source: "event",
    sourceEvent: latest,
    scope: getEventScope(latest),
    summary: invalidated ? "Isolation needs reassessment" : "Isolation established",
    reason: invalidated ? "The latest matching isolation event indicates compromised or removed isolation." : undefined,
  };
}

export function getCapabilityStatus(caseData: EndoCase, name: KnownCapabilityName, queryScope?: WorkflowScope, now = new Date()): CapabilityStatus {
  if (name === "diagnosis.recorded") return diagnosisStatus(caseData);
  if (name === "radiographs.reviewed") return radiographStatus(caseData);

  const events = collectClinicalEvents(caseData);
  const explicitStatus = events
    .flatMap((event) => {
      const capability = eventSatisfiesCapability(event, name);
      if (!capability || !scopeMatches(capability.scope, queryScope)) return [];
      return [statusFromCapabilityEvent(event, capability, name, now)];
    })
    .at(-1);

  if (explicitStatus) return explicitStatus;

  const fallbackStatus = fallbackStatusFromEvents(name, events, queryScope);
  if (fallbackStatus) return fallbackStatus;

  const rule = capabilityScopeRules[name];
  return {
    name,
    satisfied: false,
    needsReassessment: false,
    source: "none",
    scope: queryScope,
    summary: `${name} not recorded`,
    reason: rule.requiresCurrentVisit ? "No current-visit event satisfies this capability." : "No matching case field or event satisfies this capability.",
  };
}

export function getCaseCapabilitySummary(caseData: EndoCase, tooth = caseData.tooth): CaseCapabilitySummary {
  const toothScope: WorkflowScope | undefined = tooth ? { kind: "tooth", tooth } : undefined;
  return {
    diagnosis: getCapabilityStatus(caseData, "diagnosis.recorded", toothScope),
    radiographs: getCapabilityStatus(caseData, "radiographs.reviewed", toothScope),
    anesthesia: getCapabilityStatus(caseData, "anesthesia.adequate", toothScope),
    isolation: getCapabilityStatus(caseData, "isolation.established", toothScope),
  };
}

export function getCapabilityReassessmentStatus(caseData: EndoCase, name: KnownCapabilityName, queryScope?: WorkflowScope, now = new Date()) {
  return getCapabilityStatus(caseData, name, queryScope, now).needsReassessment;
}

export function isCapabilitySatisfied(caseData: EndoCase, name: KnownCapabilityName, queryScope?: WorkflowScope, now = new Date()) {
  return getCapabilityStatus(caseData, name, queryScope, now).satisfied;
}

export function getKnownCapabilityStatuses(caseData: EndoCase, queryScope?: WorkflowScope) {
  return knownCapabilityNames.filter(isKnownCapabilityName).map((name) => getCapabilityStatus(caseData, name, queryScope));
}
