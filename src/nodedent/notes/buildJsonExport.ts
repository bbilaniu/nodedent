import type { EndoCase } from "../types";
import { getOutputCaseStatus } from "../engine/deriveCaseStatus";
import { getCanalStatus, statusLabels } from "../engine/deriveCanalStatus";
import { inferCurrentNodeIdFromEvents } from "../engine/getCurrentNode";
import {
  getLatestOperativeWorkflowSetup,
  getOperativeRestorationEvents,
  getOperativeRestorationRecordFromEvent,
  isOperativeScopeRecordedEvent,
} from "../workflow/operative";
import { eventFragment } from "./fragments";
import { buildCompactNote } from "./buildCompactNote";

export function buildJsonExport(caseData: EndoCase, currentNodeId: string | null = null) {
  const latestOperativeSetupEvent = (caseData.globalEvents || []).filter(isOperativeScopeRecordedEvent).at(-1);
  const operativeRestorationEvents = getOperativeRestorationEvents(caseData);
  const hasOperativeOutput = Boolean(latestOperativeSetupEvent || operativeRestorationEvents.length);

  return {
    currentNodeId: currentNodeId || caseData.currentNodeId || inferCurrentNodeIdFromEvents(caseData),
    patientNumber: caseData.patientNumber,
    autosavedAt: caseData.autosavedAt,
    tooth: caseData.tooth,
    procedureType: caseData.procedureType,
    caseStatus: getOutputCaseStatus(caseData),
    currentCanal: caseData.currentCanal,
    nextVisitPlan: caseData.nextVisitPlan,
    priorVisit: caseData.priorVisit,
    diagnosis: caseData.diagnosis,
    difficulty: caseData.difficulty,
    preOp: caseData.preOp,
    canals: (caseData.canals || []).map((canal) => ({ ...canal, events: canal.events || [], status: statusLabels[getCanalStatus(canal)] })),
    closure: caseData.closure,
    operative: hasOperativeOutput
      ? {
          setup: latestOperativeSetupEvent
            ? {
                eventId: latestOperativeSetupEvent.id,
                timestamp: latestOperativeSetupEvent.timestamp,
                scope: latestOperativeSetupEvent.scope,
                record: getLatestOperativeWorkflowSetup(caseData),
              }
            : null,
          restorations: operativeRestorationEvents.map((event) => ({
            eventId: event.id,
            timestamp: event.timestamp,
            scope: event.scope,
            record: getOperativeRestorationRecordFromEvent(event),
            capabilitiesSatisfied: event.capabilitiesSatisfied || [],
          })),
        }
      : undefined,
    events: caseData.globalEvents,
  };
}

export function buildPrintableSummary(caseData: EndoCase) {
  const lines: string[] = [];
  lines.push("ENDODONTIC CHAIRSIDE SUMMARY");
  lines.push("============================");
  lines.push(`Patient #: ${caseData.patientNumber || "________________"}`);
  lines.push(`Tooth: ${caseData.tooth || "____"}`);
  lines.push(`Procedure: ${caseData.procedureType || "RCT"}`);
  lines.push(`Visit status: ${getOutputCaseStatus(caseData)}`);
  lines.push(`App metadata - autosaved: ${caseData.autosavedAt ? new Date(caseData.autosavedAt).toLocaleString() : "not recorded"}`);
  lines.push("");
  lines.push("CANALS");
  caseData.canals.forEach((canal) => {
    lines.push(`- ${canal.name} (${statusLabels[getCanalStatus(canal)]})`);
    lines.push(`  Est WL: ${canal.estimatedWorkingLength || "___"} mm | EAL0: ${canal.eal0 || "___"} mm | Patency: ${canal.patencyLength || "___"} mm | Shaping: ${canal.shapingLength || "___"} mm`);
    lines.push(`  WL PA: ${canal.wlRadiographStatus || "___"} | Ref: ${canal.referencePoint || "___"} | Final shaping file: ${canal.finalShape || "___"} | Gauge: ${canal.obturationGauge || "___"} | MC: ${canal.masterCone || "___"} | Cone fit PA: ${canal.coneFitRadiograph || "___"}`);
  });
  lines.push("");
  lines.push("COMPACT NOTE");
  lines.push(buildCompactNote(caseData));
  return lines.join(String.fromCharCode(10));
}

export function buildEventLogExport(caseData: EndoCase) {
  const lines: string[] = [];
  lines.push("ENDODONTIC EVENT LOG");
  lines.push("====================");
  lines.push(`Patient #: ${caseData.patientNumber || ""}`);
  lines.push(`Tooth: ${caseData.tooth || ""}`);
  lines.push(`Procedure: ${caseData.procedureType || "RCT"}`);
  lines.push(`Visit status: ${getOutputCaseStatus(caseData)}`);
  lines.push("");

  if (!caseData.globalEvents.length) {
    lines.push("No events recorded.");
    return lines.join(String.fromCharCode(10));
  }

  caseData.globalEvents.forEach((event, index) => {
    const time = event.timestamp ? new Date(event.timestamp).toLocaleString() : "no timestamp";
    lines.push(`${index + 1}. ${time}`);
    lines.push(`   Type: ${event.type}`);
    lines.push(`   Canal: ${event.canal || "case-level"}`);
    lines.push(`   Node: ${event.details?.nodeId || "not recorded"}`);
    lines.push(`   Decision: ${event.details?.decisionLabel || "not recorded"}`);
    lines.push(`   Note: ${eventFragment(event)}`);
    lines.push("");
  });

  return lines.join(String.fromCharCode(10));
}
