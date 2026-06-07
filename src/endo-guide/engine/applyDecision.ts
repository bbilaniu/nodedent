import type { ClinicalEvent, DecisionOption, EndoCase } from "../types";
import { protocolNodes } from "../protocol/nodes";
import { makeEvent } from "./events";
import { validateDecision } from "./validateDecision";

export type ApplyDecisionInput = {
  currentNodeId: string;
  selectedOptionId?: string;
  selectedOptionLabel?: string;
  caseData: EndoCase;
  activeCanalName: string;
  eventId?: string;
  timestamp?: string;
};

export type ApplyDecisionOutput = {
  nextNodeId: string;
  updatedCaseData: EndoCase;
  generatedEvent?: ClinicalEvent;
  warnings: string[];
  errors: string[];
};

function cloneCase(caseData: EndoCase): EndoCase {
  return {
    ...caseData,
    diagnosis: caseData.diagnosis ? { ...caseData.diagnosis } : undefined,
    preOp: { ...(caseData.preOp || {}) },
    closure: caseData.closure ? { ...caseData.closure } : null,
    canals: (caseData.canals || []).map((canal) => ({ ...canal, events: [...(canal.events || [])] })),
    globalEvents: [...(caseData.globalEvents || [])],
  };
}

function findOption(options: DecisionOption[], selectedOptionId?: string, selectedOptionLabel?: string) {
  if (selectedOptionId) {
    const byId = options.find((option) => option.id === selectedOptionId || option.label === selectedOptionId);
    if (byId) return byId;
    if (!selectedOptionLabel) return undefined;
  }
  if (selectedOptionLabel) {
    return options.find((option) => option.label === selectedOptionLabel);
  }
  return options[0];
}

export function applyDecision(input: ApplyDecisionInput): ApplyDecisionOutput {
  const caseData = cloneCase(input.caseData);
  const node = protocolNodes[input.currentNodeId];
  if (!node) {
    return {
      nextNodeId: input.currentNodeId || "preop",
      updatedCaseData: caseData,
      warnings: [],
      errors: [`Invalid node ID: ${input.currentNodeId}`],
    };
  }

  const option = findOption(node.options || [], input.selectedOptionId, input.selectedOptionLabel);
  if (!option) {
    return {
      nextNodeId: input.currentNodeId,
      updatedCaseData: caseData,
      warnings: [],
      errors: [`Invalid option for node ${input.currentNodeId}`],
    };
  }

  const activeCanal = caseData.canals.find((canal) => canal.name === input.activeCanalName) || caseData.canals[0];
  const errors = validateDecision(node.id, option, caseData, activeCanal);
  if (errors.length) {
    return {
      nextNodeId: input.currentNodeId,
      updatedCaseData: caseData,
      warnings: [],
      errors,
    };
  }

  const generatedEvent = option.noteEvent
    ? makeEvent({
        type: option.noteEvent.type,
        tooth: caseData.tooth,
        canal: activeCanal?.name,
        nodeId: node.id,
        label: input.selectedOptionLabel || option.label,
        activeCanal,
        id: input.eventId || `evt_${caseData.globalEvents.length + 1}`,
        timestamp: input.timestamp || "",
      })
    : undefined;

  const appliesToAllCanals = generatedEvent && node.id === "close-access" && generatedEvent.canal === "All";

  const updatedCaseData: EndoCase = {
    ...caseData,
    difficulty: option.difficultyFlag || caseData.difficulty || "none",
    closure: option.noteEvent?.type?.startsWith("closure.") ? { type: option.noteEvent.type } : caseData.closure,
    canals: generatedEvent
      ? caseData.canals.map((canal) =>
          appliesToAllCanals || canal.name === caseData.currentCanal
            ? { ...canal, events: [...(canal.events || []), generatedEvent] }
            : canal
        )
      : caseData.canals,
    globalEvents: generatedEvent ? [...caseData.globalEvents, generatedEvent] : caseData.globalEvents,
  };

  return {
    nextNodeId: option.nextNodeId,
    updatedCaseData,
    generatedEvent,
    warnings: [],
    errors: [],
  };
}
