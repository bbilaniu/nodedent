import type { CanalRecord, EndoCase } from "../types";
import type { ClinicalEvent } from "../types";

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
  diagnosis: { pulpal: "", apical: "" },
  difficulty: "none",
  preOp: { radiographsReviewed: true, cbctReviewed: false, estimatedChamberDepth: "" },
  currentCanal: "Main",
  canals: [blankCanal("Main")],
  globalEvents: [],
  closure: null,
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
