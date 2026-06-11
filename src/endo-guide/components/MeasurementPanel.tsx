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
  onUpdatePreOp: (field: string, value: string | boolean) => void;
  onUpdateActiveCanal: (field: string, value: string) => void;
  onApplyEalDerivedLengths: () => void;
  className?: string;
}) {
  const suggestedLengths = getSuggestedLengths(activeCanal);
  const pairedFieldGridClass = "grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]";

  if (currentNodeId === "preop") {
    return (
      <aside className={`order-3 min-w-0 space-y-4 lg:col-span-2 lg:col-start-1 lg:row-start-2 xl:col-span-1 xl:col-start-3 xl:row-start-1 ${className}`}>
        <SectionCard title="Measurements">
          <div className="rounded-2xl border border-brand-light-node bg-brand-light-slate p-4 text-sm leading-6 text-brand-slate">
            Enter tooth, pre-op radiographs, chamber depth, and estimated WL in the case setup section before beginning access.
          </div>
        </SectionCard>
      </aside>
    );
  }

  return (
    <aside className={`order-3 min-w-0 space-y-4 lg:col-span-2 lg:col-start-1 lg:row-start-2 xl:col-span-1 xl:col-start-3 xl:row-start-1 ${className}`}>
      <SectionCard title="Measurements">
        <div className="grid gap-3">
          <div className="rounded-2xl border border-brand-light-node bg-brand-light-slate p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-slate">Case-level measurement</p>
            <TextInput
              label="Chamber depth"
              value={caseData.preOp.estimatedChamberDepth}
              onChange={(value) => onUpdatePreOp("estimatedChamberDepth", value)}
              placeholder="mm"
              invalid={currentNodeId === "access-chamber" && !isPositiveMeasurement(caseData.preOp.estimatedChamberDepth)}
            />
            <p className="mt-2 text-xs text-brand-slate">Used for access planning and pre-op/access validation.</p>
          </div>
          <div className={pairedFieldGridClass}>
            <TextInput label="Estimated WL" value={activeCanal?.estimatedWorkingLength} onChange={(value) => onUpdateActiveCanal("estimatedWorkingLength", value)} placeholder="mm" invalid={["estimate-wl", "advance-10c"].includes(currentNodeId) && !isPositiveMeasurement(activeCanal?.estimatedWorkingLength)} />
            <TextInput label="Reference point" value={activeCanal?.referencePoint} onChange={(value) => onUpdateActiveCanal("referencePoint", value)} placeholder="e.g., MB cusp" invalid={["measure-available-space", "establish-eal0"].includes(currentNodeId) && isBlank(activeCanal?.referencePoint)} />
          </div>
          <div className={pairedFieldGridClass}>
            <TextInput label="10C terminal length" value={activeCanal?.fileTerminalLength} onChange={(value) => onUpdateActiveCanal("fileTerminalLength", value)} placeholder="if stopped short" />
            <TextInput label="Available treatment space" value={activeCanal?.availableTreatmentSpace} onChange={(value) => onUpdateActiveCanal("availableTreatmentSpace", value)} placeholder="mm" invalid={currentNodeId === "measure-available-space" && !isPositiveMeasurement(activeCanal?.availableTreatmentSpace)} />
          </div>
          <div className={pairedFieldGridClass}>
            <TextInput label="EAL 0" value={activeCanal?.eal0} onChange={(value) => onUpdateActiveCanal("eal0", value)} placeholder="mm" />
            <SelectInput label="WL PA" value={activeCanal?.wlRadiographStatus || ""} onChange={(value) => onUpdateActiveCanal("wlRadiographStatus", value)} options={["", "acceptable", "short", "long", "not taken"]} />
          </div>
          <div className={pairedFieldGridClass}>
            <TextInput label="Patency" value={activeCanal?.patencyLength} onChange={(value) => onUpdateActiveCanal("patencyLength", value)} placeholder="mm" />
            <TextInput label="Shaping" value={activeCanal?.shapingLength} onChange={(value) => onUpdateActiveCanal("shapingLength", value)} placeholder="mm" />
          </div>
          <div className="rounded-xl bg-brand-blue-light/20 px-3 py-2 text-xs text-brand-navy">
            {suggestedLengths.patency && suggestedLengths.shaping ? <span>Suggested from EAL 0: patency <strong>{suggestedLengths.patency}</strong> mm, shaping <strong>{suggestedLengths.shaping}</strong> mm.</span> : <span>Enter EAL 0 to preview suggested patency/shaping lengths.</span>}
          </div>
          <button onClick={onApplyEalDerivedLengths} className="rounded-xl border border-brand-blue-light bg-brand-blue-light/20 px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-blue-light/30">Use EAL ±1 {suggestedLengths.patency && suggestedLengths.shaping ? `(patency ${suggestedLengths.patency}, shaping ${suggestedLengths.shaping})` : ""}</button>
          <div className={pairedFieldGridClass}>
            <TextInput label="Final shaping file" value={activeCanal?.finalShape} onChange={(value) => onUpdateActiveCanal("finalShape", value)} placeholder="e.g., 30/.04 or PTN X2 25/.06" />
            <TextInput label="Master cone" value={activeCanal?.masterCone} onChange={(value) => onUpdateActiveCanal("masterCone", value)} placeholder="30/.04" />
          </div>
          <div className={pairedFieldGridClass}>
            <TextInput label="Obturation gauge" value={activeCanal?.obturationGauge} onChange={(value) => onUpdateActiveCanal("obturationGauge", value)} placeholder="30" />
            <SelectInput label="Cone fit PA" value={activeCanal?.coneFitRadiograph || ""} onChange={(value) => onUpdateActiveCanal("coneFitRadiograph", value)} options={["", "acceptable", "short", "long", "not taken"]} />
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-brand-slate">Drying status</span>
            <select value={activeCanal?.dryingStatus || ""} onChange={(event) => onUpdateActiveCanal("dryingStatus", event.target.value)} className="w-full rounded-xl border border-brand-light-node bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-mint focus:ring-2 focus:ring-brand-mint/20">
              <option value="">Select drying status</option>
              <option value="dry">dry</option>
              <option value="slightly damp">slightly damp</option>
              <option value="wet">wet</option>
              <option value="persistent wet">persistent wet</option>
            </select>
            <span className="mt-1 block text-xs text-brand-slate">Current recorded status: {activeCanal?.dryingStatus || "not recorded"}</span>
          </label>
        </div>
      </SectionCard>
    </aside>
  );
}
