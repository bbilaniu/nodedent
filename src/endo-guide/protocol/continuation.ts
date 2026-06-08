import type { CanalContinuationTarget, CanalRecord, EndoCase } from "../types";
import { getCanalStatus, hasEvent } from "../engine/deriveCanalStatus";
import { getCanalCheckpointNodeId } from "../engine/getCurrentNode";
import { protocolNodes } from "./nodes";

export function getNextRecommendedNodeForCanal(canal?: CanalRecord | null): CanalContinuationTarget {
  const canalName = canal?.name || "Canal";
  const status = getCanalStatus(canal);

  if (hasEvent(canal, "coneFit.readyForSealerConeSeating") || hasEvent(canal, "coneFit.radiographAcceptable")) {
    return {
      canalName,
      status,
      label: `Proceed with ${canalName} to sealer / cone seating`,
      nextNodeId: "ready-for-sealer-cone-seating",
      reason: `proceeded with ${canalName} to sealer / cone seating`,
    };
  }

  const targets: Record<string, Omit<CanalContinuationTarget, "canalName" | "status">> = {
    notStarted: {
      label: `Start ${canalName} at initial scouting`,
      nextNodeId: "estimate-wl",
      reason: `started ${canalName} at initial scouting`,
    },
    estimated: {
      label: `Start ${canalName} at initial scouting`,
      nextNodeId: "estimate-wl",
      reason: `started ${canalName} at initial scouting`,
    },
    scouted: {
      label: `Continue ${canalName} at working length`,
      nextNodeId: "open-orifice",
      reason: `continued ${canalName} at working length`,
    },
    wlEstablished: {
      label: `Continue ${canalName} at glide path`,
      nextNodeId: "patency-10c",
      reason: `continued ${canalName} at glide path`,
    },
    glidePath: {
      label: `Continue ${canalName} at shaping`,
      nextNodeId: "gauge-final-shape",
      reason: `continued ${canalName} at shaping`,
    },
    shaped: {
      label: `Proceed with ${canalName} to obturation gauging`,
      nextNodeId: "ready-for-obturation",
      reason: `proceeded with ${canalName} to obturation gauging`,
    },
    disinfected: {
      label: `Proceed with ${canalName} to obturation gauging`,
      nextNodeId: "ready-for-obturation",
      reason: `proceeded with ${canalName} to obturation gauging`,
    },
    medicated: {
      label: `Resume ${canalName} from medication/next-visit pathway`,
      nextNodeId: "endodontic-pathway-complete",
      reason: `resumed ${canalName} from medication/next-visit pathway`,
    },
    paused: {
      label: `Resume ${canalName} from paused pathway`,
      nextNodeId: "endodontic-pathway-complete",
      reason: `resumed ${canalName} from paused pathway`,
    },
    complete: {
      label: `${canalName} complete; no continuation action`,
      nextNodeId: null,
      disabled: true,
      reason: "Complete",
    },
    referred: {
      label: `${canalName} referred; no continuation action`,
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

export function getCanalContinuationTargets(caseData: EndoCase, activeCanalName?: string) {
  return (caseData?.canals || [])
    .filter((canal) => canal.name && canal.name !== activeCanalName)
    .map((canal) => {
      const target = getNextRecommendedNodeForCanal(canal);
      const hasCheckpointEvents = (caseData?.globalEvents || []).some(
        (event) => event.canal === canal.name && (event.type !== "workflow.switchedCanal" || event.details?.nextNode)
      );

      if (!target.disabled && hasCheckpointEvents) {
        const checkpointNodeId = getCanalCheckpointNodeId(caseData, canal.name);
        if (checkpointNodeId && checkpointNodeId !== "preop" && checkpointNodeId !== target.nextNodeId && protocolNodes[checkpointNodeId]) {
          const stepLabel = protocolNodes[checkpointNodeId].title.toLowerCase();
          return {
            ...target,
            label: `Continue ${target.canalName} at ${stepLabel}`,
            nextNodeId: checkpointNodeId,
            reason: `continued ${target.canalName} at ${stepLabel}`,
          };
        }
      }

      return target;
    });
}
