import type { CanalContinuationTarget, CanalRecord, EndoCase } from "../types";
import { getCanalStatus, hasEvent } from "../engine/deriveCanalStatus";
import { getCanalCheckpointNodeId } from "../engine/getCurrentNode";
import { handoffNodeIds, protocolNodes } from "./nodes";

export function isPhaseAwareCanalHandoffNode(nodeId: string) {
  return handoffNodeIds.has(nodeId);
}

export function getNextRecommendedNodeForCanal(canal?: CanalRecord | null): CanalContinuationTarget {
  const canalName = canal?.name || "Canal";
  const status = getCanalStatus(canal);

  if (hasEvent(canal, "coneFit.readyForSealerConeSeating") || hasEvent(canal, "coneFit.radiographAcceptable")) {
    return {
      canalName,
      status,
      label: `Proceed with ${canalName} to sealer / cone seating`,
      phaseLabel: "sealer / cone seating",
      nextNodeId: "ready-for-sealer-cone-seating",
      reason: `proceeded with ${canalName} to sealer / cone seating`,
    };
  }

  const targets: Record<string, Omit<CanalContinuationTarget, "canalName" | "status">> = {
    notStarted: {
      label: `Start ${canalName} at estimated WL / scouting`,
      phaseLabel: "estimated WL / scouting",
      nextNodeId: "estimate-wl",
      reason: `started ${canalName} at estimated WL / scouting`,
    },
    estimated: {
      label: `Start ${canalName} at scouting`,
      phaseLabel: "scouting",
      nextNodeId: "estimate-wl",
      reason: `started ${canalName} at scouting`,
    },
    scouted: {
      label: `Continue ${canalName} at working length / EAL`,
      phaseLabel: "working length / EAL",
      nextNodeId: "open-orifice",
      reason: `continued ${canalName} at working length / EAL`,
    },
    wlEstablished: {
      label: `Continue ${canalName} at patency / glide path`,
      phaseLabel: "patency / glide path",
      nextNodeId: "patency-10c",
      reason: `continued ${canalName} at patency / glide path`,
    },
    glidePath: {
      label: `Continue ${canalName} at final shaping`,
      phaseLabel: "final shaping",
      nextNodeId: "gauge-final-shape",
      reason: `continued ${canalName} at final shaping`,
    },
    shaped: {
      label: `Proceed with ${canalName} to final cleaning / obturation`,
      phaseLabel: "final cleaning / obturation",
      nextNodeId: "remove-smear-layer",
      reason: `proceeded with ${canalName} to final cleaning / obturation`,
    },
    disinfected: {
      label: `Proceed with ${canalName} to obturation gauging`,
      phaseLabel: "obturation gauging",
      nextNodeId: "ready-for-obturation",
      reason: `proceeded with ${canalName} to obturation gauging`,
    },
    medicated: {
      label: `Resume ${canalName} from medication/next-visit pathway`,
      phaseLabel: "medication / next visit",
      nextNodeId: "endodontic-pathway-complete",
      reason: `resumed ${canalName} from medication/next-visit pathway`,
    },
    paused: {
      label: `Resume ${canalName} from paused pathway`,
      phaseLabel: "paused pathway",
      nextNodeId: "endodontic-pathway-complete",
      reason: `resumed ${canalName} from paused pathway`,
    },
    complete: {
      label: `${canalName} complete; no continuation action`,
      phaseLabel: "complete",
      nextNodeId: null,
      disabled: true,
      reason: "Complete",
    },
    referred: {
      label: `${canalName} referred; no continuation action`,
      phaseLabel: "referred",
      nextNodeId: null,
      disabled: true,
      reason: "Referred",
    },
  };

  return {
    canalName,
    status,
    ...(targets[status] || targets.notStarted),
  };
}

function withCheckpointTarget(caseData: EndoCase, target: CanalContinuationTarget) {
  const hasCheckpointEvents = (caseData?.globalEvents || []).some(
    (event) => event.canal === target.canalName && (event.type !== "workflow.switchedCanal" || event.details?.nextNode || event.details?.nextNodeId)
  );

  if (!target.disabled && hasCheckpointEvents) {
    const checkpointNodeId = getCanalCheckpointNodeId(caseData, target.canalName);
    if (checkpointNodeId && checkpointNodeId !== "preop" && checkpointNodeId !== target.nextNodeId && protocolNodes[checkpointNodeId]) {
      const stepLabel = protocolNodes[checkpointNodeId].title.toLowerCase();
      return {
        ...target,
        label: `Continue ${target.canalName} at ${stepLabel}`,
        phaseLabel: stepLabel,
        nextNodeId: checkpointNodeId,
        reason: `continued ${target.canalName} at ${stepLabel}`,
      };
    }
  }

  return target;
}

export function getCanalContinuationTargets(caseData: EndoCase, activeCanalName?: string) {
  return (caseData?.canals || [])
    .filter((canal) => canal.name && canal.name !== activeCanalName)
    .map((canal) => withCheckpointTarget(caseData, getNextRecommendedNodeForCanal(canal)));
}

export function getPhaseAwareCanalTargets(caseData: EndoCase, currentNodeId: string, activeCanalName?: string) {
  if (!isPhaseAwareCanalHandoffNode(currentNodeId)) return [];
  return getCanalContinuationTargets(caseData, activeCanalName);
}
