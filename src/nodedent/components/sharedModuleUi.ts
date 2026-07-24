import type { CapabilityStatus } from "../workflow/selectors";

export type SharedModuleKind = "anesthesia" | "isolation" | "radiology";
export type SharedCapabilityStatusLabel = "Ready" | "Review" | "Pending";

export function sharedCapabilityStatusLabel(status: Pick<CapabilityStatus, "satisfied" | "needsReassessment" | "recordedOutsideScope">): SharedCapabilityStatusLabel {
  if (status.needsReassessment || status.recordedOutsideScope) return "Review";
  return status.satisfied ? "Ready" : "Pending";
}

export function sharedCapabilityStatusClass(status: Pick<CapabilityStatus, "satisfied" | "needsReassessment" | "recordedOutsideScope">) {
  if (status.needsReassessment || status.recordedOutsideScope) return "border-amber-200 bg-amber-50 text-amber-900";
  if (status.satisfied) return "border-brand-mint/40 bg-brand-mint/10 text-brand-navy";
  return "border-brand-light-node bg-white text-brand-slate";
}

export function sharedStatusLabelClass(label: string) {
  if (label === "Ready") return "border-brand-mint/40 bg-brand-mint/10 text-brand-navy";
  if (label === "Review") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-brand-light-node bg-white text-brand-slate";
}

export function sharedAvailabilityClass(availability: string) {
  if (availability === "ready") return "border-brand-mint/40 bg-brand-mint/10 text-brand-navy";
  return "border-brand-light-node bg-white text-brand-slate";
}

export function sharedModuleActionLabel(module: SharedModuleKind, status: Pick<CapabilityStatus, "satisfied" | "needsReassessment" | "recordedOutsideScope">) {
  const label = module === "anesthesia" ? "anesthesia" : module === "isolation" ? "isolation" : "radiology";
  return status.satisfied || status.needsReassessment || status.recordedOutsideScope ? `Review ${label}` : `Open ${label} workflow`;
}

export function sharedModuleEntryNodeId(module: SharedModuleKind, status: Pick<CapabilityStatus, "satisfied" | "needsReassessment" | "recordedOutsideScope">) {
  if (status.recordedOutsideScope) return undefined;
  if (module === "anesthesia") return status.needsReassessment ? "anesthesia-needs-reassessment" : undefined;
  if (module === "radiology") return status.satisfied || status.needsReassessment ? "radiology-review" : undefined;
  return status.satisfied || status.needsReassessment ? "isolation-needs-reassessment" : undefined;
}
