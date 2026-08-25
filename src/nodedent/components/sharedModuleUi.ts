import type { CapabilityStatus } from "../workflow/selectors";
import { semanticStatusTone } from "./uiStyles";

export type SharedModuleKind = "anesthesia" | "isolation" | "radiology";
export type SharedCapabilityStatusLabel = "Ready" | "Review" | "Pending" | "Awaiting assessment";

export function sharedCapabilityStatusLabel(status: Pick<CapabilityStatus, "satisfied" | "needsReassessment" | "recordedOutsideScope" | "pendingAssessment">): SharedCapabilityStatusLabel {
  if (status.pendingAssessment) return "Awaiting assessment";
  if (status.needsReassessment || status.recordedOutsideScope) return "Review";
  return status.satisfied ? "Ready" : "Pending";
}

export function sharedCapabilityStatusClass(status: Pick<CapabilityStatus, "satisfied" | "needsReassessment" | "recordedOutsideScope" | "pendingAssessment">) {
  if (status.needsReassessment || status.recordedOutsideScope || status.pendingAssessment) return semanticStatusTone.attention;
  if (status.satisfied) return semanticStatusTone.positive;
  return semanticStatusTone.neutral;
}

export function sharedStatusLabelClass(label: string) {
  if (label === "Ready") return semanticStatusTone.positive;
  if (label === "Review" || label === "Awaiting assessment") return semanticStatusTone.attention;
  return semanticStatusTone.neutral;
}

export function sharedAvailabilityClass(availability: string) {
  if (availability === "ready") return semanticStatusTone.positive;
  return semanticStatusTone.neutral;
}

export function sharedModuleActionLabel(module: SharedModuleKind, status: Pick<CapabilityStatus, "satisfied" | "needsReassessment" | "recordedOutsideScope" | "pendingAssessment">) {
  const label = module === "anesthesia" ? "anesthesia" : module === "isolation" ? "isolation" : "radiology";
  if (module === "anesthesia" && status.pendingAssessment) return "Assess anesthesia";
  return status.satisfied || status.needsReassessment || status.recordedOutsideScope ? `Review ${label}` : `Open ${label} workflow`;
}

export function sharedModuleEntryNodeId(module: SharedModuleKind, status: Pick<CapabilityStatus, "satisfied" | "needsReassessment" | "recordedOutsideScope" | "pendingAssessment">) {
  if (status.recordedOutsideScope) return undefined;
  if (module === "anesthesia") {
    if (status.pendingAssessment) return "anesthesia-assess";
    return status.needsReassessment ? "anesthesia-needs-reassessment" : undefined;
  }
  if (module === "radiology") return status.satisfied || status.needsReassessment ? "radiology-review" : undefined;
  return status.satisfied || status.needsReassessment ? "isolation-needs-reassessment" : undefined;
}
