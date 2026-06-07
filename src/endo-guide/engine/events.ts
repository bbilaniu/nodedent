import type { CanalRecord, ClinicalEvent } from "../types";
import { protocolNodes } from "../protocol/nodes";

export function getEventCanalScope(type: string, nodeId: string, canal?: string) {
  const node = protocolNodes[nodeId];
  const phase = node?.phase || "";
  const caseLevelPrefixes = ["preop.", "access.", "closure."];
  const caseLevelTypes = ["workflow.allCanalsReadyForClosure", "workflow.returnedToStart"];

  if (caseLevelPrefixes.some((prefix) => type.startsWith(prefix))) return "All";
  if (["Pre-op", "Access", "Closure", "Export"].includes(phase)) return "All";
  if (caseLevelTypes.includes(type)) return "All";
  return canal || "N/A";
}

export function makeEvent({
  type,
  tooth,
  canal,
  nodeId,
  label,
  activeCanal,
  id,
  timestamp,
}: {
  type: string;
  tooth?: string;
  canal?: string;
  nodeId: string;
  label: string;
  activeCanal?: CanalRecord | null;
  id: string;
  timestamp: string;
}): ClinicalEvent {
  const scopedCanal = getEventCanalScope(type, nodeId, canal);
  return {
    id,
    timestamp,
    type,
    tooth,
    canal: scopedCanal,
    details: { nodeId, decisionLabel: label, canalSnapshot: activeCanal ? { ...activeCanal, events: undefined } : undefined },
  };
}

export function makeRuntimeEvent(args: Omit<Parameters<typeof makeEvent>[0], "id" | "timestamp">) {
  return makeEvent({
    ...args,
    id: `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toISOString(),
  });
}
