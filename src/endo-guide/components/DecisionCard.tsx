import React from "react";
import type { CanalContinuationTarget, CanalRecord, CaseSetupFocusTarget, DecisionOption, EndoCase, ProtocolNode, ValidationMessage } from "../types";
import { statusLabels, statusStyles } from "../engine/deriveCanalStatus";
import { getMissingRequirements } from "../engine/validateDecision";
import { compactList } from "../engine/measurements";
import { protocolNodes } from "../protocol/nodes";
import { getCaseCapabilitySummary } from "../workflow/selectors";

const sharedReadinessNodeIds = new Set(["preop", "access-chamber", "confirm-chamber"]);

export function getProtocolOptionLabel(nodeId: string, option: DecisionOption, activeCanal?: CanalRecord | null) {
  if (nodeId === "ready-for-obturation" && option.nextNodeId === "gauge-obturation-30") {
    return `Proceed to obturation gauging for ${activeCanal?.name || "active canal"}`;
  }
  return option.label;
}

function getRecentNodeFeedback(currentNode: ProtocolNode, activeCanal?: CanalRecord | null) {
  const lastEvent = [...(activeCanal?.events || [])].reverse()[0];
  if (!lastEvent || lastEvent.details?.nodeId !== currentNode.id) return "";

  if (currentNode.id === "gauge-obturation-larger" && lastEvent.type === "obturationGauge.largerSizeAdvancesBeyond") {
    return "Recorded: the larger NiTi advanced beyond. Try the next larger file, then record the first size that stops at shaping length.";
  }

  if (currentNode.id === "increase-shaping-gauge" && lastEvent.type === "shaping.nextGaugeReachedLength") {
    return "Recorded: the next larger NiTi reached shaping length. Try the next ISO size, then record the largest size that predictably reaches shaping length.";
  }

  return "";
}

function formatMm(value?: string) {
  return value ? `${value} mm` : "not set";
}

function compactStatusLabel(satisfied: boolean, needsReassessment: boolean) {
  if (needsReassessment) return "review";
  return satisfied ? "ready" : "pending";
}

function readinessStatusClass(satisfied: boolean, needsReassessment: boolean) {
  if (needsReassessment) return "border-amber-200 bg-amber-50 text-amber-900";
  if (satisfied) return "border-brand-mint/40 bg-brand-mint/10 text-brand-navy";
  return "border-brand-light-node bg-white text-brand-slate";
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
  onOpenCaseSetupStatus,
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
  onOpenCaseSetupStatus: (focusTarget?: CaseSetupFocusTarget) => void;
}) {
  const supportBlockCount = [currentNode.instruments?.length, currentNode.materials?.length, currentNode.requiredInputs?.length].filter(Boolean).length;
  const supportGridClass = supportBlockCount === 1 ? "md:grid-cols-1" : supportBlockCount === 2 ? "md:grid-cols-2" : "md:grid-cols-3";
  const recentNodeFeedback = getRecentNodeFeedback(currentNode, activeCanal);
  const preOpMissing = currentNode.id === "preop" ? getMissingRequirements(currentNode.id, currentNode.options[0], caseData, activeCanal) : [];
  const capabilitySummary = getCaseCapabilitySummary(caseData);
  const showSharedReadiness = sharedReadinessNodeIds.has(currentNode.id);
  const readinessItems = [
    { label: "Diagnosis", status: capabilitySummary.diagnosis },
    { label: "Radiographs", status: capabilitySummary.radiographs },
    { label: "Anesthesia", status: capabilitySummary.anesthesia },
    { label: "Isolation", status: capabilitySummary.isolation },
  ];
  const radiographLabels = [
    caseData.preOp?.paReviewed ?? caseData.preOp?.radiographsReviewed ? "PA" : null,
    caseData.preOp?.bwReviewed ? "BW" : null,
    caseData.preOp?.cbctReviewed ? "CBCT" : null,
  ].filter(Boolean);

  return (
    <section className="order-2 min-w-0 rounded-3xl border border-brand-light-node bg-white p-5 shadow-sm lg:col-start-2 lg:row-start-1 xl:col-start-2 xl:row-start-1">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-brand-navy">Endodontic decision guide</h3>
        <button onClick={onUndo} disabled={!historyLength} className="rounded-xl border border-brand-light-node px-3 py-2 text-sm font-semibold text-brand-slate transition hover:bg-brand-light-slate disabled:cursor-not-allowed disabled:opacity-40">Undo last decision</button>
      </div>
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-slate">Phase : {currentNode.phase}</p>
        <h2 className="mt-1 text-2xl font-bold text-brand-navy">{currentNode.title}</h2>
      </div>
      <p className="rounded-2xl bg-brand-light-slate p-4 text-base leading-7 text-brand-navy">{currentNode.chairsideInstruction}</p>
      {currentNode.safetyNotes?.length ? (
        <div className="mt-3 border-l-4 border-amber-300 bg-amber-50/70 px-3 py-2 text-sm leading-6 text-amber-950">
          <strong className="font-semibold">Safety / stop rule:</strong>{" "}
          <span>{currentNode.safetyNotes.join(" ")}</span>
        </div>
      ) : null}
      {showSharedReadiness ? (
        <div className="mt-4 rounded-2xl border border-brand-light-node bg-brand-light-slate p-4">
          <div className="grid gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <h4 className="text-sm font-bold text-brand-navy">Pre-access readiness</h4>
              <div className="lg:w-auto">
                <button
                  type="button"
                  onClick={() => onOpenCaseSetupStatus()}
                  className="rounded-xl border border-brand-navy bg-brand-navy px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-navy-deep"
                >
                  Open Case Setup
                </button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-4">
              {readinessItems.map(({ label, status }) => (
                <div key={label} className={`min-w-0 rounded-xl border px-3 py-2 ${readinessStatusClass(status.satisfied, status.needsReassessment)}`}>
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="text-xs font-bold">{label}</span>
                    <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold">
                      {compactStatusLabel(status.satisfied, status.needsReassessment)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 opacity-80">{status.summary}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {recentNodeFeedback ? (
        <div className="mt-4 rounded-2xl border border-brand-blue-light bg-brand-blue-light/20 p-4 text-sm font-semibold text-brand-navy">
          {recentNodeFeedback}
        </div>
      ) : null}
      {currentNode.id === "preop" ? (
        <div className="mt-4 rounded-2xl border border-brand-light-node bg-brand-light-slate p-4">
          <div className="rounded-xl border border-brand-light-node bg-white p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h4 className="text-sm font-bold text-brand-navy">Case setup summary</h4>
                <p className="mt-1 text-sm leading-6 text-brand-slate">
                  Tooth <strong>{caseData.tooth || "not set"}</strong> · {caseData.procedureType || "Procedure not set"} · Active canal <strong>{activeCanal?.name || "not set"}</strong>
                </p>
                <p className="mt-1 text-xs leading-5 text-brand-slate">
                  Chamber depth: {formatMm(caseData.preOp?.estimatedChamberDepth)} · Estimated WL: {formatMm(activeCanal?.estimatedWorkingLength)} · Radiographs: {radiographLabels.length ? radiographLabels.join(", ") : "not recorded"}
                </p>
                <p className="mt-1 text-xs leading-5 text-brand-slate">
                  Shared status: diagnosis {compactStatusLabel(capabilitySummary.diagnosis.satisfied, capabilitySummary.diagnosis.needsReassessment)} · radiographs {compactStatusLabel(capabilitySummary.radiographs.satisfied, capabilitySummary.radiographs.needsReassessment)} · anesthesia {compactStatusLabel(capabilitySummary.anesthesia.satisfied, capabilitySummary.anesthesia.needsReassessment)} · isolation {compactStatusLabel(capabilitySummary.isolation.satisfied, capabilitySummary.isolation.needsReassessment)}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${preOpMissing.length ? "border-red-200 bg-red-50 text-red-800" : "border-brand-mint/40 bg-brand-mint/10 text-brand-navy"}`}>
                  {preOpMissing.length ? `${preOpMissing.length} setup item${preOpMissing.length === 1 ? "" : "s"} missing` : "Setup ready"}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenCaseSetupStatus()}
                  className="rounded-xl border border-brand-navy bg-brand-navy px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-navy-deep"
                >
                  Open Case Setup
                </button>
              </div>
            </div>
            {preOpMissing.length ? (
              <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-red-800">
                {preOpMissing.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
      {(currentNode.instruments?.length || currentNode.materials?.length || currentNode.requiredInputs?.length) && (
        <div className={`mt-4 grid gap-3 ${supportGridClass}`}>
          {currentNode.instruments?.length ? <div className="rounded-2xl border border-brand-light-node p-3"><h4 className="text-xs font-bold uppercase tracking-wide text-brand-slate">Instruments</h4><p className="mt-2 text-sm text-brand-slate">{compactList(currentNode.instruments)}</p></div> : null}
          {currentNode.materials?.length ? <div className="rounded-2xl border border-brand-light-node p-3"><h4 className="text-xs font-bold uppercase tracking-wide text-brand-slate">Materials</h4><p className="mt-2 text-sm text-brand-slate">{compactList(currentNode.materials)}</p></div> : null}
          {currentNode.requiredInputs?.length ? <div className="rounded-2xl border border-brand-light-node p-3"><h4 className="text-xs font-bold uppercase tracking-wide text-brand-slate">Record before continuing</h4><p className="mt-2 text-sm text-brand-slate">{compactList(currentNode.requiredInputs)}</p></div> : null}
        </div>
      )}
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
            <button key={option.label} onClick={() => onApplyDecision(displayOption)} className={`rounded-2xl border bg-white p-4 text-left text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${missing.length ? "border-red-200 text-brand-navy hover:bg-red-50" : "border-brand-light-node text-brand-navy hover:border-brand-mint/50 hover:bg-brand-light-slate"}`}>
              {displayLabel}
              <span className="mt-1 block text-xs font-normal text-brand-slate">Next: {protocolNodes[option.nextNodeId]?.title || option.nextNodeId}</span>
              {missing.length ? <span className="mt-2 block rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-800">Missing: {missing.join(", ")}</span> : null}
            </button>
          );
        })}
      </div>
      {isHandoffNode ? (
        <div className="mt-5 rounded-2xl border border-brand-blue-light/60 bg-brand-blue-light/20 p-4">
          <h4 className="text-sm font-bold text-brand-navy">Work on another canal</h4>
          <div className="mt-3 grid gap-2">
            {continuationTargets.length ? continuationTargets.map((target) => (
              <button
                key={target.canalName}
                type="button"
                disabled={target.disabled}
                onClick={() => onContinueCanal(target)}
                className={`rounded-xl border p-3 text-left text-sm font-semibold transition ${target.disabled ? "cursor-not-allowed border-brand-light-node bg-white/70 text-brand-slate/60" : "border-brand-blue-light/70 bg-white text-brand-navy hover:-translate-y-0.5 hover:border-brand-blue hover:shadow-sm"}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span>{target.label}</span>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusStyles[target.status]}`}>{statusLabels[target.status]}</span>
                </span>
                <span className="mt-1 block text-xs font-normal text-brand-slate">
                  {target.nextNodeId ? `Next: ${protocolNodes[target.nextNodeId]?.title || target.nextNodeId}` : target.reason || "No continuation action"}
                </span>
              </button>
            )) : (
              <p className="rounded-xl border border-brand-blue-light/60 bg-white/70 px-3 py-2 text-sm text-brand-navy">No other canals are recorded yet.</p>
            )}
          </div>
          <div className="mt-3 border-t border-brand-blue-light/60 pt-3">
            <button
              type="button"
              onClick={onCreateNewCanal}
              className="w-full rounded-xl border border-dashed border-brand-blue bg-white px-3 py-3 text-sm font-bold text-brand-navy transition hover:bg-brand-blue-light/30"
            >
              Add new canal
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
