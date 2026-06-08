import React, { useState } from "react";
import type { EndoCase, PriorCanalStatus } from "../types";
import { priorCanalStatusLabels } from "../engine/resume";
import { blankCanal, caseStatusOptions, makeDefaultNewCanalName } from "../state/persistence";
import { getCaseStatus } from "../engine/deriveCaseStatus";
import { isBlank } from "../engine/measurements";
import { SelectInput, TextInput } from "./FormControls";

type SavedCaseSummary = {
  id: string;
  patientNumber: string;
  tooth: string;
  procedureType: string;
  canalCount?: number;
  eventCount?: number;
  autosavedAt: string;
};

export function CaseManagementModal({
  caseData,
  savedCases,
  importText,
  showImportBox,
  onClose,
  onUpdateCase,
  onUpdateDiagnosis,
  onApplySuggestedCaseStatus,
  onStartNewCase,
  onDownloadCaseJson,
  onToggleImportBox,
  onImportTextChange,
  onImportCaseJson,
  onClearSavedCurrentCase,
  onResetAllSavedCases,
  onLoadSavedCase,
  onDeleteSavedCase,
  onContinueFromPriorVisit,
  onResumeActiveCanalFromPriorVisit,
  canResumeActiveCanalFromPriorVisit,
}: {
  caseData: EndoCase;
  savedCases: SavedCaseSummary[];
  importText: string;
  showImportBox: boolean;
  onClose: () => void;
  onUpdateCase: (updates: Partial<EndoCase>) => void;
  onUpdateDiagnosis: (field: string, value: string) => void;
  onApplySuggestedCaseStatus: () => void;
  onStartNewCase: () => void;
  onDownloadCaseJson: () => void;
  onToggleImportBox: () => void;
  onImportTextChange: (value: string) => void;
  onImportCaseJson: () => void;
  onClearSavedCurrentCase: () => void;
  onResetAllSavedCases: () => void;
  onLoadSavedCase: (caseId: string) => void;
  onDeleteSavedCase: (caseId: string) => void;
  onContinueFromPriorVisit: () => void;
  onResumeActiveCanalFromPriorVisit: () => void;
  canResumeActiveCanalFromPriorVisit: boolean;
}) {
  const [isPriorVisitSetupOpen, setIsPriorVisitSetupOpen] = useState(false);
  const [newPriorCanalName, setNewPriorCanalName] = useState("");
  const priorCanalStatusOptions = Object.entries(priorCanalStatusLabels) as [PriorCanalStatus, string][];
  const updatePriorVisit = (updates: Partial<NonNullable<EndoCase["priorVisit"]>>) => onUpdateCase({ priorVisit: { ...(caseData.priorVisit || {}), ...updates } });
  const updateCanal = (canalName: string, updates: Partial<EndoCase["canals"][number]>) => {
    onUpdateCase({ canals: caseData.canals.map((canal) => canal.name === canalName ? { ...canal, ...updates } : canal) });
  };
  const priorCanalCount = caseData.canals.filter((canal) => canal.priorVisitStatus || canal.priorVisitNote).length;
  const priorSummaryParts = [
    caseData.priorVisit?.continuedFromPriorVisit ? "Marked continued" : null,
    caseData.priorVisit?.accessPreviouslyOpened ? "access opened" : null,
    caseData.priorVisit?.temporaryRestorationPresent ? "temporary present" : null,
    caseData.priorVisit?.medicationPresent ? `medication ${caseData.priorVisit.medicationPresent}` : null,
    priorCanalCount ? `${priorCanalCount} canal(s) staged` : null,
  ].filter(Boolean);

  function addPriorCanal() {
    const typedName = newPriorCanalName.trim();
    const canalName = typedName ? typedName.toUpperCase() : makeDefaultNewCanalName(caseData.canals).toUpperCase();
    if (caseData.canals.some((canal) => canal.name === canalName)) {
      setNewPriorCanalName("");
      return;
    }
    onUpdateCase({
      currentCanal: caseData.currentCanal || canalName,
      priorVisit: { ...(caseData.priorVisit || {}), continuedFromPriorVisit: true },
      canals: [...caseData.canals, blankCanal(canalName)],
    });
    setNewPriorCanalName("");
  }

  function renameCanal(oldName: string, nextValue: string) {
    const nextName = nextValue.trim().toUpperCase();
    if (!nextName || nextName === oldName || caseData.canals.some((canal) => canal.name === nextName)) return;
    onUpdateCase({
      currentCanal: caseData.currentCanal === oldName ? nextName : caseData.currentCanal,
      canals: caseData.canals.map((canal) =>
        canal.name === oldName
          ? { ...canal, name: nextName, events: (canal.events || []).map((event) => ({ ...event, canal: nextName })) }
          : canal
      ),
      globalEvents: caseData.globalEvents.map((event) => event.canal === oldName ? { ...event, canal: nextName } : event),
    });
  }

  function deleteCanal(canalName: string) {
    if (caseData.canals.length <= 1) return;
    const remainingCanals = caseData.canals.filter((canal) => canal.name !== canalName);
    onUpdateCase({
      currentCanal: caseData.currentCanal === canalName ? remainingCanals[0]?.name || "" : caseData.currentCanal,
      canals: remainingCanals,
      globalEvents: caseData.globalEvents.filter((event) => event.canal !== canalName),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-slate-950/30 p-4">
      <section className="mt-6 w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Case management</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">Patient / visit / saved cases</h2>
            <p className="mt-1 text-sm text-slate-600">Edit case identity, diagnosis, visit status, next-visit plan, and saved-case JSON actions.</p>
          </div>
          <button onClick={onClose} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            Close
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Patient / visit</h3>
            <div className="grid gap-3">
              <TextInput label="Patient #" value={caseData.patientNumber} onChange={(value) => onUpdateCase({ patientNumber: value })} placeholder="chart number" />
              <TextInput label="Tooth" value={caseData.tooth} onChange={(value) => onUpdateCase({ tooth: value })} invalid={isBlank(caseData.tooth)} />
              <SelectInput label="Procedure" value={caseData.procedureType} onChange={(value) => onUpdateCase({ procedureType: value })} options={["RCT", "Retreatment", "Emergency pulpectomy"]} />
              <SelectInput label="Visit status" value={getCaseStatus(caseData)} onChange={(value) => onUpdateCase({ caseStatus: value })} options={caseStatusOptions} />
              <button onClick={onApplySuggestedCaseStatus} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">Use suggested status</button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Diagnosis / plan</h3>
            <div className="grid gap-3">
              <TextInput label="Pulpal diagnosis" value={caseData.diagnosis?.pulpal || ""} onChange={(value) => onUpdateDiagnosis("pulpal", value)} placeholder="optional" />
              <TextInput label="Apical diagnosis" value={caseData.diagnosis?.apical || ""} onChange={(value) => onUpdateDiagnosis("apical", value)} placeholder="optional" />
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Next visit / plan</span>
                <textarea value={caseData.nextVisitPlan || ""} onChange={(event) => onUpdateCase({ nextVisitPlan: event.target.value })} placeholder="e.g., continue obturation, crown recommended, refer" className="h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />
              </label>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-amber-950">Prior visit / fast-forward</h3>
              <p className="mt-1 text-sm text-amber-900">{priorSummaryParts.length ? priorSummaryParts.join(" · ") : "No prior visit history staged."}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setIsPriorVisitSetupOpen(true)} className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100">Open prior visit setup</button>
              <button
                onClick={onResumeActiveCanalFromPriorVisit}
                disabled={!canResumeActiveCanalFromPriorVisit}
                title={canResumeActiveCanalFromPriorVisit ? "Resume the active canal from prior-visit setup" : "Set up prior visit history or prior status for the active canal first"}
                className="rounded-xl border border-amber-400 bg-amber-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                Resume active canal
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Saved cases / JSON</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <button onClick={onStartNewCase} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">New case</button>
            <button onClick={onDownloadCaseJson} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-100">Download case JSON</button>
            <button onClick={onToggleImportBox} className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-50">Import case JSON</button>
            <div className="flex gap-2">
              <button onClick={onClearSavedCurrentCase} className="flex-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-100">Clear current</button>
              <button onClick={onResetAllSavedCases} className="flex-1 rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-50">Reset all</button>
            </div>
          </div>
          {showImportBox ? (
            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-2">
              <textarea value={importText} onChange={(event) => onImportTextChange(event.target.value)} placeholder="Paste exported case JSON here" className="h-28 w-full rounded-lg border border-blue-100 bg-white p-2 font-mono text-xs outline-none focus:border-blue-300" />
              <button onClick={onImportCaseJson} className="mt-2 rounded-lg bg-blue-900 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800">Load pasted JSON</button>
            </div>
          ) : null}

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent autosaves</p>
            <div className="grid gap-2 md:grid-cols-2">
              {savedCases.length ? savedCases.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-2">
                  <button onClick={() => onLoadSavedCase(item.id)} className="w-full rounded-lg p-1 text-left text-xs text-slate-700 hover:bg-slate-100">
                    <strong>{item.patientNumber}</strong> · tooth {item.tooth} · {item.procedureType}
                    <span className="mt-1 block text-slate-500">{new Date(item.autosavedAt).toLocaleString()} · {item.canalCount || 0} canal(s) · {item.eventCount || 0} event(s)</span>
                  </button>
                  <button onClick={() => onDeleteSavedCase(item.id)} className="mt-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50">Delete saved case</button>
                </div>
              )) : <p className="text-sm text-slate-500">No autosaves yet.</p>}
            </div>
          </div>
        </div>

        {isPriorVisitSetupOpen ? (
          <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-auto bg-slate-950/30 p-4">
            <section className="mt-10 w-full max-w-4xl rounded-3xl border border-amber-200 bg-white p-5 shadow-2xl">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Prior visit setup</p>
                  <h3 className="mt-1 text-xl font-bold text-slate-950">Fast-forward from previous treatment</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={onContinueFromPriorVisit} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100">Mark as continued from a prior visit</button>
                  <button onClick={() => setIsPriorVisitSetupOpen(false)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100">Close</button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <TextInput label="Prior visit date / timing" value={caseData.priorVisit?.priorVisitDate || ""} onChange={(value) => updatePriorVisit({ priorVisitDate: value })} placeholder="optional" />
                <SelectInput label="Medication present" value={caseData.priorVisit?.medicationPresent || ""} onChange={(value) => updatePriorVisit({ medicationPresent: value as NonNullable<EndoCase["priorVisit"]>["medicationPresent"] })} options={["", "yes", "no", "unknown"]} />
                <label className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
                  <input type="checkbox" checked={Boolean(caseData.priorVisit?.accessPreviouslyOpened)} onChange={(event) => updatePriorVisit({ accessPreviouslyOpened: event.target.checked, continuedFromPriorVisit: true })} />
                  Access previously opened
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
                  <input type="checkbox" checked={Boolean(caseData.priorVisit?.temporaryRestorationPresent)} onChange={(event) => updatePriorVisit({ temporaryRestorationPresent: event.target.checked, continuedFromPriorVisit: true })} />
                  Temporary restoration present
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
                  <input type="checkbox" checked={Boolean(caseData.priorVisit?.priorRadiographsAvailable)} onChange={(event) => updatePriorVisit({ priorRadiographsAvailable: event.target.checked, continuedFromPriorVisit: true })} />
                  Prior radiographs / notes available
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Prior history note / source</span>
                  <textarea value={caseData.priorVisit?.sourceNote || ""} onChange={(event) => updatePriorVisit({ sourceNote: event.target.value, continuedFromPriorVisit: true })} placeholder="e.g., prior access, CaOH placed, temp restoration, outside notes reviewed" className="h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />
                </label>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Prior canals</h4>
                    <p className="mt-1 text-sm text-slate-600">Use the real canal names from the previous visit, then stage each canal independently.</p>
                  </div>
                  <div className="flex gap-2">
                    <input value={newPriorCanalName} onChange={(event) => setNewPriorCanalName(event.target.value)} placeholder="MB, ML, DB..." className="min-h-9 w-36 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />
                    <button onClick={addPriorCanal} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100">Add canal</button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2">
                  {caseData.canals.map((canal) => (
                    <div key={canal.name} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[120px_minmax(160px,220px)_minmax(0,1fr)_auto] md:items-end">
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-slate-600">Canal name</span>
                        <input defaultValue={canal.name} onBlur={(event) => renameCanal(canal.name, event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-slate-600">Prior canal status</span>
                        <select value={canal.priorVisitStatus || ""} onChange={(event) => updateCanal(canal.name, { priorVisitStatus: event.target.value as PriorCanalStatus })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100">
                          {priorCanalStatusOptions.map(([value, label]) => <option key={value || "not-set"} value={value}>{label}</option>)}
                        </select>
                      </label>
                      <TextInput label="Prior canal note" value={canal.priorVisitNote || ""} onChange={(value) => updateCanal(canal.name, { priorVisitNote: value })} placeholder="optional" />
                      <button
                        type="button"
                        onClick={() => deleteCanal(canal.name)}
                        disabled={caseData.canals.length <= 1}
                        className="min-h-10 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-800 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}
