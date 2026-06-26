import type { CanalRecord, EndoCase } from "../types";
import type { ClinicalEvent } from "../types";
import { normalizeWorkflowInstances } from "../workflow/workflowInstances";

export const STORAGE_KEY = "endo-chairside-guide-current-case";
export const CASE_INDEX_KEY = "endo-chairside-guide-case-index";
export const CASE_RECORD_PREFIX = "endo-chairside-guide-case-record:";

export const caseStatusOptions = [
  "RCT planned",
  "RCT initiated",
  "RCT completed",
  "Medicated and temporized",
  "Referred",
  "Resume next visit",
];

export function makeCaseId(caseData: Pick<EndoCase, "patientNumber" | "tooth" | "procedureType">) {
  const patient = String(caseData.patientNumber || "no-patient").trim() || "no-patient";
  const tooth = String(caseData.tooth || "unknown-tooth").trim() || "unknown-tooth";
  const procedure = String(caseData.procedureType || "RCT").trim() || "RCT";
  return `${patient}__${tooth}__${procedure}`.replaceAll(" ", "-");
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
  patientNumber: "",
  autosavedAt: "",
  tooth: "",
  procedureType: "RCT",
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
  workflowInstances: [],
  activeWorkflowInstanceId: "",
};

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

  const normalizedCase = {
    ...initialCase,
    ...data,
    priorVisit: { ...(initialCase.priorVisit || {}), ...asRecord(data.priorVisit) },
    canals: importedCanals,
    currentCanal: typeof data.currentCanal === "string" && data.currentCanal ? data.currentCanal : importedCanals[0]?.name || initialCase.currentCanal,
    globalEvents,
    autosavedAt,
  } as EndoCase;
  const workflowInstances = normalizeWorkflowInstances(normalizedCase, typeof data.currentNodeId === "string" ? data.currentNodeId : undefined, autosavedAt);
  const activeWorkflowInstanceId = typeof data.activeWorkflowInstanceId === "string" && workflowInstances.some((instance) => instance.id === data.activeWorkflowInstanceId)
    ? data.activeWorkflowInstanceId
    : "";

  return {
    ...normalizedCase,
    workflowInstances,
    activeWorkflowInstanceId,
  };
}
