import type { CanalRecord, CanalStatus } from "../types";
import { isBlank } from "./measurements";

export const statusStyles: Record<CanalStatus, string> = {
  notStarted: "bg-slate-100 text-slate-600 border-slate-200",
  estimated: "bg-sky-50 text-sky-800 border-sky-200",
  scouted: "bg-blue-50 text-blue-800 border-blue-200",
  wlEstablished: "bg-violet-50 text-violet-800 border-violet-200",
  glidePath: "bg-cyan-50 text-cyan-800 border-cyan-200",
  shaped: "bg-emerald-50 text-emerald-800 border-emerald-200",
  disinfected: "bg-teal-50 text-teal-800 border-teal-200",
  complete: "bg-green-100 text-green-900 border-green-300",
  paused: "bg-slate-100 text-slate-700 border-slate-300",
  medicated: "bg-amber-50 text-amber-900 border-amber-200",
  referred: "bg-red-50 text-red-800 border-red-200",
};

export const statusLabels: Record<CanalStatus, string> = {
  notStarted: "Not started",
  estimated: "Estimated",
  scouted: "Scouted",
  wlEstablished: "WL established",
  glidePath: "Glide path",
  shaped: "Shaped",
  disinfected: "Disinfected",
  complete: "Complete",
  paused: "Paused",
  medicated: "Medicated",
  referred: "Referred",
};

export function hasEvent(canal: CanalRecord | null | undefined, type: string) {
  return (canal?.events || []).some((event) => event.type === type);
}

export function isManualCanalStatusEvent(type: string) {
  return ["canal.completed", "canal.paused", "canal.medicated", "canal.referred"].includes(type);
}

export function getCanalStatus(canal?: CanalRecord | null): CanalStatus {
  if (!canal) return "notStarted";
  if (hasEvent(canal, "canal.referred") || hasEvent(canal, "treatment.referralRecommended")) return "referred";
  if (
    hasEvent(canal, "backfill.compactedStable") ||
    hasEvent(canal, "backfill.excessInChamber") ||
    hasEvent(canal, "downpack.gpStableAfterCompaction")
  ) return "complete";
  if (hasEvent(canal, "canal.completed")) return "complete";
  if (hasEvent(canal, "canal.paused")) return "paused";
  if (hasEvent(canal, "canal.medicated") || hasEvent(canal, "medication.calciumHydroxidePlaced")) return "medicated";
  if (hasEvent(canal, "sealer.reapplied") || hasEvent(canal, "sealer.applied")) return "disinfected";
  if (hasEvent(canal, "coneFit.radiographAcceptable")) return "disinfected";
  if (hasEvent(canal, "disinfection.readyForObturation") || hasEvent(canal, "disinfection.finalNaOClCompleted")) return "disinfected";
  if (hasEvent(canal, "closure.finalRestoration") || hasEvent(canal, "closure.orificeBarrierTemporary") || hasEvent(canal, "closure.temporary")) return "complete";
  if (hasEvent(canal, "shaping.completed") || !isBlank(canal.finalShape)) return "shaped";
  if (hasEvent(canal, "glidePath.created")) return "glidePath";
  if (hasEvent(canal, "workingLength.established") || !isBlank(canal.eal0)) return "wlEstablished";
  if (hasEvent(canal, "scouting.estimatedWLSet")) return "scouted";
  if (!isBlank(canal.estimatedWorkingLength)) return "estimated";
  if (canal.priorVisitStatus === "partiallyObturated" || canal.priorVisitStatus === "coneFitVerified") return "disinfected";
  if (canal.priorVisitStatus === "medicatedTemporized") return "medicated";
  if (canal.priorVisitStatus === "shaped") return "shaped";
  if (canal.priorVisitStatus === "glidePath") return "glidePath";
  if (canal.priorVisitStatus === "wlEstablished") return "wlEstablished";
  if (canal.priorVisitStatus === "locatedScouted") return "scouted";
  return "notStarted";
}
