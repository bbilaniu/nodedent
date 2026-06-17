import type { CapabilitySatisfaction, ClinicalEvent, WorkflowDefinition, WorkflowScope } from "../types";

export const sharedIsolationWorkflowId = "shared.isolation";
export const sharedIsolationWorkflowVersion = "0.1.0";

export const isolationEventTypes = {
  rubberDamPlaced: "isolation.rubberDamPlaced",
  alternativeIsolationUsed: "isolation.alternativeIsolationUsed",
  compromised: "isolation.compromised",
  removed: "isolation.removed",
  replaced: "isolation.replaced",
} as const;

export const isolationEstablishedEventTypes = [
  isolationEventTypes.rubberDamPlaced,
  isolationEventTypes.alternativeIsolationUsed,
  isolationEventTypes.replaced,
] as const;

export const isolationInvalidatingEventTypes = [
  isolationEventTypes.compromised,
  isolationEventTypes.removed,
] as const;

export const isolationRegionKinds = ["quadrant", "sextant", "archSegment", "custom"] as const;
export const isolationMethods = ["rubberDam", "splitDam", "cottonRoll", "isovac", "other"] as const;

export type IsolationEventType = typeof isolationEventTypes[keyof typeof isolationEventTypes];
export type IsolationRegionKind = typeof isolationRegionKinds[number];
export type IsolationMethod = typeof isolationMethods[number];

export type IsolationSupport = {
  type: "clamp" | "wedge" | "ligature" | "other";
  tooth?: string;
  clampCode?: string;
  notes?: string;
};

export type IsolationEventDetails = {
  method?: IsolationMethod;
  regionKind?: IsolationRegionKind;
  regionLabel?: string;
  exposedTeeth?: string[];
  supports?: IsolationSupport[];
  clampCode?: string;
  clampTooth?: string;
  notes?: string;
  reason?: string;
};

export type IsolationCoverageSummary = {
  method: string;
  region: string;
  exposedTeeth: string;
  clampCode: string;
  clampTooth: string;
};

const isolationMethodLabels = {
  rubberDam: "Rubber dam",
  splitDam: "Split dam",
  cottonRoll: "Cotton roll",
  isovac: "Isovac",
  other: "Other",
} as const satisfies Record<IsolationMethod, string>;

const isolationRegionLabels = {
  quadrant: "Quadrant",
  sextant: "Sextant",
  archSegment: "Arch segment",
  custom: "Custom",
} as const satisfies Record<IsolationRegionKind, string>;

function normalizeTeeth(teeth?: unknown) {
  return Array.isArray(teeth)
    ? teeth.map(String).map((tooth) => tooth.trim()).filter(Boolean)
    : [];
}

export function getIsolationEventDetails(event: ClinicalEvent): IsolationEventDetails {
  const details = event.details && typeof event.details === "object" ? event.details : {};
  const exposedTeeth = normalizeTeeth(details.exposedTeeth);
  const supports = Array.isArray(details.supports) ? details.supports.filter((support) => support && typeof support === "object") as IsolationSupport[] : undefined;

  return {
    method: typeof details.method === "string" && isolationMethods.includes(details.method as IsolationMethod) ? details.method as IsolationMethod : undefined,
    regionKind: typeof details.regionKind === "string" && isolationRegionKinds.includes(details.regionKind as IsolationRegionKind) ? details.regionKind as IsolationRegionKind : undefined,
    regionLabel: typeof details.regionLabel === "string" ? details.regionLabel : event.scope?.regionLabel,
    exposedTeeth: exposedTeeth.length ? exposedTeeth : event.scope?.teeth,
    supports,
    clampCode: typeof details.clampCode === "string" ? details.clampCode : undefined,
    clampTooth: typeof details.clampTooth === "string" ? details.clampTooth : undefined,
    notes: typeof details.notes === "string" ? details.notes : undefined,
    reason: typeof details.reason === "string" ? details.reason : undefined,
  };
}

export function getIsolationScopeFromDetails(details: IsolationEventDetails, fallbackTooth?: string): WorkflowScope {
  const exposedTeeth = normalizeTeeth(details.exposedTeeth);

  if (exposedTeeth.length) {
    return {
      kind: "custom",
      teeth: exposedTeeth,
      regionLabel: details.regionLabel,
      details: details.regionKind ? { regionKind: details.regionKind } : undefined,
    };
  }

  if (details.regionKind) {
    return {
      kind: details.regionKind,
      regionLabel: details.regionLabel,
    };
  }

  if (fallbackTooth) return { kind: "tooth", tooth: fallbackTooth };
  return { kind: "custom", label: "Isolation scope not specified" };
}

export function getIsolationScopeFromEvent(event: ClinicalEvent): WorkflowScope {
  return event.scope || getIsolationScopeFromDetails(getIsolationEventDetails(event), event.tooth);
}

export function buildIsolationEstablishedCapability(event: ClinicalEvent): CapabilitySatisfaction {
  return {
    name: "isolation.established",
    scope: getIsolationScopeFromEvent(event),
    sourceEventId: event.id,
    workflowId: event.workflowId || sharedIsolationWorkflowId,
    workflowRunId: event.workflowRunId,
    satisfiedAt: event.timestamp,
  };
}

function formatRegion(details: IsolationEventDetails, scope: WorkflowScope) {
  const regionKind = details.regionKind || (scope.kind in isolationRegionLabels ? scope.kind as IsolationRegionKind : undefined);
  const label = details.regionLabel || scope.regionLabel || scope.label;
  const regionKindLabel = regionKind ? isolationRegionLabels[regionKind] : "";

  if (regionKindLabel && label) return `${regionKindLabel}: ${label}`;
  return regionKindLabel || label || "not recorded";
}

export function getIsolationCoverageSummary(event?: ClinicalEvent | null): IsolationCoverageSummary {
  if (!event) {
    return {
      method: "not recorded",
      region: "not recorded",
      exposedTeeth: "not recorded",
      clampCode: "not recorded",
      clampTooth: "not recorded",
    };
  }

  const details = getIsolationEventDetails(event);
  const scope = getIsolationScopeFromEvent(event);
  const clampSupport = details.supports?.find((support) => support.type === "clamp");
  const exposedTeeth = details.exposedTeeth?.length ? details.exposedTeeth : scope.teeth || (scope.tooth ? [scope.tooth] : []);
  const clampCode = details.clampCode || clampSupport?.clampCode;
  const clampTooth = details.clampTooth || clampSupport?.tooth;

  return {
    method: details.method ? isolationMethodLabels[details.method] : "not recorded",
    region: formatRegion(details, scope),
    exposedTeeth: exposedTeeth.length ? exposedTeeth.join(", ") : "not recorded",
    clampCode: clampCode || "not recorded",
    clampTooth: clampTooth || "not recorded",
  };
}

function formatToothList(teeth?: string[]) {
  return teeth?.length ? teeth.join(", ") : "";
}

function formatSupport(details: IsolationEventDetails) {
  const clampSupport = details.supports?.find((support) => support.type === "clamp");
  const clampCode = details.clampCode || clampSupport?.clampCode;
  const clampTooth = details.clampTooth || clampSupport?.tooth;
  if (clampCode && clampTooth) return ` Clamp ${clampCode} on tooth ${clampTooth}.`;
  if (clampCode) return ` Clamp ${clampCode} used.`;
  if (clampTooth) return ` Clamp placed on tooth ${clampTooth}.`;
  return "";
}

export function formatIsolationEventFragment(event: ClinicalEvent) {
  const details = getIsolationEventDetails(event);
  const exposed = formatToothList(details.exposedTeeth);
  const region = details.regionLabel ? ` (${details.regionLabel})` : "";
  const support = formatSupport(details);

  if (event.type === isolationEventTypes.rubberDamPlaced) {
    return `Rubber dam isolation placed${region}${exposed ? `; exposed teeth ${exposed}` : ""}.${support}`;
  }
  if (event.type === isolationEventTypes.alternativeIsolationUsed) {
    return `Alternative isolation used${details.method ? ` (${details.method})` : ""}${region}${exposed ? `; isolated teeth ${exposed}` : ""}.`;
  }
  if (event.type === isolationEventTypes.compromised) {
    return `Isolation compromised${details.reason ? `: ${details.reason}` : ""}. Reassessment required.`;
  }
  if (event.type === isolationEventTypes.removed) {
    return `Isolation removed${details.reason ? `: ${details.reason}` : ""}.`;
  }
  if (event.type === isolationEventTypes.replaced) {
    return `Isolation replaced${region}${exposed ? `; exposed teeth ${exposed}` : ""}.${support}`;
  }
  return `${event.type}.`;
}

export const sharedIsolationWorkflow: WorkflowDefinition = {
  workflowId: sharedIsolationWorkflowId,
  version: sharedIsolationWorkflowVersion,
  discipline: "shared",
  title: "Isolation",
  entryNodeIds: ["isolation-select-method"],
  completionNodeIds: ["isolation-complete", "isolation-needs-reassessment"],
  supportedScopes: ["tooth", "quadrant", "sextant", "archSegment", "custom"],
  nodes: {
    "isolation-select-method": {
      id: "isolation-select-method",
      workflowId: sharedIsolationWorkflowId,
      phase: "Isolation",
      title: "Select isolation method",
      chairsideInstruction: "Record rubber dam or alternative isolation before reusing the isolation status in another workflow.",
      requiredInputs: ["Isolation method", "Scope or exposed teeth"],
      options: [
        { label: "Rubber dam placed", nextNodeId: "isolation-complete", noteEvent: { type: isolationEventTypes.rubberDamPlaced } },
        { label: "Alternative isolation used", nextNodeId: "isolation-complete", noteEvent: { type: isolationEventTypes.alternativeIsolationUsed } },
        { label: "Isolation compromised", nextNodeId: "isolation-needs-reassessment", noteEvent: { type: isolationEventTypes.compromised } },
      ],
    },
    "isolation-complete": {
      id: "isolation-complete",
      workflowId: sharedIsolationWorkflowId,
      phase: "Isolation",
      title: "Isolation recorded",
      chairsideInstruction: "Isolation status is available to parent workflows for the recorded scope.",
      options: [{ label: "Return to parent workflow", nextNodeId: "isolation-complete" }],
    },
    "isolation-needs-reassessment": {
      id: "isolation-needs-reassessment",
      workflowId: sharedIsolationWorkflowId,
      phase: "Isolation",
      title: "Isolation needs reassessment",
      chairsideInstruction: "Reassess, replace, or remove isolation before a parent workflow relies on it.",
      options: [
        { label: "Isolation replaced", nextNodeId: "isolation-complete", noteEvent: { type: isolationEventTypes.replaced } },
        { label: "Isolation removed", nextNodeId: "isolation-needs-reassessment", noteEvent: { type: isolationEventTypes.removed } },
      ],
    },
  },
};
