import type { EndoCase } from "../types";
import { protocolNodes } from "../protocol/nodes";

export function inferCurrentNodeIdFromEvents(caseData?: Partial<EndoCase> | null) {
  const events = caseData?.globalEvents || [];
  const lastEvent = events[events.length - 1];
  if (!lastEvent?.type) return "preop";
  if (lastEvent.type === "workflow.switchedCanal" && lastEvent.details?.nextNode && protocolNodes[lastEvent.details.nextNode]) {
    return lastEvent.details.nextNode;
  }

  for (const node of Object.values(protocolNodes)) {
    const matchingOption = (node.options || []).find((option) => option.noteEvent?.type === lastEvent.type);
    if (matchingOption?.nextNodeId && protocolNodes[matchingOption.nextNodeId]) {
      return matchingOption.nextNodeId;
    }
  }

  return lastEvent.details?.nodeId && protocolNodes[lastEvent.details.nodeId] ? lastEvent.details.nodeId : "preop";
}

export function getSavedCurrentNodeId(saved?: Partial<EndoCase> | null) {
  if (saved?.currentNodeId && protocolNodes[saved.currentNodeId]) return saved.currentNodeId;
  return inferCurrentNodeIdFromEvents(saved);
}

export function getCanalCheckpointNodeId(caseData: EndoCase, canalName: string) {
  const canalEvents = (caseData?.globalEvents || []).filter((event) => {
    const isCaseWide = event.canal === "All" || event.canal === "N/A" || !event.canal;
    return event.canal === canalName || isCaseWide;
  });
  if (canalEvents.length) return inferCurrentNodeIdFromEvents({ ...caseData, globalEvents: canalEvents });

  const globalTypes = (caseData?.globalEvents || []).map((event) => event.type);
  if (globalTypes.includes("access.canalsIdentified") || globalTypes.includes("access.refined")) return "estimate-wl";
  if (globalTypes.includes("access.chamberConfirmed") || globalTypes.includes("access.chamberReached")) return "identify-canals";
  return "preop";
}
