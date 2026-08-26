import React, { useEffect, useRef } from "react";
import type { CaseSetupFocusTarget, EndoCase } from "../types";
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
import { endodonticProcedureOptions } from "../workflow/procedures";
import { getDiagnosisSectionSummary } from "../workflow/diagnosis";
import { formatRadiologyEventFragment, isRadiologyReviewedEvent } from "../workflow/radiology";
import { endodonticRootWorkflowId } from "../workflow/registry";
import type { CapabilityStatus } from "../workflow/selectors";
import { getCaseCapabilitySummary } from "../workflow/selectors";
import {
  canRemovePrimaryWorkflow,
  normalizeWorkflowInstances,
  selectablePrimaryWorkflows,
} from "../workflow/workflowInstances";
import { SelectInput, TextInput } from "./FormControls";
import { sharedCapabilityStatusClass, sharedCapabilityStatusLabel } from "./sharedModuleUi";
import {
  cx,
  panelActionButton,
  panelSurface,
  sectionText,
  semanticFormControl,
  semanticSelectionSurface,
  semanticSelectionTone,
  statusBadge,
} from "./uiStyles";

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
      <h3 className={sectionText.titleSmall}>Chart and default treatment area</h3>
      <div className="mt-3 grid gap-3">
        <TextInput label="Patient chart #" value={caseData.patientNumber} onChange={(value) => onUpdateCase({ patientNumber: value })} placeholder="chart number only" />
        <p className="-mt-2 text-xs leading-5 text-amber-900">Use the clinic chart number only. Do not enter a name, exact birth date, contact detail, health number, or insurance identifier.</p>
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
  onOpenWorkflow,
}: {
  caseData: EndoCase;
  currentNodeId: string;
  onSelectionChange: (workflowId: string, selected: boolean) => void;
  onProcedureChange: (workflowId: string, procedureLabel: string) => void;
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
        <span className={cx(statusBadge.base, instances.length ? semanticSelectionTone.selected : semanticSelectionTone.unselected)}>
          {instances.length ? `${instances.length} selected` : "None selected"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {selectablePrimaryWorkflows.map((definition) => {
          const instance = instances.find((item) => item.workflowId === definition.workflowId);
          const selected = Boolean(instance);
          const removable = instance ? canRemovePrimaryWorkflow(instance) : false;
          const targetLabel = instance?.target.label || (caseData.tooth ? `Tooth ${caseData.tooth}` : "Target not set");

          return (
            <article
              key={definition.workflowId}
              className={selected ? semanticSelectionSurface.selected : semanticSelectionSurface.unselected}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-brand-slate">{definition.discipline}</p>
                  <h4 className="mt-1 text-base font-bold text-brand-navy">{definition.label}</h4>
                  <p className="mt-1 text-xs leading-5 text-brand-slate">{definition.summary}</p>
                </div>
                <span className={cx(statusBadge.base, instance?.status === "complete" ? statusBadge.positive : statusBadge.neutral)}>
                  {instance ? workflowLifecycleLabels[instance.status] : "Not selected"}
                </span>
              </div>

              <p className="mt-3 text-xs font-semibold text-brand-slate">Target: {targetLabel}</p>

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
                {selected ? (
                  <button
                    type="button"
                    onClick={() => onOpenWorkflow(definition.workflowId)}
                    className={panelActionButton.primary}
                  >
                    Open workflow
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelectionChange(definition.workflowId, !selected)}
                  disabled={selected && !removable}
                  className={selected ? panelActionButton.secondary : panelActionButton.primary}
                >
                  {selected ? removable ? "Remove from case" : "Retained with recorded activity" : "Add to case"}
                </button>
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
        <button onClick={onApplySuggestedCaseStatus} className={panelActionButton.secondaryCompact}>Use suggested status</button>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-brand-slate">Next visit / plan</span>
          <textarea
            value={caseData.nextVisitPlan || ""}
            onChange={(event) => onUpdateCase({ nextVisitPlan: event.target.value })}
            placeholder="e.g., continue obturation, crown recommended, refer"
            className={cx(semanticFormControl.default, "h-24")}
          />
        </label>
      </div>
    </section>
  );
}

function ReadinessCardHeader({
  title,
  status,
}: {
  title: string;
  status: CapabilityStatus;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 className={sectionText.titleSmall}>{title}</h3>
        <p className={sectionText.descriptionSmall}>{status.summary}</p>
      </div>
      <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${sharedCapabilityStatusClass(status)}`}>
        {sharedCapabilityStatusLabel(status)}
      </span>
    </div>
  );
}

function DiagnosisReadinessSection({
  caseData,
  status,
  onOpenDiagnosis,
  sectionRef,
}: {
  caseData: EndoCase;
  status: CapabilityStatus;
  onOpenDiagnosis: () => void;
  sectionRef: React.RefObject<HTMLElement | null>;
}) {
  return (
    <section ref={sectionRef} tabIndex={-1} className={cx(panelSurface.mutedFocusable, "flex h-full flex-col")}>
      <ReadinessCardHeader title="Diagnosis" status={status} />
      <p className="mt-3 text-xs leading-5 text-brand-slate">
        Endodontics · {getDiagnosisSectionSummary(caseData, "endodontic")} · {caseData.tooth.trim() ? `Tooth ${caseData.tooth.trim()}` : "Default tooth not set"}
      </p>
      <div className="mt-auto pt-3">
        <button type="button" onClick={onOpenDiagnosis} className={panelActionButton.primary}>
          Review diagnosis
        </button>
      </div>
    </section>
  );
}

function RadiographReadinessSection({
  caseData,
  status,
  onOpenRadiologyWorkflow,
  sectionRef,
}: {
  caseData: EndoCase;
  status: CapabilityStatus;
  onOpenRadiologyWorkflow: (entryNodeId?: string) => void;
  sectionRef: React.RefObject<HTMLElement | null>;
}) {
  const latestRadiologyEvent = (caseData.globalEvents || []).filter(isRadiologyReviewedEvent).at(-1);
  const latestRadiologyEventTime = formatEventTimestamp(latestRadiologyEvent?.timestamp);
  const reviewedModalities = [
    caseData.preOp?.paReviewed || caseData.preOp?.radiographsReviewed ? "PA" : null,
    caseData.preOp?.bwReviewed ? "BW" : null,
    caseData.preOp?.cbctReviewed ? "CBCT" : null,
  ].filter(Boolean);

  return (
    <section ref={sectionRef} tabIndex={-1} className={cx(panelSurface.mutedFocusable, "flex h-full flex-col")}>
      <ReadinessCardHeader title="Radiographs" status={status} />
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
      {reviewedModalities.length ? (
        <div className="mt-3 rounded-xl border border-brand-light-node bg-white px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-slate">Current case record</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-brand-navy">Reviewed modalities: {reviewedModalities.join(", ")}</p>
        </div>
      ) : null}
      <div className="mt-auto pt-3">
        <button
          type="button"
          aria-label="Open embedded radiology workflow"
          onClick={() => onOpenRadiologyWorkflow(latestRadiologyEvent ? "radiology-review" : undefined)}
          className={panelActionButton.primary}
        >
          {latestRadiologyEvent ? "Review radiology" : "Open radiology workflow"}
        </button>
      </div>
    </section>
  );
}

function AnesthesiaReadinessSection({
  caseData,
  status,
  onOpenAnesthesiaWorkflow,
  sectionRef,
}: {
  caseData: EndoCase;
  status: CapabilityStatus;
  onOpenAnesthesiaWorkflow: (entryNodeId?: string) => void;
  sectionRef: React.RefObject<HTMLElement | null>;
}) {
  const anesthesiaEvents = (caseData.globalEvents || []).filter((event) => Object.values(anesthesiaEventTypes).includes(event.type as AnesthesiaEventType));
  const latestAnesthesiaEvent = anesthesiaEvents.at(-1);
  const latestAnesthesiaEventTime = formatEventTimestamp(latestAnesthesiaEvent?.timestamp);
  const established = status.satisfied && !status.needsReassessment;
  const workflowEntryNodeId = established || status.needsReassessment
    ? "anesthesia-needs-reassessment"
    : undefined;

  return (
    <section ref={sectionRef} tabIndex={-1} className={cx(panelSurface.mutedFocusable, "flex h-full flex-col")}>
      <ReadinessCardHeader title="Anesthesia" status={status} />
      {latestAnesthesiaEvent ? (
        <div className="mt-3 rounded-xl border border-brand-light-node bg-white px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-slate">Latest event</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-brand-navy">{formatAnesthesiaEventFragment(latestAnesthesiaEvent)}</p>
          {latestAnesthesiaEventTime ? <p className="mt-1 text-xs leading-5 text-brand-slate">{latestAnesthesiaEventTime}</p> : null}
        </div>
      ) : null}
      <div className="mt-auto pt-3">
        <button
          type="button"
          aria-label="Open embedded anesthesia workflow"
          onClick={() => onOpenAnesthesiaWorkflow(workflowEntryNodeId)}
          className={panelActionButton.primary}
        >
          {established || status.needsReassessment ? "Review anesthesia" : "Open anesthesia workflow"}
        </button>
      </div>
    </section>
  );
}

function IsolationReadinessSection({
  status,
  onOpenIsolationWorkflow,
  sectionRef,
}: {
  status: CapabilityStatus;
  onOpenIsolationWorkflow: (entryNodeId?: string) => void;
  sectionRef: React.RefObject<HTMLElement | null>;
}) {
  const latestIsolationEvent = status.sourceEvent;
  const latestIsolationEventTime = formatEventTimestamp(latestIsolationEvent?.timestamp);
  const isolationCoverage = getIsolationCoverageSummary(latestIsolationEvent);
  const isolationCoverageItems = [
    { label: "Exposed teeth", value: isolationCoverage.exposedTeeth },
    { label: "Region", value: isolationCoverage.region },
    { label: "Clamp tooth", value: isolationCoverage.clampTooth },
    { label: "Clamp code", value: isolationCoverage.clampCode },
  ];
  const established = status.satisfied && !status.needsReassessment;

  return (
    <section ref={sectionRef} tabIndex={-1} className={cx(panelSurface.mutedFocusable, "flex h-full flex-col")}>
      <ReadinessCardHeader title="Isolation" status={status} />
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
      <div className="mt-auto pt-3">
        <button
          type="button"
          aria-label="Open embedded isolation workflow"
          onClick={() => onOpenIsolationWorkflow(established ? "isolation-needs-reassessment" : undefined)}
          className={panelActionButton.primary}
        >
          {established ? "Review isolation" : "Open isolation workflow"}
        </button>
      </div>
    </section>
  );
}

export function CaseSetupStatusPanel({
  caseData,
  currentNodeId,
  onUpdateCase,
  onApplySuggestedCaseStatus,
  onOpenAnesthesiaWorkflow,
  onOpenIsolationWorkflow,
  onOpenRadiologyWorkflow,
  onOpenDiagnosis,
  onPrimaryWorkflowSelectionChange,
  onPrimaryWorkflowProcedureChange,
  onOpenPrimaryWorkflow,
  initialFocusSection,
}: {
  caseData: EndoCase;
  currentNodeId: string;
  onUpdateCase: (updates: Partial<EndoCase>) => void;
  onApplySuggestedCaseStatus: () => void;
  onOpenAnesthesiaWorkflow: (entryNodeId?: string) => void;
  onOpenIsolationWorkflow: (entryNodeId?: string) => void;
  onOpenRadiologyWorkflow: (entryNodeId?: string) => void;
  onOpenDiagnosis: () => void;
  onPrimaryWorkflowSelectionChange: (workflowId: string, selected: boolean) => void;
  onPrimaryWorkflowProcedureChange: (workflowId: string, procedureLabel: string) => void;
  onOpenPrimaryWorkflow: (workflowId: string) => void;
  initialFocusSection?: CaseSetupFocusTarget | null;
}) {
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
  const capabilitySummary = getCaseCapabilitySummary(caseData);

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
          onOpenWorkflow={onOpenPrimaryWorkflow}
        />
      </CaseSetupGroup>

      <CaseSetupGroup title="Shared readiness" description="Reusable diagnosis, radiograph, anesthesia, and isolation context for the current workflow.">
        <DiagnosisReadinessSection
          caseData={caseData}
          status={capabilitySummary.diagnosis}
          onOpenDiagnosis={onOpenDiagnosis}
          sectionRef={diagnosisSectionRef}
        />
        <RadiographReadinessSection
          caseData={caseData}
          status={capabilitySummary.radiographs}
          onOpenRadiologyWorkflow={onOpenRadiologyWorkflow}
          sectionRef={radiographsSectionRef}
        />
        <AnesthesiaReadinessSection
          caseData={caseData}
          status={capabilitySummary.anesthesia}
          onOpenAnesthesiaWorkflow={onOpenAnesthesiaWorkflow}
          sectionRef={anesthesiaSectionRef}
        />
        <IsolationReadinessSection
          status={capabilitySummary.isolation}
          onOpenIsolationWorkflow={onOpenIsolationWorkflow}
          sectionRef={isolationSectionRef}
        />
      </CaseSetupGroup>
    </div>
  );
}
