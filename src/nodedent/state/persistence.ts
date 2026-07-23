import type { CanalRecord, EndoCase } from "../types";
import type { ClinicalEvent } from "../types";
import { noTreatmentSelectedProcedure } from "../workflow/procedures";

export const LEGACY_STORAGE_KEY = "endo-chairside-guide-current-case";
export const LEGACY_CASE_INDEX_KEY = "endo-chairside-guide-case-index";
export const LEGACY_CASE_RECORD_PREFIX = "endo-chairside-guide-case-record:";

export const caseStatusOptions = [
  noTreatmentSelectedProcedure,
  "RCT planned",
  "Retreatment planned",
  "Emergency pulpectomy planned",
  "Direct restoration planned",
  "RCT initiated",
  "RCT completed",
  "Medicated and temporized",
  "Referred",
  "Resume next visit",
];

export function createEncounterId() {
  return globalThis.crypto.randomUUID();
}

export const blankCanal = (name: string): CanalRecord => ({
  name,
  priorVisitStatus: "",
  priorVisitNote: "",
  estimatedWorkingLength: "",
  fileTerminalLength: "",
  availableTreatmentSpace: "",
  referencePoint: "",
  eal0: "",
  patencyLength: "",
  shapingLength: "",
  wlRadiographStatus: "",
  finalShape: "",
  obturationGauge: "",
  masterCone: "",
  coneFitRadiograph: "",
  dryingStatus: "",
  events: [],
});

export const initialCase: EndoCase = {
  encounterId: "",
  createdAt: "",
  revision: 0,
  patientNumber: "",
  autosavedAt: "",
  tooth: "",
  procedureType: noTreatmentSelectedProcedure,
  caseStatus: "",
  nextVisitPlan: "",
  priorVisit: {
    continuedFromPriorVisit: false,
    priorVisitDate: "",
    accessPreviouslyOpened: false,
    temporaryRestorationPresent: false,
    medicationPresent: "",
    priorRadiographsAvailable: false,
    sourceNote: "",
  },
  diagnosis: { pulpal: "", apical: "" },
  difficulty: "none",
  preOp: {
    radiographsReviewed: false,
    paReviewed: false,
    bwReviewed: false,
    cbctReviewed: false,
    estimatedChamberDepth: "",
  },
  currentCanal: "Main",
  canals: [blankCanal("Main")],
  globalEvents: [],
  closure: null,
};

export function createFreshCase(now = new Date().toISOString()): EndoCase {
  return {
    ...initialCase,
    encounterId: createEncounterId(),
    createdAt: now,
    autosavedAt: now,
    priorVisit: { ...initialCase.priorVisit },
    diagnosis: { ...initialCase.diagnosis },
    preOp: { ...initialCase.preOp },
    canals: [blankCanal("Main")],
    globalEvents: [],
  };
}

export function makeDefaultNewCanalName(existingCanals: CanalRecord[] = []) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const baseName = `New ${hh}:${mm}`;
  const existingNames = new Set(existingCanals.map((canal) => canal.name));
  if (!existingNames.has(baseName)) return baseName;
  let counter = 2;
  while (existingNames.has(`${baseName} ${counter}`)) counter += 1;
  return `${baseName} ${counter}`;
}

function shouldHydrateCaseWideEventForCanal(event?: ClinicalEvent) {
  const isCaseWide = event?.canal === "All" || event?.canal === "N/A" || !event?.canal;
  return isCaseWide && event?.type?.startsWith("closure.") && event?.details?.nodeId === "close-access";
}

export function hydrateCanalEventsFromGlobalEvents(canal: CanalRecord, globalEvents: ClinicalEvent[] = []) {
  const explicitEvents = Array.isArray(canal?.events) ? canal.events : [];
  const eventIds = new Set(explicitEvents.map((event) => event.id).filter(Boolean));
  const restoredEvents = globalEvents.filter((event) => {
    const appliesToCanal = event?.canal === canal?.name || shouldHydrateCaseWideEventForCanal(event);
    if (!appliesToCanal) return false;
    if (event.id && eventIds.has(event.id)) return false;
    return true;
  });

  return [...explicitEvents, ...restoredEvents];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function normalizeImportedEndoCase(parsed: unknown, autosavedAt = new Date().toISOString()): EndoCase {
  const data = asRecord(parsed);
  const globalEvents = Array.isArray(data.events)
    ? data.events as ClinicalEvent[]
    : Array.isArray(data.globalEvents)
      ? data.globalEvents as ClinicalEvent[]
      : [];
  const parsedCanals = Array.isArray(data.canals) ? data.canals : [];
  const importedCanals = parsedCanals.length
    ? parsedCanals.map((canal) => {
        const canalRecord = asRecord(canal);
        const normalizedCanal = { ...blankCanal(String(canalRecord.name || "Canal")), ...canalRecord } as CanalRecord;
        return { ...normalizedCanal, events: hydrateCanalEventsFromGlobalEvents(normalizedCanal, globalEvents) };
      })
    : initialCase.canals;

  return {
    ...initialCase,
    ...data,
    encounterId: typeof data.encounterId === "string" && data.encounterId.trim() ? data.encounterId : createEncounterId(),
    createdAt: typeof data.createdAt === "string" && data.createdAt ? data.createdAt : autosavedAt,
    revision: typeof data.revision === "number" && Number.isInteger(data.revision) && data.revision >= 0 ? data.revision : 0,
    priorVisit: { ...(initialCase.priorVisit || {}), ...asRecord(data.priorVisit) },
    canals: importedCanals,
    currentCanal: typeof data.currentCanal === "string" && data.currentCanal ? data.currentCanal : importedCanals[0]?.name || initialCase.currentCanal,
    globalEvents,
    autosavedAt,
  } as EndoCase;
}
