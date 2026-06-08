import React from "react";
import type { CanalContinuationTarget, CanalRecord, DecisionOption, EndoCase, ProtocolNode, ValidationMessage } from "../types";
import { statusLabels, statusStyles } from "../engine/deriveCanalStatus";
import { getMissingRequirements } from "../engine/validateDecision";
import { compactList, isBlank, isPositiveMeasurement } from "../engine/measurements";
import { protocolNodes } from "../protocol/nodes";
import { SelectInput, TextInput } from "./FormControls";

export function getProtocolOptionLabel(nodeId: string, option: DecisionOption, activeCanal?: CanalRecord | null) {
  if (nodeId === "ready-for-obturation" && option.nextNodeId === "gauge-obturation-30") {
    return `Proceed to obturation gauging for ${activeCanal?.name || "active canal"}`;
  }
  return option.label;
}

export function DecisionCard({
  currentNode,
  caseData,
  activeCanal,
  historyLength,
  validationMessage,
  isHandoffNode,
  continuationTargets,
  onUndo,
  onApplyDecision,
  onContinueCanal,
  onCreateNewCanal,
  onUpdateCase,
  onUpdateDiagnosis,
  onUpdatePreOp,
  onUpdateActiveCanal,
}: {
  currentNode: ProtocolNode;
  caseData: EndoCase;
  activeCanal?: CanalRecord | null;
  historyLength: number;
  validationMessage: ValidationMessage | null;
  isHandoffNode: boolean;
  continuationTargets: CanalContinuationTarget[];
  onUndo: () => void;
  onApplyDecision: (option: DecisionOption) => void;
  onContinueCanal: (target: CanalContinuationTarget) => void;
  onCreateNewCanal: () => void;
  onUpdateCase: (updates: Partial<EndoCase>) => void;
  onUpdateDiagnosis: (field: string, value: string) => void;
  onUpdatePreOp: (field: string, value: string | boolean) => void;
  onUpdateActiveCanal: (field: string, value: string) => void;
}) {
  const paReviewed = caseData.preOp?.paReviewed ?? caseData.preOp?.radiographsReviewed ?? false;
  const bwReviewed = caseData.preOp?.bwReviewed ?? false;
  const supportBlockCount = [currentNode.instruments?.length, currentNode.materials?.length, currentNode.requiredInputs?.length].filter(Boolean).length;
  const supportGridClass = supportBlockCount === 1 ? "md:grid-cols-1" : supportBlockCount === 2 ? "md:grid-cols-2" : "md:grid-cols-3";

  return (
    <section className="order-2 min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:col-start-2 lg:row-start-1 xl:col-start-2 xl:row-start-1">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">Decision card</h3>
        <button onClick={onUndo} disabled={!historyLength} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Undo last decision</button>
      </div>
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Phase : {currentNode.phase}</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-950">{currentNode.title}</h2>
      </div>
      <p className="rounded-2xl bg-slate-50 p-4 text-base leading-7 text-slate-800">{currentNode.chairsideInstruction}</p>
      {currentNode.id === "preop" ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="text-sm font-bold text-slate-900">Case setup</h4>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <TextInput label="Patient #" value={caseData.patientNumber} onChange={(value) => onUpdateCase({ patientNumber: value })} placeholder="chart number" />
            <TextInput label="Tooth" value={caseData.tooth} onChange={(value) => onUpdateCase({ tooth: value })} invalid={isBlank(caseData.tooth)} />
            <SelectInput label="Procedure" value={caseData.procedureType} onChange={(value) => onUpdateCase({ procedureType: value })} options={["RCT", "Retreatment", "Emergency pulpectomy"]} />
            <TextInput label="Estimated chamber depth" value={caseData.preOp?.estimatedChamberDepth} onChange={(value) => onUpdatePreOp("estimatedChamberDepth", value)} placeholder="mm" invalid={!isPositiveMeasurement(caseData.preOp?.estimatedChamberDepth)} />
            <TextInput label="Pulpal diagnosis" value={caseData.diagnosis?.pulpal || ""} onChange={(value) => onUpdateDiagnosis("pulpal", value)} placeholder="optional" />
            <TextInput label="Apical diagnosis" value={caseData.diagnosis?.apical || ""} onChange={(value) => onUpdateDiagnosis("apical", value)} placeholder="optional" />
          </div>
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Pre-op radiographs reviewed</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
                <input type="checkbox" checked={paReviewed} onChange={(event) => onUpdatePreOp("paReviewed", event.target.checked)} />
                PA
              </label>
              <label className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
                <input type="checkbox" checked={bwReviewed} onChange={(event) => onUpdatePreOp("bwReviewed", event.target.checked)} />
                BW
              </label>
              <label className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
                <input type="checkbox" checked={Boolean(caseData.preOp?.cbctReviewed)} onChange={(event) => onUpdatePreOp("cbctReviewed", event.target.checked)} />
                CBCT
              </label>
            </div>
          </div>
          <div className="mt-3">
            <TextInput label={`Estimated WL for ${activeCanal?.name || "active canal"}`} value={activeCanal?.estimatedWorkingLength} onChange={(value) => onUpdateActiveCanal("estimatedWorkingLength", value)} placeholder="mm" invalid={!isPositiveMeasurement(activeCanal?.estimatedWorkingLength)} />
          </div>
        </div>
      ) : null}
      {(currentNode.instruments?.length || currentNode.materials?.length || currentNode.requiredInputs?.length) && (
        <div className={`mt-4 grid gap-3 ${supportGridClass}`}>
          {currentNode.instruments?.length ? <div className="rounded-2xl border border-slate-200 p-3"><h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Instruments</h4><p className="mt-2 text-sm text-slate-700">{compactList(currentNode.instruments)}</p></div> : null}
          {currentNode.materials?.length ? <div className="rounded-2xl border border-slate-200 p-3"><h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Materials</h4><p className="mt-2 text-sm text-slate-700">{compactList(currentNode.materials)}</p></div> : null}
          {currentNode.requiredInputs?.length ? <div className="rounded-2xl border border-slate-200 p-3"><h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Record before continuing</h4><p className="mt-2 text-sm text-slate-700">{compactList(currentNode.requiredInputs)}</p></div> : null}
        </div>
      )}
      {currentNode.safetyNotes?.length ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Safety / stop rule</strong>
          <ul className="mt-2 list-inside list-disc space-y-1">{currentNode.safetyNotes.map((note) => <li key={note}>{note}</li>)}</ul>
        </div>
      ) : null}
      {validationMessage ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <strong>Cannot continue with “{validationMessage.optionLabel}” yet.</strong>
          <p className="mt-1">Please record/fix:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">{validationMessage.missing.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      ) : null}
      <div className="mt-5 grid gap-3">
        {currentNode.options.map((option) => {
          const displayLabel = getProtocolOptionLabel(currentNode.id, option, activeCanal);
          const displayOption = { ...option, id: option.id || option.label, label: displayLabel };
          const missing = getMissingRequirements(currentNode.id, displayOption, caseData, activeCanal);
          return (
            <button key={option.label} onClick={() => onApplyDecision(displayOption)} className={`rounded-2xl border bg-white p-4 text-left text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${missing.length ? "border-red-200 text-slate-800 hover:bg-red-50" : "border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50"}`}>
              {displayLabel}
              <span className="mt-1 block text-xs font-normal text-slate-500">Next: {protocolNodes[option.nextNodeId]?.title || option.nextNodeId}</span>
              {missing.length ? <span className="mt-2 block rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-800">Missing: {missing.join(", ")}</span> : null}
            </button>
          );
        })}
      </div>
      {isHandoffNode ? (
        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <h4 className="text-sm font-bold text-blue-950">Work on another canal</h4>
          <div className="mt-3 grid gap-2">
            {continuationTargets.length ? continuationTargets.map((target) => (
              <button
                key={target.canalName}
                type="button"
                disabled={target.disabled}
                onClick={() => onContinueCanal(target)}
                className={`rounded-xl border p-3 text-left text-sm font-semibold transition ${target.disabled ? "cursor-not-allowed border-slate-200 bg-white/70 text-slate-400" : "border-blue-200 bg-white text-blue-950 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-sm"}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span>{target.label}</span>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusStyles[target.status]}`}>{statusLabels[target.status]}</span>
                </span>
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  {target.nextNodeId ? `Next: ${protocolNodes[target.nextNodeId]?.title || target.nextNodeId}` : target.reason || "No continuation action"}
                </span>
              </button>
            )) : (
              <p className="rounded-xl border border-blue-100 bg-white/70 px-3 py-2 text-sm text-blue-900">No other canals are recorded yet.</p>
            )}
          </div>
          <div className="mt-3 border-t border-blue-100 pt-3">
            <button
              type="button"
              onClick={onCreateNewCanal}
              className="w-full rounded-xl border border-dashed border-blue-300 bg-white px-3 py-3 text-sm font-bold text-blue-950 transition hover:bg-blue-100"
            >
              Add new canal
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
