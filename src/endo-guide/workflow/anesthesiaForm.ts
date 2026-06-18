import type { ClinicalEvent } from "../types";
import type { AnesthesiaAdequacyResponse, AnesthesiaEventDetails, AnesthesiaEventType, AnesthesiaRoute } from "./anesthesia";
import { anesthesiaEventTypes, getAnesthesiaEventDetails } from "./anesthesia";

export type AnesthesiaMode = "administration" | "assessment";
export type AnesthesiaAdministrationAction =
  | typeof anesthesiaEventTypes.administered
  | typeof anesthesiaEventTypes.topUpGiven;

export type AnesthesiaFormState = {
  action: AnesthesiaEventType;
  route: AnesthesiaRoute;
  routeLabel: string;
  agentLabel: string;
  technique: string;
  applicationType: string;
  site: string;
  dose: string;
  doseUnit: string;
  administeredAt: string;
  vasoconstrictor: string;
  response: AnesthesiaAdequacyResponse;
  targetTeeth: string;
  regionLabel: string;
  note: string;
};

export const anesthesiaAdministrationActionLabels = {
  [anesthesiaEventTypes.administered]: "Initial administration",
  [anesthesiaEventTypes.topUpGiven]: "Top-up",
} as const satisfies Record<AnesthesiaAdministrationAction, string>;

export const anesthesiaAdministrationActionOptions = Object.values(anesthesiaAdministrationActionLabels);

export const anesthesiaAssessmentLabels = {
  adequate: "Adequate",
  notAdequate: "Not adequate",
} as const satisfies Record<Extract<AnesthesiaAdequacyResponse, "adequate" | "notAdequate">, string>;

export const anesthesiaRouteLabels = {
  injection: "Injection",
  topical: "Topical",
  other: "Other",
} as const satisfies Record<AnesthesiaRoute, string>;

export const anesthesiaRouteOptions = Object.values(anesthesiaRouteLabels);

export function anesthesiaAdministrationActionFromLabel(label: string): AnesthesiaAdministrationAction {
  const entry = Object.entries(anesthesiaAdministrationActionLabels).find(([, actionLabel]) => actionLabel === label);
  return (entry?.[0] as AnesthesiaAdministrationAction | undefined) || anesthesiaEventTypes.administered;
}

export function anesthesiaRouteFromLabel(label: string): AnesthesiaRoute {
  const entry = Object.entries(anesthesiaRouteLabels).find(([, routeLabel]) => routeLabel === label);
  return (entry?.[0] as AnesthesiaRoute | undefined) || "injection";
}

export function defaultAnesthesiaFormState(
  tooth: string,
  action: AnesthesiaAdministrationAction = anesthesiaEventTypes.administered
): AnesthesiaFormState {
  return {
    action,
    route: "injection",
    routeLabel: "",
    agentLabel: "",
    technique: "",
    applicationType: "",
    site: "",
    dose: "",
    doseUnit: "",
    administeredAt: "",
    vasoconstrictor: "",
    response: "notAssessed",
    targetTeeth: tooth || "",
    regionLabel: "",
    note: "",
  };
}

export function buildAnesthesiaFormState(
  tooth: string,
  action: AnesthesiaAdministrationAction | typeof anesthesiaEventTypes.adequacyConfirmed,
  sourceEvent?: ClinicalEvent
): AnesthesiaFormState {
  if (!sourceEvent) return defaultAnesthesiaFormState(tooth, action === anesthesiaEventTypes.topUpGiven ? action : anesthesiaEventTypes.administered);

  const details = getAnesthesiaEventDetails(sourceEvent);
  return {
    ...defaultAnesthesiaFormState(tooth, action === anesthesiaEventTypes.topUpGiven ? action : anesthesiaEventTypes.administered),
    action,
    route: details.route || "injection",
    routeLabel: details.routeLabel || "",
    agentLabel: details.agentLabel || "",
    technique: details.technique || "",
    applicationType: details.applicationType || "",
    site: details.site || "",
    dose: details.dose || "",
    doseUnit: details.doseUnit || "",
    administeredAt: details.administeredAt || "",
    vasoconstrictor: details.vasoconstrictor || "",
    response: details.response || "notAssessed",
    targetTeeth: details.teeth?.join(" ") || details.tooth || tooth || "",
    regionLabel: details.regionLabel || "",
    note: details.notes || details.reason || "",
  };
}

export function isAnesthesiaAssessmentReassessment(mode: AnesthesiaMode, form: AnesthesiaFormState) {
  return mode === "assessment" && form.response === "notAdequate";
}

export function canSubmitAnesthesiaForm(mode: AnesthesiaMode, form: AnesthesiaFormState) {
  return mode !== "assessment" || form.response === "adequate" || form.response === "notAdequate";
}

export function buildAnesthesiaEventFromForm(
  mode: AnesthesiaMode,
  form: AnesthesiaFormState
): { eventType: AnesthesiaEventType; details: AnesthesiaEventDetails } | undefined {
  if (!canSubmitAnesthesiaForm(mode, form)) return undefined;

  const teeth = form.targetTeeth.split(/[,\s]+/).map((tooth) => tooth.trim()).filter(Boolean);
  const eventType: AnesthesiaEventType = mode === "administration"
    ? form.action
    : form.response === "adequate" ? anesthesiaEventTypes.adequacyConfirmed : anesthesiaEventTypes.needsReassessment;
  const isAdministration = mode === "administration";
  const routeIsInjection = isAdministration && form.route === "injection";
  const routeIsTopical = isAdministration && form.route === "topical";
  const routeIsOther = isAdministration && form.route === "other";
  const assessmentNeedsReassessment = isAnesthesiaAssessmentReassessment(mode, form);

  return {
    eventType,
    details: {
      route: isAdministration ? form.route : undefined,
      routeLabel: routeIsOther ? form.routeLabel.trim() || undefined : undefined,
      agentLabel: routeIsInjection || routeIsTopical ? form.agentLabel.trim() || undefined : undefined,
      technique: routeIsInjection ? form.technique.trim() || undefined : undefined,
      applicationType: routeIsTopical || routeIsOther ? form.applicationType.trim() || undefined : undefined,
      site: isAdministration ? form.site.trim() || undefined : undefined,
      dose: routeIsInjection ? form.dose.trim() || undefined : undefined,
      doseUnit: routeIsInjection ? form.doseUnit.trim() || undefined : undefined,
      administeredAt: routeIsInjection || routeIsTopical ? form.administeredAt.trim() || undefined : undefined,
      vasoconstrictor: routeIsInjection ? form.vasoconstrictor.trim() || undefined : undefined,
      response: mode === "assessment" ? form.response : undefined,
      teeth: teeth.length ? teeth : undefined,
      regionLabel: form.regionLabel.trim() || undefined,
      reason: mode === "assessment" && assessmentNeedsReassessment ? form.note.trim() || undefined : undefined,
      notes: (routeIsTopical || routeIsOther || (mode === "assessment" && !assessmentNeedsReassessment)) ? form.note.trim() || undefined : undefined,
    },
  };
}

export function getAnesthesiaRouteActionLabel(route: AnesthesiaRoute) {
  if (route === "topical") return "Add topical";
  if (route === "other") return "Add other";
  return "Add injection";
}

export function getAnesthesiaRouteSelectionLabel(route: AnesthesiaRoute) {
  if (route === "topical") return "Topical";
  if (route === "other") return "Other";
  return "Injection";
}

export function getAnesthesiaEventLabel(eventType: AnesthesiaEventType) {
  if (eventType === anesthesiaEventTypes.administered) return "Anesthesia administered";
  if (eventType === anesthesiaEventTypes.topUpGiven) return "Top-up recorded";
  if (eventType === anesthesiaEventTypes.adequacyConfirmed) return "Adequacy confirmed";
  if (eventType === anesthesiaEventTypes.needsReassessment) return "Needs reassessment";
  return eventType;
}
