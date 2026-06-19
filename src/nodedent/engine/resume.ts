import type { CanalRecord, PriorCanalStatus } from "../types";
import { hasEvent } from "./deriveCanalStatus";
import { isBlank } from "./measurements";

export const priorCanalStatusLabels: Record<PriorCanalStatus, string> = {
  "": "Not set",
  unknown: "Unknown",
  accessOnly: "Access only",
  locatedScouted: "Located / scouted",
  wlEstablished: "WL established",
  glidePath: "Glide path complete",
  shaped: "Shaped",
  medicatedTemporized: "Medicated / temporized",
  coneFitVerified: "Cone fit verified",
  partiallyObturated: "Partially obturated",
};

const manualStatusEventTypes = new Set(["canal.paused", "canal.medicated"]);
const nonResumeEventTypes = new Set([
  "canal.completed",
  "canal.paused",
  "canal.medicated",
  "canal.referred",
  "closure.temporary",
  "closure.orificeBarrierTemporary",
  "closure.finalRestoration",
  "medication.calciumHydroxidePlaced",
  "workflow.switchedCanal",
]);

export function getConservativeResumeNodeForCanal(canal?: CanalRecord | null) {
  if (!canal) return "estimate-wl";
  if ((hasEvent(canal, "coneFit.radiographAcceptable") || canal.priorVisitStatus === "coneFitVerified") && !isBlank(canal.masterCone) && !isBlank(canal.shapingLength) && canal.coneFitRadiograph === "acceptable") {
    return "ready-for-sealer-cone-seating";
  }
  if (hasEvent(canal, "coneFit.masterConeFits") || hasEvent(canal, "coneFit.radiographAcceptable") || canal.priorVisitStatus === "coneFitVerified") return "cone-fit-radiograph";
  if (hasEvent(canal, "disinfection.readyForObturation") || hasEvent(canal, "disinfection.finalNaOClCompleted")) return "ready-for-obturation";
  if (hasEvent(canal, "shaping.completed") || !isBlank(canal.finalShape) || canal.priorVisitStatus === "shaped" || canal.priorVisitStatus === "medicatedTemporized") return "remove-smear-layer";
  if (hasEvent(canal, "glidePath.created") || canal.priorVisitStatus === "glidePath") return "gauge-final-shape";
  if (hasEvent(canal, "workingLength.established") || !isBlank(canal.eal0) || canal.priorVisitStatus === "wlEstablished") return "patency-10c";
  if (hasEvent(canal, "scouting.estimatedWLSet") || canal.priorVisitStatus === "locatedScouted") return "open-orifice";
  if (!isBlank(canal.estimatedWorkingLength)) return "estimate-wl";
  if (canal.priorVisitStatus === "accessOnly" || canal.priorVisitStatus === "unknown" || canal.priorVisitStatus === "partiallyObturated") return "identify-canals";
  return "estimate-wl";
}

export function getPriorVisitResumeNodeForCanal(canal?: CanalRecord | null) {
  if (!canal?.priorVisitStatus) return null;
  if (canal.priorVisitStatus === "partiallyObturated") return "ready-for-sealer-cone-seating";
  return getConservativeResumeNodeForCanal(canal);
}

export function getManualResumeNodeForCanal(canal?: CanalRecord | null) {
  const manualEvent = [...(canal?.events || [])].reverse().find((event) => manualStatusEventTypes.has(event.type));
  if (!manualEvent) return null;

  const recordedNode = manualEvent.details?.resumeNodeId || manualEvent.details?.nodeId;
  if (manualEvent.type === "canal.paused" && recordedNode === "endodontic-pathway-complete") return null;
  if (manualEvent.type === "canal.paused" && recordedNode && recordedNode !== "endodontic-pathway-complete" && recordedNode !== "temporary-closure") {
    return recordedNode;
  }

  return getConservativeResumeNodeForCanal(canal);
}

export function getLastSystemResumeNodeForCanal(canal?: CanalRecord | null) {
  const lastTrackedEvent = [...(canal?.events || [])].reverse().find((event) => event.type && !nonResumeEventTypes.has(event.type));
  if (lastTrackedEvent?.details?.nodeId) return getConservativeResumeNodeForCanal(canal);
  return getConservativeResumeNodeForCanal(canal);
}
