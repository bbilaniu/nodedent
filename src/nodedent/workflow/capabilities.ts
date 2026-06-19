import type { KnownCapabilityName, WorkflowScopeKind } from "../types";

export const knownCapabilityNames = [
  "diagnosis.recorded",
  "radiographs.reviewed",
  "anesthesia.adequate",
  "isolation.established",
  "temporaryClosure.placed",
  "referral.recommended",
  "finalRestoration.placed",
] as const satisfies readonly KnownCapabilityName[];

export type CapabilityScopeRule = {
  defaultScope: WorkflowScopeKind;
  acceptedScopes: WorkflowScopeKind[];
  reusableAcrossVisits: boolean;
  requiresCurrentVisit: boolean;
  notes: string;
};

export const capabilityScopeRules = {
  "diagnosis.recorded": {
    defaultScope: "tooth",
    acceptedScopes: ["patient", "tooth", "procedure"],
    reusableAcrossVisits: true,
    requiresCurrentVisit: false,
    notes: "Diagnosis is reusable case context, but later workflows may still request reassessment when findings change.",
  },
  "radiographs.reviewed": {
    defaultScope: "tooth",
    acceptedScopes: ["patient", "tooth", "procedure"],
    reusableAcrossVisits: true,
    requiresCurrentVisit: false,
    notes: "Radiograph review can satisfy setup checks for the same case scope; image recency rules belong in selectors.",
  },
  "anesthesia.adequate": {
    defaultScope: "tooth",
    acceptedScopes: ["tooth", "quadrant", "sextant", "archSegment", "custom"],
    reusableAcrossVisits: false,
    requiresCurrentVisit: true,
    notes: "Anesthesia is time-sensitive and should be reassessed from event timing, anesthetic details, and clinical response.",
  },
  "isolation.established": {
    defaultScope: "custom",
    acceptedScopes: ["tooth", "quadrant", "sextant", "archSegment", "custom"],
    reusableAcrossVisits: false,
    requiresCurrentVisit: true,
    notes: "Isolation should prefer explicit exposed teeth when available, with region labels as a fallback.",
  },
  "temporaryClosure.placed": {
    defaultScope: "tooth",
    acceptedScopes: ["tooth", "procedure"],
    reusableAcrossVisits: true,
    requiresCurrentVisit: false,
    notes: "Temporary closure may become prior-visit status for a continued procedure.",
  },
  "referral.recommended": {
    defaultScope: "procedure",
    acceptedScopes: ["tooth", "procedure"],
    reusableAcrossVisits: true,
    requiresCurrentVisit: false,
    notes: "Referral recommendation belongs to the procedure/tooth context and should remain visible across visits.",
  },
  "finalRestoration.placed": {
    defaultScope: "tooth",
    acceptedScopes: ["tooth", "surface", "procedure"],
    reusableAcrossVisits: true,
    requiresCurrentVisit: false,
    notes: "Final restoration may satisfy downstream procedure status checks for the recorded tooth or surfaces.",
  },
} as const satisfies Record<KnownCapabilityName, CapabilityScopeRule>;
