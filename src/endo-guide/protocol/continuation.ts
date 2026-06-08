import type { CanalContinuationTarget, CanalRecord, EndoCase } from "../types";
import { getCanalStatus, hasEvent } from "../engine/deriveCanalStatus";
import { getCanalCheckpointNodeId } from "../engine/getCurrentNode";
import { getManualResumeNodeForCanal, getPriorVisitResumeNodeForCanal, priorCanalStatusLabels } from "../engine/resume";
import { handoffNodeIds, protocolNodes } from "./nodes";

export function isPhaseAwareCanalHandoffNode(nodeId: string) {
  return handoffNodeIds.has(nodeId);
}

function getReferredContinuationNodeId(canal?: CanalRecord | null) {
  if (!canal) return null;
  if (hasEvent(canal, "canal.referred")) return null;
  if (hasEvent(canal, "closure.temporary") || hasEvent(canal, "closure.orificeBarrierTemporary") || hasEvent(canal, "closure.finalRestoration")) return null;
  if (hasEvent(canal, "treatment.referralOnlyCompleted")) return null;
  if (hasEvent(canal, "medication.calciumHydroxidePlaced") || hasEvent(canal, "canal.medicated")) return "temporary-closure";
  if (hasEvent(canal, "treatment.medicateTemporizeSelected")) return "calcium-hydroxide";
  if (hasEvent(canal, "treatment.referralRecommended")) return "referral-next-step";
  if (hasEvent(canal, "treatment.referralSelected")) return "refer-pathway";
  return null;
}

export function getNextRecommendedNodeForCanal(canal?: CanalRecord | null): CanalContinuationTarget {
  const canalName = canal?.name || "Canal";
  const status = getCanalStatus(canal);
  const priorResumeNodeId = getPriorVisitResumeNodeForCanal(canal);
  const manualResumeNodeId = getManualResumeNodeForCanal(canal);

  if (priorResumeNodeId) {
    const priorStatus = canal?.priorVisitStatus || "";
    const phaseLabel = protocolNodes[priorResumeNodeId]?.title.toLowerCase() || "prior-visit continuation";
    return {
      canalName,
      status,
      label: `Resume ${canalName} from prior visit (${priorCanalStatusLabels[priorStatus]})`,
      phaseLabel,
      nextNodeId: priorResumeNodeId,
      reason: `resumed ${canalName} from prior visit history at ${phaseLabel}`,
    };
  }

  if ((status === "paused" || status === "medicated") && manualResumeNodeId) {
    const phaseLabel = protocolNodes[manualResumeNodeId]?.title.toLowerCase() || "resume pathway";
    return {
      canalName,
      status,
      label: status === "medicated" ? `Resume ${canalName} from medication / temporary closure` : `Resume ${canalName} from paused visit`,
      phaseLabel,
      nextNodeId: manualResumeNodeId,
      reason: `resumed ${canalName} at ${phaseLabel}`,
    };
  }

  if (status === "referred") {
    const referralContinuationNodeId = getReferredContinuationNodeId(canal);
    if (referralContinuationNodeId) {
      const phaseLabel = protocolNodes[referralContinuationNodeId]?.title.toLowerCase() || "referral continuation";
      return {
        canalName,
        status,
        label: `Continue ${canalName} at ${phaseLabel}`,
        phaseLabel,
        nextNodeId: referralContinuationNodeId,
        reason: `continued ${canalName} at ${phaseLabel}`,
      };
    }
  }

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
      nextNodeId: "remove-smear-layer",
      reason: `resumed ${canalName} from medication/next-visit pathway`,
    },
    paused: {
      label: `${canalName} paused; no continuation action`,
      phaseLabel: "paused",
      nextNodeId: null,
      disabled: true,
      reason: "Paused",
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
    if (
      checkpointNodeId &&
      checkpointNodeId !== "preop" &&
      checkpointNodeId !== "endodontic-pathway-complete" &&
      checkpointNodeId !== target.nextNodeId &&
      protocolNodes[checkpointNodeId]
    ) {
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
