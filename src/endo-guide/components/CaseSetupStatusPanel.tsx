import React from "react";
import type { CanalRecord, EndoCase } from "../types";
import { getCaseStatus } from "../engine/deriveCaseStatus";
import { isBlank, isPositiveMeasurement } from "../engine/measurements";
import { caseStatusOptions } from "../state/persistence";
import { SelectInput, TextInput } from "./FormControls";

export function CaseSetupStatusPanel({
  caseData,
  activeCanal,
  onUpdateCase,
  onUpdateDiagnosis,
  onUpdatePreOp,
  onUpdateActiveCanal,
  onApplySuggestedCaseStatus,
}: {
  caseData: EndoCase;
  activeCanal?: CanalRecord | null;
  onUpdateCase: (updates: Partial<EndoCase>) => void;
  onUpdateDiagnosis: (field: string, value: string) => void;
  onUpdatePreOp: (field: string, value: string | boolean) => void;
  onUpdateActiveCanal: (field: string, value: string) => void;
  onApplySuggestedCaseStatus: () => void;
}) {
  const paReviewed = caseData.preOp?.paReviewed ?? caseData.preOp?.radiographsReviewed ?? false;
  const bwReviewed = caseData.preOp?.bwReviewed ?? false;

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
    </div>
  );
}
