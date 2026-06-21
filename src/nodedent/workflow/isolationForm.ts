import type { ClinicalEvent } from "../types";
import type { IsolationEventDetails, IsolationEventType, IsolationMethod, IsolationRegionKind, IsolationSupport } from "./isolation";
import { getIsolationEventDetails, isolationEventTypes, isolationMethods, isolationRegionKinds, isolationSupportTypeFromLabel } from "./isolation";

export type IsolationFormState = {
  action: IsolationEventType;
  method: IsolationMethod;
  methodLabel: string;
  regionKind: IsolationRegionKind;
  regionLabel: string;
  exposedTeeth: string;
  clampCode: string;
  clampTooth: string;
  supportLabel: string;
  supportTooth: string;
  supportNote: string;
  note: string;
};

export const isolationActionLabels = {
  [isolationEventTypes.rubberDamPlaced]: "Rubber dam placed",
  [isolationEventTypes.alternativeIsolationUsed]: "Alternative isolation used",
  [isolationEventTypes.compromised]: "Isolation compromised",
  [isolationEventTypes.removed]: "Isolation removed",
  [isolationEventTypes.replaced]: "Isolation replaced",
} as const satisfies Record<IsolationEventType, string>;

export const isolationActionOptions = Object.values(isolationActionLabels);
export const alternativeIsolationMethodOptions = isolationMethods.filter((method) => method !== "rubberDam");
export const replacementIsolationMethodOptions = [...isolationMethods];
export const isolationRegionOptions = [...isolationRegionKinds];

export const isolationSubmitLabels = {
  [isolationEventTypes.rubberDamPlaced]: "Record rubber dam placement",
  [isolationEventTypes.alternativeIsolationUsed]: "Record alternative isolation",
  [isolationEventTypes.compromised]: "Record isolation compromise",
  [isolationEventTypes.removed]: "Record isolation removal",
  [isolationEventTypes.replaced]: "Record isolation replacement",
} as const satisfies Record<IsolationEventType, string>;

export function isolationEventTypeFromLabel(label: string): IsolationEventType {
  const entry = Object.entries(isolationActionLabels).find(([, actionLabel]) => actionLabel === label);
  return (entry?.[0] as IsolationEventType | undefined) || isolationEventTypes.rubberDamPlaced;
}

export function defaultIsolationMethod(action: IsolationEventType): IsolationMethod {
  return action === isolationEventTypes.alternativeIsolationUsed ? "splitDam" : "rubberDam";
}

export function defaultIsolationFormState(tooth: string, action: IsolationEventType = isolationEventTypes.rubberDamPlaced): IsolationFormState {
  return {
    action,
    method: defaultIsolationMethod(action),
    methodLabel: "",
    regionKind: "custom",
    regionLabel: "",
    exposedTeeth: tooth || "",
    clampCode: "",
    clampTooth: tooth || "",
    supportLabel: "",
    supportTooth: "",
    supportNote: "",
    note: "",
  };
}

function getClampDetails(details: IsolationEventDetails) {
  const clampSupport = details.supports?.find((support) => support.type === "clamp");
  return {
    clampCode: details.clampCode || clampSupport?.clampCode || "",
    clampTooth: details.clampTooth || clampSupport?.tooth || "",
  };
}

export function buildIsolationFormState(tooth: string, action: IsolationEventType, sourceEvent?: ClinicalEvent): IsolationFormState {
  if (!sourceEvent) return defaultIsolationFormState(tooth, action);

  const details = getIsolationEventDetails(sourceEvent);
  const clamp = getClampDetails(details);
  const support = details.supports?.find((item) => item.type !== "clamp" || item.label || item.notes);

  return {
    ...defaultIsolationFormState(tooth, action),
    method: details.method || defaultIsolationMethod(action),
    methodLabel: details.methodLabel || "",
    regionKind: details.regionKind || "custom",
    regionLabel: details.regionLabel || "",
    exposedTeeth: details.exposedTeeth?.join(" ") || tooth || "",
    clampCode: clamp.clampCode,
    clampTooth: clamp.clampTooth || tooth || "",
    supportLabel: support?.label || "",
    supportTooth: support?.tooth || "",
    supportNote: support?.notes || "",
  };
}

export function isIsolationReassessmentAction(action: IsolationEventType) {
  return action === isolationEventTypes.compromised || action === isolationEventTypes.removed;
}

export function showsIsolationMethodField(action: IsolationEventType) {
  return action === isolationEventTypes.alternativeIsolationUsed || action === isolationEventTypes.replaced;
}

export function showsIsolationClampFields(form: IsolationFormState) {
  return form.action === isolationEventTypes.rubberDamPlaced ||
    (form.action === isolationEventTypes.replaced && form.method === "rubberDam");
}

export function buildIsolationEventFromForm(form: IsolationFormState): { eventType: IsolationEventType; details: IsolationEventDetails } {
  const teeth = form.exposedTeeth.split(/[,\s]+/).map((tooth) => tooth.trim()).filter(Boolean);
  const actionIsReassessment = isIsolationReassessmentAction(form.action);
  const showMethodLabelField = !actionIsReassessment;
  const showClampFields = showsIsolationClampFields(form);
  const supportLabel = form.supportLabel.trim();
  const supportTooth = form.supportTooth.trim();
  const supportNote = form.supportNote.trim();
  const supports: IsolationSupport[] = [];

  if (!actionIsReassessment && showClampFields && (form.clampCode.trim() || form.clampTooth.trim())) {
    supports.push({
      type: "clamp",
      tooth: form.clampTooth.trim() || undefined,
      clampCode: form.clampCode.trim() || undefined,
    });
  }
  if (!actionIsReassessment && (supportLabel || supportTooth || supportNote)) {
    supports.push({
      type: isolationSupportTypeFromLabel(supportLabel),
      label: supportLabel || undefined,
      tooth: supportTooth || undefined,
      notes: supportNote || undefined,
    });
  }

  return {
    eventType: form.action,
    details: {
      method: form.action === isolationEventTypes.rubberDamPlaced ? "rubberDam" : actionIsReassessment ? undefined : form.method,
      methodLabel: showMethodLabelField ? form.methodLabel.trim() || undefined : undefined,
      regionKind: form.regionKind,
      regionLabel: form.regionLabel.trim() || undefined,
      exposedTeeth: teeth.length ? teeth : undefined,
      supports: supports.length ? supports : undefined,
      clampCode: showClampFields ? form.clampCode.trim() || undefined : undefined,
      clampTooth: showClampFields ? form.clampTooth.trim() || undefined : undefined,
      reason: actionIsReassessment ? form.note.trim() || undefined : undefined,
      notes: !actionIsReassessment ? form.note.trim() || undefined : undefined,
    },
  };
}
