import React from "react";
import type { CanalRecord, EndoCase } from "../types";
import { getSuggestedLengths, isBlank, isPositiveMeasurement } from "../engine/measurements";
import { SectionCard, SelectInput, TextInput } from "./FormControls";

export function MeasurementPanel({
  caseData,
  activeCanal,
  currentNodeId,
  onUpdatePreOp,
  onUpdateActiveCanal,
  onApplyEalDerivedLengths,
  className = "",
}: {
  caseData: EndoCase;
  activeCanal?: CanalRecord | null;
  currentNodeId: string;
  onUpdatePreOp: (field: string, value: string) => void;
  onUpdateActiveCanal: (field: string, value: string) => void;
  onApplyEalDerivedLengths: () => void;
  className?: string;
}) {
  const suggestedLengths = getSuggestedLengths(activeCanal);

  return (
    <aside className={`order-4 min-w-0 space-y-4 xl:col-start-2 xl:row-start-2 2xl:col-auto 2xl:row-auto 2xl:order-none ${className}`}>
      <SectionCard title="Measurements">
        <div className="grid gap-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Case-level measurement</p>
            <TextInput
              label="Chamber depth"
              value={caseData.preOp.estimatedChamberDepth}
              onChange={(value) => onUpdatePreOp("estimatedChamberDepth", value)}
              placeholder="mm"
              invalid={["preop", "access-chamber"].includes(currentNodeId) && !isPositiveMeasurement(caseData.preOp.estimatedChamberDepth)}
            />
            <p className="mt-2 text-xs text-slate-500">Used for access planning and pre-op/access validation.</p>
          </div>
          <TextInput label="Estimated WL" value={activeCanal?.estimatedWorkingLength} onChange={(value) => onUpdateActiveCanal("estimatedWorkingLength", value)} placeholder="mm" invalid={["preop", "estimate-wl", "advance-10c"].includes(currentNodeId) && !isPositiveMeasurement(activeCanal?.estimatedWorkingLength)} />
          <TextInput label="10C terminal length" value={activeCanal?.fileTerminalLength} onChange={(value) => onUpdateActiveCanal("fileTerminalLength", value)} placeholder="if stopped short" />
          <TextInput label="Available treatment space" value={activeCanal?.availableTreatmentSpace} onChange={(value) => onUpdateActiveCanal("availableTreatmentSpace", value)} placeholder="mm" invalid={currentNodeId === "measure-available-space" && !isPositiveMeasurement(activeCanal?.availableTreatmentSpace)} />
          <TextInput label="Reference point" value={activeCanal?.referencePoint} onChange={(value) => onUpdateActiveCanal("referencePoint", value)} placeholder="e.g., MB cusp" invalid={["measure-available-space", "establish-eal0"].includes(currentNodeId) && isBlank(activeCanal?.referencePoint)} />
          <div className="grid grid-cols-2 gap-2">
            <TextInput label="EAL 0" value={activeCanal?.eal0} onChange={(value) => onUpdateActiveCanal("eal0", value)} placeholder="mm" />
            <SelectInput label="WL PA" value={activeCanal?.wlRadiographStatus || ""} onChange={(value) => onUpdateActiveCanal("wlRadiographStatus", value)} options={["", "acceptable", "short", "long", "not taken"]} />
            <TextInput label="Patency" value={activeCanal?.patencyLength} onChange={(value) => onUpdateActiveCanal("patencyLength", value)} placeholder="mm" />
            <TextInput label="Shaping" value={activeCanal?.shapingLength} onChange={(value) => onUpdateActiveCanal("shapingLength", value)} placeholder="mm" />
          </div>
          <div className="rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-900">
            {suggestedLengths.patency && suggestedLengths.shaping ? <span>Suggested from EAL 0: patency <strong>{suggestedLengths.patency}</strong> mm, shaping <strong>{suggestedLengths.shaping}</strong> mm.</span> : <span>Enter EAL 0 to preview suggested patency/shaping lengths.</span>}
          </div>
          <button onClick={onApplyEalDerivedLengths} className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-100">Use EAL ±1 {suggestedLengths.patency && suggestedLengths.shaping ? `(patency ${suggestedLengths.patency}, shaping ${suggestedLengths.shaping})` : ""}</button>
          <div className="grid grid-cols-2 gap-2">
            <TextInput label="Final shape" value={activeCanal?.finalShape} onChange={(value) => onUpdateActiveCanal("finalShape", value)} placeholder="30/.04" />
            <TextInput label="Master cone" value={activeCanal?.masterCone} onChange={(value) => onUpdateActiveCanal("masterCone", value)} placeholder="30/.04" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <TextInput label="Obturation gauge" value={activeCanal?.obturationGauge} onChange={(value) => onUpdateActiveCanal("obturationGauge", value)} placeholder="30" />
            <SelectInput label="Cone fit PA" value={activeCanal?.coneFitRadiograph || ""} onChange={(value) => onUpdateActiveCanal("coneFitRadiograph", value)} options={["", "acceptable", "short", "long", "not taken"]} />
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Drying status</span>
            <select value={activeCanal?.dryingStatus || ""} onChange={(event) => onUpdateActiveCanal("dryingStatus", event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100">
              <option value="">Select drying status</option>
              <option value="dry">dry</option>
              <option value="slightly damp">slightly damp</option>
              <option value="wet">wet</option>
              <option value="persistent wet">persistent wet</option>
            </select>
            <span className="mt-1 block text-xs text-slate-500">Current recorded status: {activeCanal?.dryingStatus || "not recorded"}</span>
          </label>
        </div>
      </SectionCard>
    </aside>
  );
}
