import type { EndoCase } from "../types";

export type BackupConflictClassification =
  | "identical"
  | "incomingOlder"
  | "incomingNewer"
  | "divergentSameRevision";

export type ClinicalSnapshotComparison = {
  revision: number;
  savedAt: string;
  patientNumber: string;
  tooth: string;
  procedureType: string;
  currentNodeId: string;
  canals: Array<{ name: string; status: string }>;
  eventCount: number;
  anesthesiaEntryCount: number;
  radiographEntryCount: number;
  closure: string;
  nextVisitPlan: string;
};

export type ComparableClinicalSnapshot = {
  revision: number;
  savedAt: string;
  currentNodeId: string;
  caseData: EndoCase;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)])
  );
}

function clinicalContent(snapshot: ComparableClinicalSnapshot) {
  const { revision: _revision, autosavedAt: _autosavedAt, ...caseData } = snapshot.caseData;
  return canonicalize({ currentNodeId: snapshot.currentNodeId, caseData });
}

export async function digestClinicalSnapshotContent(snapshot: ComparableClinicalSnapshot) {
  const bytes = new TextEncoder().encode(JSON.stringify(clinicalContent(snapshot)));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function classifyBackupConflict(localRevision: number, incomingRevision: number, contentMatches: boolean): BackupConflictClassification {
  if (contentMatches) return "identical";
  if (incomingRevision < localRevision) return "incomingOlder";
  if (incomingRevision > localRevision) return "incomingNewer";
  return "divergentSameRevision";
}

export function summarizeClinicalSnapshot(snapshot: ComparableClinicalSnapshot): ClinicalSnapshotComparison {
  const events = snapshot.caseData.globalEvents || [];
  return {
    revision: snapshot.revision,
    savedAt: snapshot.savedAt,
    patientNumber: snapshot.caseData.patientNumber,
    tooth: snapshot.caseData.tooth,
    procedureType: snapshot.caseData.procedureType,
    currentNodeId: snapshot.currentNodeId,
    canals: (snapshot.caseData.canals || []).map((canal) => ({ name: canal.name, status: canal.status || "not started" })),
    eventCount: events.length,
    anesthesiaEntryCount: events.filter((event) => event.type.startsWith("anesthesia.")).length,
    radiographEntryCount: events.filter((event) => event.type.startsWith("radiology.")).length,
    closure: snapshot.caseData.closure?.type || "None recorded",
    nextVisitPlan: snapshot.caseData.nextVisitPlan || "None recorded",
  };
}

function stableValue(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export function describeClinicalSnapshotDifferences(local: ComparableClinicalSnapshot, incoming: ComparableClinicalSnapshot) {
  const differences: string[] = [];
  if (local.currentNodeId !== incoming.currentNodeId) differences.push(`Workflow position: ${local.currentNodeId} → ${incoming.currentNodeId}`);
  if (local.caseData.patientNumber !== incoming.caseData.patientNumber) differences.push("Patient number differs");
  if (local.caseData.tooth !== incoming.caseData.tooth) differences.push(`Tooth: ${local.caseData.tooth} → ${incoming.caseData.tooth}`);
  if (local.caseData.procedureType !== incoming.caseData.procedureType) differences.push(`Procedure: ${local.caseData.procedureType} → ${incoming.caseData.procedureType}`);
  if (stableValue(local.caseData.canals) !== stableValue(incoming.caseData.canals)) differences.push("Canal records or statuses differ");
  if (stableValue(local.caseData.closure) !== stableValue(incoming.caseData.closure)) differences.push("Closure record differs");
  if ((local.caseData.nextVisitPlan || "") !== (incoming.caseData.nextVisitPlan || "")) differences.push("Next-visit plan differs");

  const localEvents = new Map((local.caseData.globalEvents || []).map((event) => [event.id, event]));
  const incomingEvents = new Map((incoming.caseData.globalEvents || []).map((event) => [event.id, event]));
  const addedTypes = [...incomingEvents.entries()].filter(([id]) => !localEvents.has(id)).map(([, event]) => event.type);
  const removedTypes = [...localEvents.entries()].filter(([id]) => !incomingEvents.has(id)).map(([, event]) => event.type);
  const changedEvents = [...incomingEvents.entries()].filter(([id, event]) => localEvents.has(id) && stableValue(localEvents.get(id)) !== stableValue(event));
  if (addedTypes.length) differences.push(`Backup adds ${addedTypes.length} event${addedTypes.length === 1 ? "" : "s"}: ${[...new Set(addedTypes)].join(", ")}`);
  if (removedTypes.length) differences.push(`Backup omits ${removedTypes.length} local event${removedTypes.length === 1 ? "" : "s"}: ${[...new Set(removedTypes)].join(", ")}`);
  if (changedEvents.length) differences.push(`${changedEvents.length} matching event ID${changedEvents.length === 1 ? " has" : "s have"} different content`);
  if (!differences.length) differences.push("Other documented case fields differ");
  return differences;
}
