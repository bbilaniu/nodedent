import React, { useEffect, useRef, useState } from "react";
import type { CanalRecord, CaseSetupFocusTarget, ClinicalEvent, EndoCase } from "../types";
import { getCaseStatus } from "../engine/deriveCaseStatus";
import { isBlank, isPositiveMeasurement } from "../engine/measurements";
import { caseStatusOptions } from "../state/persistence";
import type { AnesthesiaAdequacyResponse, AnesthesiaEventDetails, AnesthesiaEventType, AnesthesiaRoute } from "../workflow/anesthesia";
import { anesthesiaEventTypes, formatAnesthesiaEventFragment, getAnesthesiaEventDetails } from "../workflow/anesthesia";
import type { IsolationEventDetails, IsolationEventType, IsolationMethod, IsolationRegionKind } from "../workflow/isolation";
import { formatIsolationEventFragment, getIsolationCoverageSummary, getIsolationEventDetails, isolationEventTypes, isolationMethods, isolationRegionKinds } from "../workflow/isolation";
import { getCaseCapabilitySummary } from "../workflow/selectors";
import { SelectInput, TextInput } from "./FormControls";

function statusClass(satisfied: boolean, needsReassessment: boolean) {
  if (needsReassessment) return "border-amber-200 bg-amber-50 text-amber-900";
  if (satisfied) return "border-brand-mint/40 bg-brand-mint/10 text-brand-navy";
  return "border-brand-light-node bg-white text-brand-slate";
}

const isolationActionLabels = {
  [isolationEventTypes.rubberDamPlaced]: "Rubber dam placed",
  [isolationEventTypes.alternativeIsolationUsed]: "Alternative isolation used",
  [isolationEventTypes.compromised]: "Isolation compromised",
  [isolationEventTypes.removed]: "Isolation removed",
  [isolationEventTypes.replaced]: "Isolation replaced",
} as const satisfies Record<IsolationEventType, string>;

const isolationActionOptions = Object.values(isolationActionLabels);
const alternativeIsolationMethodOptions = isolationMethods.filter((method) => method !== "rubberDam");
const replacementIsolationMethodOptions = [...isolationMethods];

const isolationSubmitLabels = {
  [isolationEventTypes.rubberDamPlaced]: "Record rubber dam placement",
  [isolationEventTypes.alternativeIsolationUsed]: "Record alternative isolation",
  [isolationEventTypes.compromised]: "Record isolation compromise",
  [isolationEventTypes.removed]: "Record isolation removal",
  [isolationEventTypes.replaced]: "Record isolation replacement",
} as const satisfies Record<IsolationEventType, string>;

type AnesthesiaMode = "administration" | "assessment";

const anesthesiaAdministrationActionLabels = {
  [anesthesiaEventTypes.administered]: "Initial administration",
  [anesthesiaEventTypes.topUpGiven]: "Top-up",
} as const satisfies Record<typeof anesthesiaEventTypes.administered | typeof anesthesiaEventTypes.topUpGiven, string>;

const anesthesiaAdministrationActionOptions = Object.values(anesthesiaAdministrationActionLabels);

const anesthesiaAssessmentLabels = {
  adequate: "Adequate",
  notAdequate: "Not adequate",
} as const satisfies Record<Extract<AnesthesiaAdequacyResponse, "adequate" | "notAdequate">, string>;

const anesthesiaRouteLabels = {
  injection: "Injection",
  topical: "Topical",
  other: "Other",
} as const satisfies Record<AnesthesiaRoute, string>;

const anesthesiaRouteOptions = Object.values(anesthesiaRouteLabels);

function eventTypeFromLabel(label: string): IsolationEventType {
  const entry = Object.entries(isolationActionLabels).find(([, actionLabel]) => actionLabel === label);
  return (entry?.[0] as IsolationEventType | undefined) || isolationEventTypes.rubberDamPlaced;
}

function anesthesiaAdministrationActionFromLabel(label: string): typeof anesthesiaEventTypes.administered | typeof anesthesiaEventTypes.topUpGiven {
  const entry = Object.entries(anesthesiaAdministrationActionLabels).find(([, actionLabel]) => actionLabel === label);
  return (entry?.[0] as typeof anesthesiaEventTypes.administered | typeof anesthesiaEventTypes.topUpGiven | undefined) || anesthesiaEventTypes.administered;
}

function anesthesiaRouteFromLabel(label: string): AnesthesiaRoute {
  const entry = Object.entries(anesthesiaRouteLabels).find(([, routeLabel]) => routeLabel === label);
  return (entry?.[0] as AnesthesiaRoute | undefined) || "injection";
}

function defaultIsolationMethod(action: IsolationEventType): IsolationMethod {
  return action === isolationEventTypes.alternativeIsolationUsed ? "splitDam" : "rubberDam";
}

type AnesthesiaFormState = {
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

type IsolationFormState = {
  action: IsolationEventType;
  method: IsolationMethod;
  regionKind: IsolationRegionKind;
  regionLabel: string;
  exposedTeeth: string;
  clampCode: string;
  clampTooth: string;
  note: string;
};

function defaultAnesthesiaFormState(tooth: string, action: AnesthesiaEventType = anesthesiaEventTypes.administered): AnesthesiaFormState {
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

function defaultIsolationFormState(tooth: string, action: IsolationEventType = isolationEventTypes.rubberDamPlaced): IsolationFormState {
  return {
    action,
    method: defaultIsolationMethod(action),
    regionKind: "custom",
    regionLabel: "",
    exposedTeeth: tooth || "",
    clampCode: "",
    clampTooth: tooth || "",
    note: "",
  };
}

function buildAnesthesiaFormState(tooth: string, action: AnesthesiaEventType, sourceEvent?: ClinicalEvent): AnesthesiaFormState {
  if (!sourceEvent) return defaultAnesthesiaFormState(tooth, action);

  const details = getAnesthesiaEventDetails(sourceEvent);
  return {
    ...defaultAnesthesiaFormState(tooth, action),
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
    response: details.response || defaultAnesthesiaFormState(tooth, action).response,
    targetTeeth: details.teeth?.join(" ") || details.tooth || tooth || "",
    regionLabel: details.regionLabel || "",
    note: details.notes || details.reason || "",
  };
}

function getClampDetails(details: IsolationEventDetails) {
  const clampSupport = details.supports?.find((support) => support.type === "clamp");
  return {
    clampCode: details.clampCode || clampSupport?.clampCode || "",
    clampTooth: details.clampTooth || clampSupport?.tooth || "",
  };
}

function buildIsolationFormState(tooth: string, action: IsolationEventType, sourceEvent?: ClinicalEvent): IsolationFormState {
  if (!sourceEvent) return defaultIsolationFormState(tooth, action);

  const details = getIsolationEventDetails(sourceEvent);
  const clamp = getClampDetails(details);

  return {
    ...defaultIsolationFormState(tooth, action),
    method: details.method || defaultIsolationMethod(action),
    regionKind: details.regionKind || "custom",
    regionLabel: details.regionLabel || "",
    exposedTeeth: details.exposedTeeth?.join(" ") || tooth || "",
    clampCode: clamp.clampCode,
    clampTooth: clamp.clampTooth || tooth || "",
  };
}

function formatEventTimestamp(timestamp?: string) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function CaseSetupStatusPanel({
  caseData,
  activeCanal,
  onUpdateCase,
  onUpdateDiagnosis,
  onUpdatePreOp,
  onUpdateActiveCanal,
  onApplySuggestedCaseStatus,
  onRecordAnesthesiaEvent,
  onRecordIsolationEvent,
  onOpenIsolationWorkflow,
  initialFocusSection,
}: {
  caseData: EndoCase;
  activeCanal?: CanalRecord | null;
  onUpdateCase: (updates: Partial<EndoCase>) => void;
  onUpdateDiagnosis: (field: string, value: string) => void;
  onUpdatePreOp: (field: string, value: string | boolean) => void;
  onUpdateActiveCanal: (field: string, value: string) => void;
  onApplySuggestedCaseStatus: () => void;
  onRecordAnesthesiaEvent: (eventType: AnesthesiaEventType, details: AnesthesiaEventDetails) => void;
  onRecordIsolationEvent: (eventType: IsolationEventType, details: IsolationEventDetails) => void;
  onOpenIsolationWorkflow: (entryNodeId?: string) => void;
  initialFocusSection?: CaseSetupFocusTarget | null;
}) {
  const paReviewed = caseData.preOp?.paReviewed ?? caseData.preOp?.radiographsReviewed ?? false;
  const bwReviewed = caseData.preOp?.bwReviewed ?? false;
  const [anesthesiaMode, setAnesthesiaMode] = useState<AnesthesiaMode>("administration");
  const [anesthesiaForm, setAnesthesiaForm] = useState<AnesthesiaFormState>(() => defaultAnesthesiaFormState(caseData.tooth));
  const [isolationForm, setIsolationForm] = useState<IsolationFormState>(() => defaultIsolationFormState(caseData.tooth));
  const previousToothRef = useRef(caseData.tooth);
  const anesthesiaSectionRef = useRef<HTMLElement | null>(null);
  const isolationSectionRef = useRef<HTMLElement | null>(null);
  const capabilitySummary = getCaseCapabilitySummary(caseData);
  const anesthesiaEvents = (caseData.globalEvents || []).filter((event) => Object.values(anesthesiaEventTypes).includes(event.type as AnesthesiaEventType));
  const latestAnesthesiaEvent = anesthesiaEvents.at(-1);
  const latestAnesthesiaEventTime = formatEventTimestamp(latestAnesthesiaEvent?.timestamp);
  const latestIsolationEvent = capabilitySummary.isolation.sourceEvent;
  const latestIsolationEventTime = formatEventTimestamp(latestIsolationEvent?.timestamp);
  const isolationCoverage = getIsolationCoverageSummary(latestIsolationEvent);
  const isolationCoverageItems = [
    { label: "Exposed teeth", value: isolationCoverage.exposedTeeth },
    { label: "Region", value: isolationCoverage.region },
    { label: "Clamp tooth", value: isolationCoverage.clampTooth },
    { label: "Clamp code", value: isolationCoverage.clampCode },
  ];
  const statusItems = [
    { label: "Diagnosis", status: capabilitySummary.diagnosis },
    { label: "Radiographs", status: capabilitySummary.radiographs },
    { label: "Anesthesia", status: capabilitySummary.anesthesia },
    { label: "Isolation", status: capabilitySummary.isolation },
  ];
  const isolationIsEstablished = capabilitySummary.isolation.satisfied && !capabilitySummary.isolation.needsReassessment;
  const showMethodField = isolationForm.action === isolationEventTypes.alternativeIsolationUsed || isolationForm.action === isolationEventTypes.replaced;
  const methodOptions = isolationForm.action === isolationEventTypes.replaced ? replacementIsolationMethodOptions : alternativeIsolationMethodOptions;
  const showClampFields =
    isolationForm.action === isolationEventTypes.rubberDamPlaced ||
    (isolationForm.action === isolationEventTypes.replaced && isolationForm.method === "rubberDam");
  const actionIsReassessment = isolationForm.action === isolationEventTypes.compromised || isolationForm.action === isolationEventTypes.removed;
  const anesthesiaModeIsAssessment = anesthesiaMode === "assessment";
  const anesthesiaAssessmentNeedsReassessment = anesthesiaModeIsAssessment && anesthesiaForm.response === "notAdequate";
  const anesthesiaAssessmentCanSubmit = !anesthesiaModeIsAssessment || anesthesiaForm.response === "adequate" || anesthesiaForm.response === "notAdequate";
  const anesthesiaRouteIsInjection = anesthesiaMode === "administration" && anesthesiaForm.route === "injection";
  const anesthesiaRouteIsTopical = anesthesiaMode === "administration" && anesthesiaForm.route === "topical";
  const anesthesiaRouteIsOther = anesthesiaMode === "administration" && anesthesiaForm.route === "other";

  useEffect(() => {
    const previousTooth = previousToothRef.current;
    previousToothRef.current = caseData.tooth;
    setAnesthesiaForm((prev) => ({
      ...prev,
      targetTeeth: !prev.targetTeeth || prev.targetTeeth === previousTooth ? caseData.tooth || "" : prev.targetTeeth,
    }));
    setIsolationForm((prev) => ({
      ...prev,
      exposedTeeth: !prev.exposedTeeth || prev.exposedTeeth === previousTooth ? caseData.tooth || "" : prev.exposedTeeth,
      clampTooth: !prev.clampTooth || prev.clampTooth === previousTooth ? caseData.tooth || "" : prev.clampTooth,
    }));
  }, [caseData.tooth]);

  useEffect(() => {
    if (initialFocusSection === "anesthesia") {
      anesthesiaSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      anesthesiaSectionRef.current?.focus({ preventScroll: true });
      return;
    }
    if (initialFocusSection !== "isolation") return;
    isolationSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    isolationSectionRef.current?.focus({ preventScroll: true });
  }, [initialFocusSection]);

  function updateAnesthesiaForm(updates: Partial<AnesthesiaFormState>) {
    setAnesthesiaForm((prev) => ({ ...prev, ...updates }));
  }

  function resetAnesthesiaForm(action: AnesthesiaEventType = anesthesiaEventTypes.administered) {
    setAnesthesiaMode("administration");
    setAnesthesiaForm(defaultAnesthesiaFormState(caseData.tooth, action));
  }

  function selectAnesthesiaRoute(route: AnesthesiaRoute) {
    setAnesthesiaMode("administration");
    setAnesthesiaForm((prev) => ({
      ...prev,
      route,
      action: prev.action === anesthesiaEventTypes.topUpGiven ? anesthesiaEventTypes.topUpGiven : anesthesiaEventTypes.administered,
      response: "notAssessed",
    }));
  }

  function prepareAnesthesiaMode(mode: AnesthesiaMode) {
    setAnesthesiaMode(mode);
    const action = mode === "administration" ? anesthesiaEventTypes.administered : anesthesiaEventTypes.adequacyConfirmed;
    const nextForm = buildAnesthesiaFormState(caseData.tooth, action, latestAnesthesiaEvent);
    setAnesthesiaForm(mode === "assessment" ? { ...nextForm, action, response: "notAssessed", note: "" } : nextForm);
  }

  function updateIsolationForm(updates: Partial<IsolationFormState>) {
    setIsolationForm((prev) => ({ ...prev, ...updates }));
  }

  function updateIsolationAction(action: IsolationEventType) {
    setIsolationForm((prev) => ({
      ...prev,
      action,
      method: action === isolationEventTypes.alternativeIsolationUsed && prev.method === "rubberDam" ? "splitDam" : action === isolationEventTypes.rubberDamPlaced ? "rubberDam" : prev.method,
    }));
  }

  function resetIsolationForm(action: IsolationEventType = isolationEventTypes.rubberDamPlaced) {
    setIsolationForm(defaultIsolationFormState(caseData.tooth, action));
  }

  function prepareIsolationAction(action: IsolationEventType) {
    setIsolationForm(buildIsolationFormState(caseData.tooth, action, latestIsolationEvent));
  }

  function submitAnesthesiaEvent() {
    if (!anesthesiaAssessmentCanSubmit) return;

    const teeth = anesthesiaForm.targetTeeth.split(/[,\s]+/).map((tooth) => tooth.trim()).filter(Boolean);
    const eventType: AnesthesiaEventType = anesthesiaMode === "administration"
      ? anesthesiaForm.action
      : anesthesiaForm.response === "adequate" ? anesthesiaEventTypes.adequacyConfirmed : anesthesiaEventTypes.needsReassessment;
    const isAdministration = anesthesiaMode === "administration";
    const routeIsInjection = isAdministration && anesthesiaForm.route === "injection";
    const routeIsTopical = isAdministration && anesthesiaForm.route === "topical";
    const routeIsOther = isAdministration && anesthesiaForm.route === "other";
    const details: AnesthesiaEventDetails = {
      route: isAdministration ? anesthesiaForm.route : undefined,
      routeLabel: routeIsOther ? anesthesiaForm.routeLabel.trim() || undefined : undefined,
      agentLabel: routeIsInjection || routeIsTopical ? anesthesiaForm.agentLabel.trim() || undefined : undefined,
      technique: routeIsInjection ? anesthesiaForm.technique.trim() || undefined : undefined,
      applicationType: routeIsTopical || routeIsOther ? anesthesiaForm.applicationType.trim() || undefined : undefined,
      site: isAdministration ? anesthesiaForm.site.trim() || undefined : undefined,
      dose: routeIsInjection ? anesthesiaForm.dose.trim() || undefined : undefined,
      doseUnit: routeIsInjection ? anesthesiaForm.doseUnit.trim() || undefined : undefined,
      administeredAt: routeIsInjection || routeIsTopical ? anesthesiaForm.administeredAt.trim() || undefined : undefined,
      vasoconstrictor: routeIsInjection ? anesthesiaForm.vasoconstrictor.trim() || undefined : undefined,
      response: anesthesiaMode === "assessment" ? anesthesiaForm.response : undefined,
      teeth: teeth.length ? teeth : undefined,
      regionLabel: anesthesiaForm.regionLabel.trim() || undefined,
      reason: anesthesiaMode === "assessment" && anesthesiaAssessmentNeedsReassessment ? anesthesiaForm.note.trim() || undefined : undefined,
      notes: (routeIsTopical || routeIsOther || (anesthesiaMode === "assessment" && !anesthesiaAssessmentNeedsReassessment)) ? anesthesiaForm.note.trim() || undefined : undefined,
    };

    onRecordAnesthesiaEvent(eventType, details);
    resetAnesthesiaForm();
  }

  function submitIsolationEvent() {
    const teeth = isolationForm.exposedTeeth.split(/[,\s]+/).map((tooth) => tooth.trim()).filter(Boolean);
    const details: IsolationEventDetails = {
      method: isolationForm.action === isolationEventTypes.rubberDamPlaced ? "rubberDam" : actionIsReassessment ? undefined : isolationForm.method,
      regionKind: isolationForm.regionKind,
      regionLabel: isolationForm.regionLabel.trim() || undefined,
      exposedTeeth: teeth.length ? teeth : undefined,
      clampCode: showClampFields ? isolationForm.clampCode.trim() || undefined : undefined,
      clampTooth: showClampFields ? isolationForm.clampTooth.trim() || undefined : undefined,
      reason: actionIsReassessment ? isolationForm.note.trim() || undefined : undefined,
      notes: !actionIsReassessment ? isolationForm.note.trim() || undefined : undefined,
    };

    onRecordIsolationEvent(isolationForm.action, details);
    resetIsolationForm();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-brand-light-node bg-brand-light-slate p-4">
        <h3 className="text-sm font-semibold text-brand-navy">Case identity</h3>
        <div className="mt-3 grid gap-3">
          <TextInput label="Patient #" value={caseData.patientNumber} onChange={(value) => onUpdateCase({ patientNumber: value })} placeholder="chart number" />
          <TextInput label="Tooth" value={caseData.tooth} onChange={(value) => onUpdateCase({ tooth: value })} invalid={isBlank(caseData.tooth)} />
          <SelectInput label="Procedure" value={caseData.procedureType} onChange={(value) => onUpdateCase({ procedureType: value })} options={["RCT", "Retreatment", "Emergency pulpectomy"]} />
        </div>
      </section>

      <section className="rounded-2xl border border-brand-light-node bg-brand-light-slate p-4">
        <h3 className="text-sm font-semibold text-brand-navy">Case status</h3>
        <div className="mt-3 grid gap-3">
          <SelectInput label="Visit status" value={getCaseStatus(caseData)} onChange={(value) => onUpdateCase({ caseStatus: value })} options={caseStatusOptions} />
          <button onClick={onApplySuggestedCaseStatus} className="rounded-xl border border-brand-light-node bg-white px-3 py-2 text-xs font-semibold text-brand-slate hover:bg-brand-light-slate">Use suggested status</button>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-brand-slate">Next visit / plan</span>
            <textarea
              value={caseData.nextVisitPlan || ""}
              onChange={(event) => onUpdateCase({ nextVisitPlan: event.target.value })}
              placeholder="e.g., continue obturation, crown recommended, refer"
              className="h-24 w-full rounded-xl border border-brand-light-node bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-brand-light-node bg-brand-light-slate p-4">
        <h3 className="text-sm font-semibold text-brand-navy">Diagnosis and pre-op</h3>
        <div className="mt-3 grid gap-3">
          <TextInput label="Pulpal diagnosis" value={caseData.diagnosis?.pulpal || ""} onChange={(value) => onUpdateDiagnosis("pulpal", value)} placeholder="optional" />
          <TextInput label="Apical diagnosis" value={caseData.diagnosis?.apical || ""} onChange={(value) => onUpdateDiagnosis("apical", value)} placeholder="optional" />
          <TextInput
            label="Estimated chamber depth"
            value={caseData.preOp?.estimatedChamberDepth}
            onChange={(value) => onUpdatePreOp("estimatedChamberDepth", value)}
            placeholder="mm"
            inputMode="decimal"
            invalid={!isPositiveMeasurement(caseData.preOp?.estimatedChamberDepth)}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-brand-light-node bg-brand-light-slate p-4">
        <h3 className="text-sm font-semibold text-brand-navy">Radiographs and active canal</h3>
        <div className="mt-3 rounded-xl border border-brand-light-node bg-white p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-slate">Pre-op radiographs reviewed</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="flex min-h-10 items-center gap-2 rounded-xl border border-brand-light-node bg-brand-light-slate px-3 py-2 text-sm font-semibold text-brand-navy">
              <input type="checkbox" checked={paReviewed} onChange={(event) => onUpdatePreOp("paReviewed", event.target.checked)} />
              PA
            </label>
            <label className="flex min-h-10 items-center gap-2 rounded-xl border border-brand-light-node bg-brand-light-slate px-3 py-2 text-sm font-semibold text-brand-navy">
              <input type="checkbox" checked={bwReviewed} onChange={(event) => onUpdatePreOp("bwReviewed", event.target.checked)} />
              BW
            </label>
            <label className="flex min-h-10 items-center gap-2 rounded-xl border border-brand-light-node bg-brand-light-slate px-3 py-2 text-sm font-semibold text-brand-navy">
              <input type="checkbox" checked={Boolean(caseData.preOp?.cbctReviewed)} onChange={(event) => onUpdatePreOp("cbctReviewed", event.target.checked)} />
              CBCT
            </label>
          </div>
        </div>
        <div className="mt-3">
          <TextInput
            label={`Estimated WL for ${activeCanal?.name || "active canal"}`}
            value={activeCanal?.estimatedWorkingLength}
            onChange={(value) => onUpdateActiveCanal("estimatedWorkingLength", value)}
            placeholder="mm"
            inputMode="decimal"
            invalid={!isPositiveMeasurement(activeCanal?.estimatedWorkingLength)}
            helperText="This field is for the active canal. Add or rename canals in the canal selector before working on additional canals."
          />
        </div>
      </section>

      <section className="rounded-2xl border border-brand-light-node bg-brand-light-slate p-4 lg:col-span-2">
        <h3 className="text-sm font-semibold text-brand-navy">Shared clinical status</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {statusItems.map(({ label, status }) => (
            <div key={label} className={`rounded-xl border px-3 py-2 ${statusClass(status.satisfied, status.needsReassessment)}`}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold">
                  {status.needsReassessment ? "Review" : status.satisfied ? "Ready" : "Pending"}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold leading-5">{status.summary}</p>
              {status.reason ? <p className="mt-1 text-xs leading-5 opacity-80">{status.reason}</p> : null}
            </div>
          ))}
        </div>
      </section>

      <section ref={anesthesiaSectionRef} tabIndex={-1} className="rounded-2xl border border-brand-light-node bg-brand-light-slate p-4 outline-none ring-brand-mint/30 focus:ring-2 lg:col-span-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-brand-navy">Anesthesia</h3>
            <p className="mt-1 text-sm leading-6 text-brand-slate">{capabilitySummary.anesthesia.summary}</p>
          </div>
          <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(capabilitySummary.anesthesia.satisfied, capabilitySummary.anesthesia.needsReassessment)}`}>
            {capabilitySummary.anesthesia.needsReassessment ? "Review" : capabilitySummary.anesthesia.satisfied ? "Ready" : "Pending"}
          </span>
        </div>
        {latestAnesthesiaEvent ? (
          <div className="mt-3 rounded-xl border border-brand-light-node bg-white px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-slate">Latest event</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-brand-navy">{formatAnesthesiaEventFragment(latestAnesthesiaEvent)}</p>
            {latestAnesthesiaEventTime ? <p className="mt-1 text-xs leading-5 text-brand-slate">{latestAnesthesiaEventTime}</p> : null}
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            aria-label="Record anesthesia administration"
            onClick={() => prepareAnesthesiaMode("administration")}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${anesthesiaMode === "administration" ? "border-brand-navy bg-brand-navy text-white hover:bg-brand-navy-deep" : "border-brand-blue-light bg-white text-brand-navy hover:bg-brand-blue-light/20"}`}
          >
            Record administration
          </button>
          <button
            type="button"
            aria-label="Record anesthesia assessment"
            onClick={() => prepareAnesthesiaMode("assessment")}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${anesthesiaMode === "assessment" ? "border-brand-navy bg-brand-navy text-white hover:bg-brand-navy-deep" : "border-brand-mint/40 bg-brand-mint/10 text-brand-navy hover:bg-brand-mint/20"}`}
          >
            Record assessment
          </button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {anesthesiaMode === "administration" ? (
            <SelectInput
              label="Entry type"
              value={anesthesiaAdministrationActionLabels[anesthesiaForm.action === anesthesiaEventTypes.topUpGiven ? anesthesiaEventTypes.topUpGiven : anesthesiaEventTypes.administered]}
              onChange={(value) => updateAnesthesiaForm({ action: anesthesiaAdministrationActionFromLabel(value) })}
              options={anesthesiaAdministrationActionOptions}
            />
          ) : (
            <div className="md:col-span-2">
              <p className="mb-2 text-xs font-medium text-brand-slate">Assessment</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(anesthesiaAssessmentLabels).map(([response, label]) => (
                  <button
                    key={response}
                    type="button"
                    onClick={() => updateAnesthesiaForm({ response: response as AnesthesiaAdequacyResponse })}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${anesthesiaForm.response === response ? "border-brand-navy bg-brand-navy text-white hover:bg-brand-navy-deep" : "border-brand-light-node bg-white text-brand-navy hover:bg-brand-light-slate"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {anesthesiaMode === "administration" ? (
            <div>
              <p className="mb-2 text-xs font-medium text-brand-slate">Local anesthesia entries</p>
              <div className="flex flex-wrap gap-2">
                {anesthesiaRouteOptions.map((routeLabel) => {
                  const route = anesthesiaRouteFromLabel(routeLabel);
                  return (
                    <button
                      key={route}
                      type="button"
                      onClick={() => selectAnesthesiaRoute(route)}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${anesthesiaForm.route === route ? "border-brand-navy bg-brand-navy text-white hover:bg-brand-navy-deep" : "border-brand-light-node bg-white text-brand-navy hover:bg-brand-light-slate"}`}
                    >
                      {route === "injection" ? "Add injection entry" : route === "topical" ? "Add topical entry" : "Add other entry"}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <TextInput label="Target teeth" value={anesthesiaForm.targetTeeth} onChange={(value) => updateAnesthesiaForm({ targetTeeth: value })} placeholder="e.g., 36 or 34 35 36" />
          <TextInput label="Region label" value={anesthesiaForm.regionLabel} onChange={(value) => updateAnesthesiaForm({ regionLabel: value })} placeholder="e.g., Q3, lower left, custom" />
          {anesthesiaRouteIsInjection ? (
            <>
              <TextInput label="Technique" value={anesthesiaForm.technique} onChange={(value) => updateAnesthesiaForm({ technique: value })} placeholder="optional" />
              <TextInput label="Site" value={anesthesiaForm.site} onChange={(value) => updateAnesthesiaForm({ site: value })} placeholder="optional" />
              <TextInput label="Agent" value={anesthesiaForm.agentLabel} onChange={(value) => updateAnesthesiaForm({ agentLabel: value })} placeholder="optional" />
              <TextInput label="Dose" value={anesthesiaForm.dose} onChange={(value) => updateAnesthesiaForm({ dose: value })} placeholder="optional" inputMode="decimal" />
              <TextInput label="Dose unit" value={anesthesiaForm.doseUnit} onChange={(value) => updateAnesthesiaForm({ doseUnit: value })} placeholder="e.g., mL, carpule" />
              <TextInput label="Vasoconstrictor" value={anesthesiaForm.vasoconstrictor} onChange={(value) => updateAnesthesiaForm({ vasoconstrictor: value })} placeholder="optional" />
              <TextInput label="Time administered" value={anesthesiaForm.administeredAt} onChange={(value) => updateAnesthesiaForm({ administeredAt: value })} placeholder="e.g., 09:55" />
            </>
          ) : null}
          {anesthesiaRouteIsTopical ? (
            <>
              <TextInput label="Application type" value={anesthesiaForm.applicationType} onChange={(value) => updateAnesthesiaForm({ applicationType: value })} placeholder="optional" />
              <TextInput label="Site" value={anesthesiaForm.site} onChange={(value) => updateAnesthesiaForm({ site: value })} placeholder="optional" />
              <TextInput label="Agent" value={anesthesiaForm.agentLabel} onChange={(value) => updateAnesthesiaForm({ agentLabel: value })} placeholder="optional" />
              <TextInput label="Time administered" value={anesthesiaForm.administeredAt} onChange={(value) => updateAnesthesiaForm({ administeredAt: value })} placeholder="e.g., 09:55" />
            </>
          ) : null}
          {anesthesiaRouteIsOther ? (
            <>
              <TextInput label="Route / application" value={anesthesiaForm.routeLabel} onChange={(value) => updateAnesthesiaForm({ routeLabel: value })} placeholder="optional" />
              <TextInput label="Application details" value={anesthesiaForm.applicationType} onChange={(value) => updateAnesthesiaForm({ applicationType: value })} placeholder="optional" />
              <TextInput label="Site" value={anesthesiaForm.site} onChange={(value) => updateAnesthesiaForm({ site: value })} placeholder="optional" />
            </>
          ) : null}
          {anesthesiaRouteIsTopical || anesthesiaRouteIsOther || anesthesiaModeIsAssessment ? (
            <TextInput
              label={anesthesiaAssessmentNeedsReassessment ? "Reason" : "Notes"}
              value={anesthesiaForm.note}
              onChange={(value) => updateAnesthesiaForm({ note: value })}
              placeholder={anesthesiaAssessmentNeedsReassessment ? "e.g., sensitivity returned" : "optional"}
            />
          ) : null}
        </div>
        <button
          type="button"
          onClick={submitAnesthesiaEvent}
          disabled={!anesthesiaAssessmentCanSubmit}
          className={`mt-3 rounded-xl border px-4 py-2 text-sm font-semibold transition ${anesthesiaAssessmentCanSubmit ? "border-brand-navy bg-brand-navy text-white hover:bg-brand-navy-deep" : "cursor-not-allowed border-brand-light-node bg-white text-brand-slate"}`}
        >
          {anesthesiaMode === "administration"
            ? anesthesiaForm.route === "injection" ? "Add injection entry" : anesthesiaForm.route === "topical" ? "Add topical entry" : "Add other entry"
            : "Record assessment"}
        </button>
      </section>

      <section ref={isolationSectionRef} tabIndex={-1} className="rounded-2xl border border-brand-light-node bg-brand-light-slate p-4 outline-none ring-brand-mint/30 focus:ring-2 lg:col-span-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-brand-navy">Isolation</h3>
            <p className="mt-1 text-sm leading-6 text-brand-slate">{capabilitySummary.isolation.summary}</p>
          </div>
          <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(capabilitySummary.isolation.satisfied, capabilitySummary.isolation.needsReassessment)}`}>
            {capabilitySummary.isolation.needsReassessment ? "Review" : capabilitySummary.isolation.satisfied ? "Ready" : "Pending"}
          </span>
        </div>
        {latestIsolationEvent ? (
          <div className="mt-3 grid gap-3 xl:grid-cols-[1.15fr_1.85fr]">
            <div className="rounded-xl border border-brand-light-node bg-white px-3 py-2">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-slate">Latest event</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-brand-navy">{formatIsolationEventFragment(latestIsolationEvent)}</p>
              {latestIsolationEventTime ? <p className="mt-1 text-xs leading-5 text-brand-slate">{latestIsolationEventTime}</p> : null}
            </div>
            <div className="rounded-xl border border-brand-light-node bg-white px-3 py-2">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-slate">Current coverage</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {isolationCoverageItems.map((item) => (
                  <div key={item.label} className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-slate">{item.label}</p>
                    <p className="truncate text-sm font-semibold text-brand-navy">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        {isolationIsEstablished ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              aria-label="Open embedded isolation workflow"
              onClick={() => onOpenIsolationWorkflow("isolation-needs-reassessment")}
              className="rounded-xl border border-brand-blue-light bg-brand-blue-light/20 px-3 py-2 text-sm font-semibold text-brand-navy transition hover:bg-brand-blue-light/30"
            >
              Open workflow
            </button>
            <button
              type="button"
              aria-label="Prepare compromised isolation event"
              onClick={() => prepareIsolationAction(isolationEventTypes.compromised)}
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-100"
            >
              Compromised
            </button>
            <button
              type="button"
              aria-label="Prepare removed isolation event"
              onClick={() => prepareIsolationAction(isolationEventTypes.removed)}
              className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-50"
            >
              Removed
            </button>
            <button
              type="button"
              aria-label="Prepare replacement isolation event"
              onClick={() => prepareIsolationAction(isolationEventTypes.replaced)}
              className="rounded-xl border border-brand-blue-light bg-white px-3 py-2 text-sm font-semibold text-brand-navy transition hover:bg-brand-blue-light/20"
            >
              Replace isolation
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <button
              type="button"
              aria-label="Open embedded isolation workflow"
              onClick={() => onOpenIsolationWorkflow()}
              className="rounded-xl border border-brand-blue-light bg-white px-3 py-2 text-sm font-semibold text-brand-navy transition hover:bg-brand-blue-light/20"
            >
              Open isolation workflow
            </button>
          </div>
        )}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <SelectInput
            label="Isolation action"
            value={isolationActionLabels[isolationForm.action]}
            onChange={(value) => updateIsolationAction(eventTypeFromLabel(value))}
            options={isolationActionOptions}
          />
          {showMethodField ? (
            <SelectInput
              label="Method"
              value={isolationForm.method}
              onChange={(value) => updateIsolationForm({ method: value as IsolationMethod })}
              options={methodOptions}
            />
          ) : null}
          <SelectInput
            label="Region"
            value={isolationForm.regionKind}
            onChange={(value) => updateIsolationForm({ regionKind: value as IsolationRegionKind })}
            options={[...isolationRegionKinds]}
          />
          <TextInput label="Region label" value={isolationForm.regionLabel} onChange={(value) => updateIsolationForm({ regionLabel: value })} placeholder="e.g., Q3, upper anterior, custom" />
          <TextInput label="Exposed teeth" value={isolationForm.exposedTeeth} onChange={(value) => updateIsolationForm({ exposedTeeth: value })} placeholder="e.g., 34 35 36 37" />
          {showClampFields ? (
            <>
              <TextInput label="Clamp tooth" value={isolationForm.clampTooth} onChange={(value) => updateIsolationForm({ clampTooth: value })} placeholder="e.g., 37" />
              <TextInput label="Clamp code" value={isolationForm.clampCode} onChange={(value) => updateIsolationForm({ clampCode: value })} placeholder="e.g., W8A" />
            </>
          ) : null}
          <TextInput
            label={actionIsReassessment ? "Reason" : "Notes"}
            value={isolationForm.note}
            onChange={(value) => updateIsolationForm({ note: value })}
            placeholder={isolationForm.action === isolationEventTypes.compromised ? "e.g., saliva contamination" : "optional"}
          />
        </div>
        <button
          type="button"
          onClick={submitIsolationEvent}
          className="mt-3 rounded-xl border border-brand-navy bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-navy-deep"
        >
          {isolationSubmitLabels[isolationForm.action]}
        </button>
      </section>
    </div>
  );
}
