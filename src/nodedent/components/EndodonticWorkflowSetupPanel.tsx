import React from "react";
import type { CanalRecord, EndoCase } from "../types";
import { getCanalStatus, statusLabels, statusStyles } from "../engine/deriveCanalStatus";
import { formatCanalMeasurements, isPositiveMeasurement } from "../engine/measurements";
import { TextInput } from "./FormControls";

export function EndodonticWorkflowSetupPanel({
  caseData,
  activeCanal,
  onUpdatePreOp,
  onUpdateActiveCanal,
}: {
  caseData: EndoCase;
  activeCanal?: CanalRecord | null;
  onUpdatePreOp: (field: string, value: string | boolean) => void;
  onUpdateActiveCanal: (field: string, value: string) => void;
}) {
  const activeStatus = getCanalStatus(activeCanal);
  const activeCanalName = activeCanal?.name || caseData.currentCanal || "active canal";
  const activeCanalSummary = activeCanal ? formatCanalMeasurements(activeCanal) : "";

  return (
    <section className="rounded-2xl border border-brand-light-node bg-brand-light-slate p-4 lg:col-span-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-brand-navy">Endodontic workflow setup</h3>
          <p className="mt-1 text-xs leading-5 text-brand-slate">
            Active-canal setup for the endodontic workflow. Operative workflow setup should use its own target fields.
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[activeStatus]}`}>
          {activeCanalName}: {statusLabels[activeStatus]}
        </span>
      </div>
      {activeCanalSummary ? (
        <p className="mt-3 rounded-xl border border-brand-light-node bg-white px-3 py-2 text-xs leading-5 text-brand-slate">
          {activeCanalSummary}
        </p>
      ) : null}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <TextInput
          label="Estimated chamber depth"
          value={caseData.preOp?.estimatedChamberDepth}
          onChange={(value) => onUpdatePreOp("estimatedChamberDepth", value)}
          placeholder="mm"
          inputMode="decimal"
          invalid={!isPositiveMeasurement(caseData.preOp?.estimatedChamberDepth)}
        />
        <TextInput
          label={`Estimated WL for ${activeCanalName}`}
          value={activeCanal?.estimatedWorkingLength}
          onChange={(value) => onUpdateActiveCanal("estimatedWorkingLength", value)}
          placeholder="mm"
          inputMode="decimal"
          invalid={!isPositiveMeasurement(activeCanal?.estimatedWorkingLength)}
          helperText="This field is for the active canal. Add or rename canals in the endodontic target panel before working on additional canals."
        />
      </div>
    </section>
  );
}
