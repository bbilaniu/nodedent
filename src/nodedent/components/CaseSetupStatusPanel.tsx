import React, { useEffect, useRef } from "react";
import type { CanalRecord, CaseSetupFocusTarget, EndoCase } from "../types";
import { getCaseStatus } from "../engine/deriveCaseStatus";
import {
  deriveOverallWorkflowProgress,
  overallWorkflowProgressLabels,
  workflowLifecycleLabels,
} from "../engine/deriveWorkflowProgress";
import { isBlank } from "../engine/measurements";
import { caseStatusOptions } from "../state/persistence";
import type { AnesthesiaEventType } from "../workflow/anesthesia";
import { anesthesiaEventTypes, formatAnesthesiaEventFragment } from "../workflow/anesthesia";
import { formatIsolationEventFragment, getIsolationCoverageSummary } from "../workflow/isolation";
import {
  createOperativeSetupScope,
  operativeDirectRestorationWorkflowId,
  type OperativeWorkflowSetupState,
} from "../workflow/operative";
import { endodonticProcedureOptions } from "../workflow/procedures";
import { formatRadiologyEventFragment, isRadiologyReviewedEvent } from "../workflow/radiology";
import { endodonticRootWorkflowId } from "../workflow/registry";
import type { CapabilityStatus } from "../workflow/selectors";
import { getCaseCapabilitySummary } from "../workflow/selectors";
import { getWorkflowTargetPanelKind } from "../workflow/targetPanels";
import {
  canRemovePrimaryWorkflow,
  getWorkflowTargetEditability,
  getWorkflowTargetTooth,
  normalizeWorkflowInstances,
  selectablePrimaryWorkflows,
} from "../workflow/workflowInstances";
import { EndodonticWorkflowSetupPanel } from "./EndodonticWorkflowSetupPanel";
import { SelectInput, TextInput } from "./FormControls";
import { sharedCapabilityStatusClass, sharedCapabilityStatusLabel } from "./sharedModuleUi";
import { cx, panelActionButton, panelSurface, sectionText, statusBadge } from "./uiStyles";

type CaseSetupFocusRefs = Record<CaseSetupFocusTarget, React.RefObject<HTMLElement | null>>;

function formatEventTimestamp(timestamp?: string) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function focusCaseSetupSection(focusTarget: CaseSetupFocusTarget | null | undefined, focusRefs: CaseSetupFocusRefs) {
  if (!focusTarget) return;
  const section = focusRefs[focusTarget].current;
  section?.scrollIntoView({ behavior: "smooth", block: "start" });
  section?.focus({ preventScroll: true });
}

function CaseSetupGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3 lg:col-span-2">
      <div>
        <p className={sectionText.eyebrow}>Case Setup & Status</p>
        <h3 className={sectionText.title}>{title}</h3>
        <p className={sectionText.description}>{description}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function CaseIdentitySection({
  caseData,
  onUpdateCase,
}: {
  caseData: EndoCase;
  onUpdateCase: (updates: Partial<EndoCase>) => void;
}) {
  return (
    <section className={panelSurface.muted}>
      <h3 className={sectionText.titleSmall}>Chart, appointment, and default treatment area</h3>
      <div className="mt-3 grid gap-3">
        <TextInput label="Patient chart #" value={caseData.patientNumber} onChange={(value) => onUpdateCase({ patientNumber: value })} placeholder="chart number only" />
        <p className="-mt-2 text-xs leading-5 text-amber-900">Use the clinic chart number only. Do not enter a name, exact birth date, contact detail, health number, or insurance identifier.</p>
        <TextInput
          label="Appointment date"
          value={caseData.appointmentDate || ""}
          onChange={(value) => onUpdateCase({ appointmentDate: value })}
          type="date"
          invalid={isBlank(caseData.appointmentDate)}
        />
        <TextInput label="Default tooth" value={caseData.tooth} onChange={(value) => onUpdateCase({ tooth: value })} invalid={isBlank(caseData.tooth)} />
        <p className="text-xs leading-5 text-brand-slate">This tooth is the default area for new workflow selections. Each workflow retains its own target context.</p>
      </div>
    </section>
  );
}

function WorkflowSelectionSection({
  caseData,
  currentNodeId,
  onSelectionChange,
  onProcedureChange,
  onTargetToothChange,
  onOpenWorkflow,
}: {
  caseData: EndoCase;
  currentNodeId: string;
  onSelectionChange: (workflowId: string, selected: boolean) => void;
  onProcedureChange: (workflowId: string, procedureLabel: string) => void;
  onTargetToothChange: (instanceId: string, tooth: string) => void;
  onOpenWorkflow: (workflowId: string) => void;
}) {
  const instances = normalizeWorkflowInstances(caseData, currentNodeId);

  return (
    <section className={cx(panelSurface.muted, "lg:col-span-2")}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className={sectionText.titleSmall}>Disciplines and treatment workflows</h3>
          <p className={sectionText.description}>
            Select every implemented primary workflow that belongs to this case. Endodontic and operative treatment may coexist.
          </p>
        </div>
        <span className={cx(statusBadge.base, instances.length ? statusBadge.ready : statusBadge.neutral)}>
          {instances.length ? `${instances.length} selected` : "None selected"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {selectablePrimaryWorkflows.map((definition) => {
          const instance = instances.find((item) => item.workflowId === definition.workflowId);
          const selected = Boolean(instance);
          const removable = instance ? canRemovePrimaryWorkflow(instance) : false;
          const targetLabel = instance?.target.label || (caseData.tooth ? `Tooth ${caseData.tooth}` : "Target not set");
          const targetEditability = instance
            ? getWorkflowTargetEditability(caseData, instance.id, currentNodeId)
            : { editable: false, reason: "" };

          return (
            <article
              key={definition.workflowId}
              className={`rounded-2xl border p-4 ${selected ? "border-brand-mint bg-brand-mint/10" : "border-brand-light-node bg-white"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-brand-slate">{definition.discipline}</p>
                  <h4 className="mt-1 text-base font-bold text-brand-navy">{definition.label}</h4>
                  <p className="mt-1 text-xs leading-5 text-brand-slate">{definition.summary}</p>
                </div>
                <span className={cx(statusBadge.base, selected ? statusBadge.ready : statusBadge.neutral)}>
                  {instance ? workflowLifecycleLabels[instance.status] : "Not selected"}
                </span>
              </div>

              <p className="mt-3 text-xs font-semibold text-brand-slate">Target: {targetLabel}</p>

              {selected && instance && definition.workflowId === endodonticRootWorkflowId ? (
                <div className="mt-3">
                  <TextInput
                    label="Workflow target tooth"
                    value={instance.target.tooth || ""}
                    onChange={(value) => onTargetToothChange(instance.id, value)}
                    disabled={!targetEditability.editable}
                    invalid={targetEditability.editable && isBlank(instance.target.tooth)}
                    helperText={targetEditability.editable
                      ? "Correct this target before recording clinical activity. Changing the default tooth does not change this workflow."
                      : targetEditability.reason}
                  />
                </div>
              ) : null}

              {selected && definition.workflowId === endodonticRootWorkflowId ? (
                <div className="mt-3">
                  <SelectInput
                    label="Endodontic procedure"
                    value={instance?.procedureLabel || "RCT"}
                    onChange={(value) => onProcedureChange(definition.workflowId, value)}
                    options={endodonticProcedureOptions}
                  />
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onSelectionChange(definition.workflowId, !selected)}
                  disabled={selected && !removable}
                  className={selected
                    ? "rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-brand-light-node disabled:text-brand-slate"
                    : "rounded-xl border border-brand-navy bg-brand-navy px-3 py-2 text-sm font-semibold text-white hover:bg-brand-navy-deep"}
                >
                  {selected ? removable ? "Remove from case" : "Retained with recorded activity" : "Add to case"}
                </button>
                {selected ? (
                  <button
                    type="button"
                    onClick={() => onOpenWorkflow(definition.workflowId)}
                    className="rounded-xl border border-brand-blue-light bg-white px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-blue-light/20"
                  >
                    Open workflow
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      <p className="mt-3 text-xs leading-5 text-brand-slate">
        A workflow with recorded clinical activity cannot be removed from the case because its event history remains part of the audit record.
      </p>
    </section>
  );
}

function CaseVisitStatusSection({
  caseData,
  currentNodeId,
  onUpdateCase,
  onApplySuggestedCaseStatus,
}: {
  caseData: EndoCase;
  currentNodeId: string;
  onUpdateCase: (updates: Partial<EndoCase>) => void;
  onApplySuggestedCaseStatus: () => void;
}) {
  const instances = normalizeWorkflowInstances(caseData, currentNodeId);
  const overallProgress = deriveOverallWorkflowProgress(instances);

  return (
    <section className={panelSurface.muted}>
      <h3 className={sectionText.titleSmall}>Case visit status</h3>
      <div className="mt-3 grid gap-3">
        <div className="rounded-xl border border-brand-light-node bg-white px-3 py-2">
          <p className="text-xs font-medium text-brand-slate">Overall progress</p>
          <p className="mt-1 text-sm font-semibold text-brand-navy">{overallWorkflowProgressLabels[overallProgress]}</p>
          <p className="mt-1 text-xs leading-5 text-brand-slate">Derived from the selected workflow lifecycles.</p>
        </div>
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
  );
}

function DiagnosisReadinessSection({
  caseData,
  onUpdateDiagnosis,
  sectionRef,
}: {
  caseData: EndoCase;
  onUpdateDiagnosis: (field: string, value: string) => void;
  sectionRef: React.RefObject<HTMLElement | null>;
}) {
  return (
    <section ref={sectionRef} tabIndex={-1} className={panelSurface.mutedFocusable}>
      <h3 className={sectionText.titleSmall}>Diagnosis readiness</h3>
      <div className="mt-3 grid gap-3">
        <TextInput label="Pulpal diagnosis" value={caseData.diagnosis?.pulpal || ""} onChange={(value) => onUpdateDiagnosis("pulpal", value)} placeholder="optional" />
        <TextInput label="Apical diagnosis" value={caseData.diagnosis?.apical || ""} onChange={(value) => onUpdateDiagnosis("apical", value)} placeholder="optional" />
      </div>
    </section>
  );
}

function RadiographReadinessSection({
  caseData,
  paReviewed,
  bwReviewed,
  onUpdatePreOp,
  onOpenRadiologyWorkflow,
  sectionRef,
}: {
  caseData: EndoCase;
  paReviewed: boolean;
  bwReviewed: boolean;
  onUpdatePreOp: (field: string, value: string | boolean) => void;
  onOpenRadiologyWorkflow: (entryNodeId?: string) => void;
  sectionRef: React.RefObject<HTMLElement | null>;
}) {
  const latestRadiologyEvent = (caseData.globalEvents || []).filter(isRadiologyReviewedEvent).at(-1);
  const latestRadiologyEventTime = formatEventTimestamp(latestRadiologyEvent?.timestamp);

  return (
    <section ref={sectionRef} tabIndex={-1} className={panelSurface.mutedFocusable}>
      <h3 className={sectionText.titleSmall}>Radiograph readiness</h3>
      {latestRadiologyEvent ? (
        <div className="mt-3 rounded-xl border border-brand-mint/40 bg-brand-mint/10 px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-slate">Latest shared radiology event</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-brand-navy">{formatRadiologyEventFragment(latestRadiologyEvent)}</p>
          {latestRadiologyEventTime ? <p className="mt-1 text-xs leading-5 text-brand-slate">{latestRadiologyEventTime}</p> : null}
        </div>
      ) : null}
      {caseData.priorVisit?.priorRadiographsAvailable ? (
        <div className="mt-3 rounded-xl border border-brand-light-node bg-white px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-slate">Prior-visit radiographs</p>
          <p className="mt-1 text-sm leading-6 text-brand-slate">
            Prior radiographs are documented as available. Record a shared radiology event when the current visit review should be explicit.
          </p>
        </div>
      ) : null}
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
        <button
          type="button"
          aria-label="Open embedded radiology workflow"
          onClick={() => onOpenRadiologyWorkflow(latestRadiologyEvent ? "radiology-review" : undefined)}
          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${latestRadiologyEvent ? "border-brand-blue-light bg-brand-blue-light/20 text-brand-navy hover:bg-brand-blue-light/30" : "border-brand-blue-light bg-white text-brand-navy hover:bg-brand-blue-light/20"}`}
        >
          {latestRadiologyEvent ? "Review radiology" : "Open radiology workflow"}
        </button>
      </div>
    </section>
  );
}

function SharedClinicalReadinessSection({
  statusItems,
}: {
  statusItems: Array<{ label: string; status: CapabilityStatus }>;
}) {
  return (
    <section className={cx(panelSurface.muted, "lg:col-span-2")}>
      <h3 className={sectionText.titleSmall}>Shared clinical readiness</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statusItems.map(({ label, status }) => (
          <div key={label} className={`rounded-xl border px-3 py-2 ${sharedCapabilityStatusClass(status)}`}>
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold">
                {sharedCapabilityStatusLabel(status)}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold leading-5">{status.summary}</p>
            {status.reason ? <p className="mt-1 text-xs leading-5 opacity-80">{status.reason}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function OperativeWorkflowSetupSummary({
  caseData,
  setup,
  onOpenOperativeWorkflowSetup,
}: {
  caseData: EndoCase;
  setup: OperativeWorkflowSetupState;
  onOpenOperativeWorkflowSetup?: () => void;
}) {
  const targetTooth = getWorkflowTargetTooth(caseData, operativeDirectRestorationWorkflowId);
  const scope = createOperativeSetupScope(setup, targetTooth);
  const rows = [
    { label: "Scope", value: scope.label || "No tooth/surface scope yet" },
    { label: "Restoration intent", value: setup.restorationIntent || "Not recorded" },
    { label: "Material", value: setup.material || "Not recorded" },
    { label: "Shade", value: setup.shade || "Not recorded" },
  ];

  return (
    <section className={cx(panelSurface.muted, "lg:col-span-2")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className={sectionText.titleSmall}>Operative setup summary</h3>
          <p className={sectionText.descriptionSmall}>Edit tooth and surface scope in the active operative workflow.</p>
        </div>
        <button
          type="button"
          onClick={onOpenOperativeWorkflowSetup}
          disabled={!onOpenOperativeWorkflowSetup}
          className="shrink-0 rounded-xl border border-brand-navy bg-brand-navy px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-navy-deep disabled:cursor-not-allowed disabled:border-brand-light-node disabled:bg-white disabled:text-brand-slate"
        >
          Open operative workflow
        </button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl border border-brand-light-node bg-white px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-slate">{row.label}</p>
            <p className="mt-1 text-sm font-semibold text-brand-navy">{row.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function CaseSetupStatusPanel({
  caseData,
  activeCanal,
  activeWorkflowId,
  currentNodeId,
  operativeSetup,
  onUpdateCase,
  onUpdateDiagnosis,
  onUpdatePreOp,
  onUpdateActiveCanal,
  onApplySuggestedCaseStatus,
  onOpenAnesthesiaWorkflow,
  onOpenIsolationWorkflow,
  onOpenRadiologyWorkflow,
  onOpenOperativeWorkflowSetup,
  onPrimaryWorkflowSelectionChange,
  onPrimaryWorkflowProcedureChange,
  onPrimaryWorkflowTargetToothChange,
  onOpenPrimaryWorkflow,
  initialFocusSection,
}: {
  caseData: EndoCase;
  activeCanal?: CanalRecord | null;
  activeWorkflowId: string;
  currentNodeId: string;
  operativeSetup?: OperativeWorkflowSetupState;
  onUpdateCase: (updates: Partial<EndoCase>) => void;
  onUpdateDiagnosis: (field: string, value: string) => void;
  onUpdatePreOp: (field: string, value: string | boolean) => void;
  onUpdateActiveCanal: (field: string, value: string) => void;
  onApplySuggestedCaseStatus: () => void;
  onOpenAnesthesiaWorkflow: (entryNodeId?: string) => void;
  onOpenIsolationWorkflow: (entryNodeId?: string) => void;
  onOpenRadiologyWorkflow: (entryNodeId?: string) => void;
  onOpenOperativeWorkflowSetup?: () => void;
  onPrimaryWorkflowSelectionChange: (workflowId: string, selected: boolean) => void;
  onPrimaryWorkflowProcedureChange: (workflowId: string, procedureLabel: string) => void;
  onPrimaryWorkflowTargetToothChange: (instanceId: string, tooth: string) => void;
  onOpenPrimaryWorkflow: (workflowId: string) => void;
  initialFocusSection?: CaseSetupFocusTarget | null;
}) {
  const paReviewed = caseData.preOp?.paReviewed ?? caseData.preOp?.radiographsReviewed ?? false;
  const bwReviewed = caseData.preOp?.bwReviewed ?? false;
  const workflowTargetPanelKind = getWorkflowTargetPanelKind(activeWorkflowId);
  const selectedWorkflowInstances = normalizeWorkflowInstances(caseData, currentNodeId);
  const showEndodonticWorkflowSetup = workflowTargetPanelKind === "endodontic" ||
    selectedWorkflowInstances.some((instance) => instance.workflowId === endodonticRootWorkflowId);
  const showOperativeWorkflowSetup = Boolean(operativeSetup) && (
    workflowTargetPanelKind === "operative" ||
    selectedWorkflowInstances.some((instance) => instance.workflowId === operativeDirectRestorationWorkflowId)
  );
  const anesthesiaSectionRef = useRef<HTMLElement | null>(null);
  const diagnosisSectionRef = useRef<HTMLElement | null>(null);
  const isolationSectionRef = useRef<HTMLElement | null>(null);
  const radiographsSectionRef = useRef<HTMLElement | null>(null);
  const focusRefs: CaseSetupFocusRefs = {
    diagnosis: diagnosisSectionRef,
    radiographs: radiographsSectionRef,
    anesthesia: anesthesiaSectionRef,
    isolation: isolationSectionRef,
  };
  const activeTargetTooth = activeWorkflowId
    ? getWorkflowTargetTooth(caseData, activeWorkflowId, currentNodeId)
    : caseData.tooth;
  const capabilitySummary = getCaseCapabilitySummary(caseData, activeTargetTooth);
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
  const anesthesiaIsEstablished = capabilitySummary.anesthesia.satisfied && !capabilitySummary.anesthesia.needsReassessment;
  const anesthesiaWorkflowEntryNodeId = anesthesiaIsEstablished || capabilitySummary.anesthesia.needsReassessment
    ? "anesthesia-needs-reassessment"
    : undefined;
  const isolationIsEstablished = capabilitySummary.isolation.satisfied && !capabilitySummary.isolation.needsReassessment;

  useEffect(() => {
    focusCaseSetupSection(initialFocusSection, focusRefs);
  }, [initialFocusSection]);

  return (
    <div className="grid gap-6">
      <CaseSetupGroup title="Case identity" description="Patient, default treatment area, visit status, and next-visit planning.">
        <CaseIdentitySection caseData={caseData} onUpdateCase={onUpdateCase} />
        <CaseVisitStatusSection
          caseData={caseData}
          currentNodeId={currentNodeId}
          onUpdateCase={onUpdateCase}
          onApplySuggestedCaseStatus={onApplySuggestedCaseStatus}
        />
      </CaseSetupGroup>

      <CaseSetupGroup title="Treatment plan" description="Select one or more implemented disciplines without forcing the case into a single procedure.">
        <WorkflowSelectionSection
          caseData={caseData}
          currentNodeId={currentNodeId}
          onSelectionChange={onPrimaryWorkflowSelectionChange}
          onProcedureChange={onPrimaryWorkflowProcedureChange}
          onTargetToothChange={onPrimaryWorkflowTargetToothChange}
          onOpenWorkflow={onOpenPrimaryWorkflow}
        />
      </CaseSetupGroup>

      <CaseSetupGroup title="Shared readiness" description="Reusable diagnosis, radiograph, anesthesia, and isolation context for the current workflow.">
        <DiagnosisReadinessSection caseData={caseData} onUpdateDiagnosis={onUpdateDiagnosis} sectionRef={diagnosisSectionRef} />
        <RadiographReadinessSection
          caseData={caseData}
          paReviewed={paReviewed}
          bwReviewed={bwReviewed}
          onUpdatePreOp={onUpdatePreOp}
          onOpenRadiologyWorkflow={onOpenRadiologyWorkflow}
          sectionRef={radiographsSectionRef}
        />
        <SharedClinicalReadinessSection statusItems={statusItems} />
      </CaseSetupGroup>

      {showEndodonticWorkflowSetup ? (
        <CaseSetupGroup title="Endodontic setup" description="Endodontic-only canal and measurement setup for the active RCT workflow.">
          <EndodonticWorkflowSetupPanel caseData={caseData} activeCanal={activeCanal} onUpdatePreOp={onUpdatePreOp} onUpdateActiveCanal={onUpdateActiveCanal} />
        </CaseSetupGroup>
      ) : null}

      {showOperativeWorkflowSetup && operativeSetup ? (
        <CaseSetupGroup title="Operative setup" description="Operative tooth, surface, material, and shade documentation for the active direct restoration workflow.">
          <OperativeWorkflowSetupSummary
            caseData={caseData}
            setup={operativeSetup}
            onOpenOperativeWorkflowSetup={onOpenOperativeWorkflowSetup}
          />
        </CaseSetupGroup>
      ) : null}

      <section ref={anesthesiaSectionRef} tabIndex={-1} className={cx(panelSurface.mutedFocusable, "lg:col-span-2")}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className={sectionText.titleSmall}>Anesthesia</h3>
            <p className={sectionText.description}>{capabilitySummary.anesthesia.summary}</p>
          </div>
          <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${sharedCapabilityStatusClass(capabilitySummary.anesthesia)}`}>
            {sharedCapabilityStatusLabel(capabilitySummary.anesthesia)}
          </span>
        </div>
        {latestAnesthesiaEvent ? (
          <div className="mt-3 rounded-xl border border-brand-light-node bg-white px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-slate">Latest event</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-brand-navy">{formatAnesthesiaEventFragment(latestAnesthesiaEvent)}</p>
            {latestAnesthesiaEventTime ? <p className="mt-1 text-xs leading-5 text-brand-slate">{latestAnesthesiaEventTime}</p> : null}
          </div>
        ) : null}
        <div className="mt-3">
          <button
            type="button"
            aria-label="Open embedded anesthesia workflow"
            onClick={() => onOpenAnesthesiaWorkflow(anesthesiaWorkflowEntryNodeId)}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${anesthesiaIsEstablished ? "border-brand-blue-light bg-brand-blue-light/20 text-brand-navy hover:bg-brand-blue-light/30" : "border-brand-blue-light bg-white text-brand-navy hover:bg-brand-blue-light/20"}`}
          >
            {anesthesiaIsEstablished || capabilitySummary.anesthesia.needsReassessment ? "Review anesthesia" : "Open anesthesia workflow"}
          </button>
        </div>
      </section>

      <section ref={isolationSectionRef} tabIndex={-1} className={cx(panelSurface.mutedFocusable, "lg:col-span-2")}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className={sectionText.titleSmall}>Isolation</h3>
            <p className={sectionText.description}>{capabilitySummary.isolation.summary}</p>
          </div>
          <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${sharedCapabilityStatusClass(capabilitySummary.isolation)}`}>
            {sharedCapabilityStatusLabel(capabilitySummary.isolation)}
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
          <div className="mt-3">
            <button
              type="button"
              aria-label="Open embedded isolation workflow"
              onClick={() => onOpenIsolationWorkflow("isolation-needs-reassessment")}
              className="rounded-xl border border-brand-blue-light bg-brand-blue-light/20 px-3 py-2 text-sm font-semibold text-brand-navy transition hover:bg-brand-blue-light/30"
            >
              Review isolation
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
      </section>
    </div>
  );
}
