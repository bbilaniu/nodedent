import React, { useState } from "react";
import type { CanalRecord, EndoCase } from "../types";
import { getCaseStatus } from "../engine/deriveCaseStatus";
import { isBlank, isPositiveMeasurement } from "../engine/measurements";
import { caseStatusOptions } from "../state/persistence";
import type { IsolationEventDetails, IsolationEventType, IsolationMethod, IsolationRegionKind } from "../workflow/isolation";
import { isolationEventTypes, isolationMethods, isolationRegionKinds } from "../workflow/isolation";
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

function eventTypeFromLabel(label: string): IsolationEventType {
  const entry = Object.entries(isolationActionLabels).find(([, actionLabel]) => actionLabel === label);
  return (entry?.[0] as IsolationEventType | undefined) || isolationEventTypes.rubberDamPlaced;
}

export function CaseSetupStatusPanel({
  caseData,
  activeCanal,
  onUpdateCase,
  onUpdateDiagnosis,
  onUpdatePreOp,
  onUpdateActiveCanal,
  onApplySuggestedCaseStatus,
  onRecordIsolationEvent,
}: {
  caseData: EndoCase;
  activeCanal?: CanalRecord | null;
  onUpdateCase: (updates: Partial<EndoCase>) => void;
  onUpdateDiagnosis: (field: string, value: string) => void;
  onUpdatePreOp: (field: string, value: string | boolean) => void;
  onUpdateActiveCanal: (field: string, value: string) => void;
  onApplySuggestedCaseStatus: () => void;
  onRecordIsolationEvent: (eventType: IsolationEventType, details: IsolationEventDetails) => void;
}) {
  const paReviewed = caseData.preOp?.paReviewed ?? caseData.preOp?.radiographsReviewed ?? false;
  const bwReviewed = caseData.preOp?.bwReviewed ?? false;
  const [isolationAction, setIsolationAction] = useState<IsolationEventType>(isolationEventTypes.rubberDamPlaced);
  const [isolationMethod, setIsolationMethod] = useState<IsolationMethod>("rubberDam");
  const [regionKind, setRegionKind] = useState<IsolationRegionKind>("custom");
  const [regionLabel, setRegionLabel] = useState("");
  const [exposedTeeth, setExposedTeeth] = useState(caseData.tooth || "");
  const [clampCode, setClampCode] = useState("");
  const [clampTooth, setClampTooth] = useState(caseData.tooth || "");
  const [isolationNote, setIsolationNote] = useState("");
  const capabilitySummary = getCaseCapabilitySummary(caseData);
  const statusItems = [
    { label: "Diagnosis", status: capabilitySummary.diagnosis },
    { label: "Radiographs", status: capabilitySummary.radiographs },
    { label: "Anesthesia", status: capabilitySummary.anesthesia },
    { label: "Isolation", status: capabilitySummary.isolation },
  ];
  const showClampFields = isolationAction === isolationEventTypes.rubberDamPlaced || isolationAction === isolationEventTypes.replaced;
  const actionIsReassessment = isolationAction === isolationEventTypes.compromised || isolationAction === isolationEventTypes.removed;

  function submitIsolationEvent() {
    const teeth = exposedTeeth.split(/[,\s]+/).map((tooth) => tooth.trim()).filter(Boolean);
    const details: IsolationEventDetails = {
      method: isolationAction === isolationEventTypes.alternativeIsolationUsed ? isolationMethod : "rubberDam",
      regionKind,
      regionLabel: regionLabel.trim() || undefined,
      exposedTeeth: teeth.length ? teeth : undefined,
      clampCode: showClampFields ? clampCode.trim() || undefined : undefined,
      clampTooth: showClampFields ? clampTooth.trim() || undefined : undefined,
      reason: actionIsReassessment ? isolationNote.trim() || undefined : undefined,
      notes: !actionIsReassessment ? isolationNote.trim() || undefined : undefined,
    };

    onRecordIsolationEvent(isolationAction, details);
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

      <section className="rounded-2xl border border-brand-light-node bg-brand-light-slate p-4 lg:col-span-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-brand-navy">Isolation</h3>
            <p className="mt-1 text-sm leading-6 text-brand-slate">{capabilitySummary.isolation.summary}</p>
          </div>
          <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(capabilitySummary.isolation.satisfied, capabilitySummary.isolation.needsReassessment)}`}>
            {capabilitySummary.isolation.needsReassessment ? "Review" : capabilitySummary.isolation.satisfied ? "Ready" : "Pending"}
          </span>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <SelectInput
            label="Isolation action"
            value={isolationActionLabels[isolationAction]}
            onChange={(value) => setIsolationAction(eventTypeFromLabel(value))}
            options={isolationActionOptions}
          />
          <SelectInput
            label="Method"
            value={isolationMethod}
            onChange={(value) => setIsolationMethod(value as IsolationMethod)}
            options={[...isolationMethods]}
          />
          <SelectInput
            label="Region"
            value={regionKind}
            onChange={(value) => setRegionKind(value as IsolationRegionKind)}
            options={[...isolationRegionKinds]}
          />
          <TextInput label="Region label" value={regionLabel} onChange={setRegionLabel} placeholder="e.g., Q3, upper anterior, custom" />
          <TextInput label="Exposed teeth" value={exposedTeeth} onChange={setExposedTeeth} placeholder="e.g., 34 35 36 37" />
          {showClampFields ? (
            <>
              <TextInput label="Clamp tooth" value={clampTooth} onChange={setClampTooth} placeholder="e.g., 37" />
              <TextInput label="Clamp code" value={clampCode} onChange={setClampCode} placeholder="e.g., W8A" />
            </>
          ) : null}
          <TextInput
            label={actionIsReassessment ? "Reason" : "Notes"}
            value={isolationNote}
            onChange={setIsolationNote}
            placeholder={isolationAction === isolationEventTypes.compromised ? "e.g., saliva contamination" : "optional"}
          />
        </div>
        <button
          type="button"
          onClick={submitIsolationEvent}
          className="mt-3 rounded-xl border border-brand-navy bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-navy-deep"
        >
          Record isolation event
        </button>
      </section>
    </div>
  );
}
