import type { CapabilityName, CapabilitySatisfaction, ClinicalEvent, EndoCase, KnownCapabilityName, WorkflowScope } from "../types";
import { isBlank } from "../engine/measurements";
import { capabilityScopeRules, knownCapabilityNames } from "./capabilities";
import { anesthesiaInvalidatingEventTypes, getAnesthesiaAdequateCapabilityOutput, getAnesthesiaScopeFromEvent } from "./anesthesia";
import { getIsolationScopeFromEvent, isolationEstablishedEventTypes, isolationInvalidatingEventTypes } from "./isolation";

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
const anesthesiaInvalidatingEvents = new Set<string>(anesthesiaInvalidatingEventTypes);
const isolationEstablishedEvents = new Set<string>(isolationEstablishedEventTypes);
const isolationInvalidatingEvents = new Set<string>(isolationInvalidatingEventTypes);

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
  if (getAnesthesiaAdequateCapabilityOutput(event) || anesthesiaInvalidatingEvents.has(event.type)) return getAnesthesiaScopeFromEvent(event);
  if (isolationEstablishedEvents.has(event.type) || isolationInvalidatingEvents.has(event.type)) return getIsolationScopeFromEvent(event);
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

function hasCanalSubscope(scope: WorkflowScope) {
  return scope.kind === "canal" || Boolean(scope.canal);
}

function hasSurfaceSubscope(scope: WorkflowScope) {
  return scope.kind === "surface" || Boolean(scope.surface || scope.surfaces?.length);
}

function scopeMatches(candidate?: WorkflowScope, query?: WorkflowScope) {
  if (!query || !candidate) return true;
  if (query.kind === "patient") return candidate.kind === "patient";
  if (candidate.kind === "patient") return true;

  const queryHasCanal = hasCanalSubscope(query);
  const candidateHasCanal = hasCanalSubscope(candidate);
  const queryHasSurface = hasSurfaceSubscope(query);
  const candidateHasSurface = hasSurfaceSubscope(candidate);

  if ((queryHasCanal && candidateHasSurface) || (queryHasSurface && candidateHasCanal)) return false;
  if (query.kind === "tooth" && (candidateHasCanal || candidateHasSurface)) return false;

  if (query.tooth) {
    const sameTooth = candidate.tooth === query.tooth || candidate.teeth?.includes(query.tooth);
    const candidateHasToothScope = Boolean(candidate.tooth || candidate.teeth?.length);
    if (candidateHasToothScope && !sameTooth) return false;
    if (sameTooth && !queryHasCanal && !queryHasSurface) return true;
  }

  if (query.canal && candidate.canal && query.canal !== candidate.canal) return false;
  if (query.canal && candidateHasCanal && !candidate.canal) return false;
  if (query.canal && !candidate.canal) return false;
  if (query.surface && candidate.surfaces?.includes(query.surface)) return true;
  if (query.surface && candidate.surface) return candidate.surface === query.surface;
  if (query.surface && candidateHasSurface) return false;
  if (query.surface && !candidate.surface) return false;
  if (query.surfaces?.length && candidate.surfaces?.length) return query.surfaces.every((surface) => candidate.surfaces?.includes(surface));
  if (query.surfaces?.length && candidate.surface) return query.surfaces.length === 1 && query.surfaces[0] === candidate.surface;
  if (query.surfaces?.length && candidateHasSurface) return false;

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

function eventTime(event?: ClinicalEvent) {
  const timestamp = event?.timestamp ? new Date(event.timestamp).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
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
  if (name !== "isolation.established" && name !== "anesthesia.adequate") return undefined;
  const invalidatingEvents = name === "anesthesia.adequate" ? anesthesiaInvalidatingEvents : isolationInvalidatingEvents;

  const matchingEvents = events.filter((event) => {
    const eventScope = getEventScope(event);
    const satisfiesCapability = name === "anesthesia.adequate"
      ? Boolean(getAnesthesiaAdequateCapabilityOutput(event))
      : isolationEstablishedEvents.has(event.type);
    return (satisfiesCapability || invalidatingEvents.has(event.type)) && scopeMatches(eventScope, queryScope);
  });
  const latest = matchingEvents.at(-1);
  if (!latest) return undefined;

  const invalidated = invalidatingEvents.has(latest.type);
  const summary = name === "anesthesia.adequate"
    ? invalidated ? "Anesthesia needs reassessment" : "Anesthesia adequate"
    : invalidated ? "Isolation needs reassessment" : "Isolation established";
  const reason = name === "anesthesia.adequate"
    ? "The latest matching anesthesia event indicates reassessment is needed."
    : "The latest matching isolation event indicates compromised or removed isolation.";
  return {
    name,
    satisfied: !invalidated,
    needsReassessment: invalidated,
    source: "event",
    sourceEvent: latest,
    scope: getEventScope(latest),
    summary,
    reason: invalidated ? reason : undefined,
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

  const fallbackStatus = fallbackStatusFromEvents(name, events, queryScope);
  if (explicitStatus && fallbackStatus && (name === "isolation.established" || name === "anesthesia.adequate")) {
    return eventTime(fallbackStatus.sourceEvent) >= eventTime(explicitStatus.sourceEvent) ? fallbackStatus : explicitStatus;
  }
  if (explicitStatus) return explicitStatus;
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
