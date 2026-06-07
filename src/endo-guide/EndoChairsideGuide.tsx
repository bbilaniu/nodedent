import React, { useEffect, useMemo, useState } from "react";
import type { CanalContinuationTarget, ClinicalEvent, DecisionOption, DifficultyFlag, EndoCase, ValidationMessage } from "./types";
import { DecisionCard } from "./components/DecisionCard";
import { CanalControls } from "./components/CanalControls";
import { CanalSelector } from "./components/CanalSelector";
import { CaseManagementModal } from "./components/CaseManagementModal";
import { DifficultyBanner } from "./components/DifficultyBanner";
import { EventLog } from "./components/EventLog";
import { MeasurementPanel } from "./components/MeasurementPanel";
import { NotePreview } from "./components/NotePreview";
import { PhaseCanalMapModal } from "./components/PhaseCanalMapModal";
import { applyDecision as applyDecisionEngine } from "./engine/applyDecision";
import { getCaseStatus, hydrateCaseStatusOverride } from "./engine/deriveCaseStatus";
import { getCanalStatus, isManualCanalStatusEvent } from "./engine/deriveCanalStatus";
import { makeRuntimeEvent } from "./engine/events";
import { getCanalCheckpointNodeId, getSavedCurrentNodeId, inferCurrentNodeIdFromEvents } from "./engine/getCurrentNode";
import { getSuggestedLengths } from "./engine/measurements";
import { buildCompactNote } from "./notes/buildCompactNote";
import { buildEventLogExport, buildJsonExport, buildPrintableSummary } from "./notes/buildJsonExport";
import { buildFullNote } from "./notes/buildFullNote";
import { buildPatientSummary } from "./notes/buildPatientSummary";
import { getCanalContinuationTargets, getNextRecommendedNodeForCanal } from "./protocol/continuation";
import { handoffNodeIds, protocolNodes } from "./protocol/nodes";
import { blankCanal, CASE_INDEX_KEY, CASE_RECORD_PREFIX, hydrateCanalEventsFromGlobalEvents, initialCase, makeCaseId, makeDefaultNewCanalName, STORAGE_KEY } from "./state/persistence";

type HistoryEntry = {
  caseData: EndoCase;
  currentNodeId: string;
};

type SavedCaseSummary = {
  id: string;
  patientNumber: string;
  tooth: string;
  procedureType: string;
  currentNodeId?: string;
  canalCount?: number;
  eventCount?: number;
  autosavedAt: string;
};

function getSavedCaseIndex(): SavedCaseSummary[] {
  try {
    return JSON.parse(window.localStorage.getItem(CASE_INDEX_KEY) || "[]");
  } catch {
    return [];
  }
}

function createRuntimeEventArgs() {
  const now = Date.now();
  return {
    eventId: `evt_${now}_${Math.random().toString(16).slice(2)}`,
    timestamp: new Date(now).toISOString(),
  };
}

export default function EndoChairsideGuide() {
  const [caseData, setCaseData] = useState<EndoCase>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved ? { ...initialCase, ...JSON.parse(saved) } : initialCase;
    } catch {
      return initialCase;
    }
  });
  const [currentNodeId, setCurrentNodeId] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved ? getSavedCurrentNodeId(JSON.parse(saved)) : "preop";
    } catch {
      return "preop";
    }
  });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [newCanalName, setNewCanalName] = useState("");
  const [renameCanalName, setRenameCanalName] = useState("");
  const [noteMode, setNoteMode] = useState("compact");
  const [copied, setCopied] = useState(false);
  const [validationMessage, setValidationMessage] = useState<ValidationMessage | null>(null);
  const [selectedProgressPhase, setSelectedProgressPhase] = useState("Pre-op");
  const [isProgressDetailOpen, setIsProgressDetailOpen] = useState(false);
  const [isCasePanelOpen, setIsCasePanelOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [showImportBox, setShowImportBox] = useState(false);
  const [savedCases, setSavedCases] = useState<SavedCaseSummary[]>(getSavedCaseIndex);

  const currentNode = protocolNodes[currentNodeId] || protocolNodes.preop;
  const activeCanal = useMemo(
    () => caseData.canals.find((canal) => canal.name === caseData.currentCanal) || caseData.canals[0],
    [caseData.canals, caseData.currentCanal]
  );
  const progressPhase = selectedProgressPhase || currentNode.phase;
  const isHandoffNode = handoffNodeIds.has(currentNode.id);
  const continuationTargets = useMemo(
    () => getCanalContinuationTargets(caseData, activeCanal?.name),
    [caseData, activeCanal?.name]
  );

  useEffect(() => setRenameCanalName(activeCanal?.name || ""), [activeCanal?.name]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const autosavedAt = new Date().toISOString();
      const snapshot = { ...caseData, autosavedAt, currentNodeId };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      const caseId = makeCaseId(snapshot);
      window.localStorage.setItem(`${CASE_RECORD_PREFIX}${caseId}`, JSON.stringify(snapshot));
      const summary: SavedCaseSummary = {
        id: caseId,
        patientNumber: snapshot.patientNumber || "No patient #",
        tooth: snapshot.tooth || "Tooth ___",
        procedureType: snapshot.procedureType || "RCT",
        currentNodeId,
        canalCount: snapshot.canals?.length || 0,
        eventCount: snapshot.globalEvents?.length || 0,
        autosavedAt,
      };
      setSavedCases((prev) => {
        const next = [summary, ...prev.filter((item) => item.id !== caseId)].slice(0, 12);
        window.localStorage.setItem(CASE_INDEX_KEY, JSON.stringify(next));
        return next;
      });
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [caseData, currentNodeId]);

  function updateCase(updates: Partial<EndoCase>) {
    setCaseData((prev) => ({ ...prev, ...updates }));
    setValidationMessage(null);
  }

  function updatePreOp(field: string, value: string) {
    setCaseData((prev) => ({ ...prev, preOp: { ...prev.preOp, [field]: value } }));
    setValidationMessage(null);
  }

  function updateDiagnosis(field: string, value: string) {
    setCaseData((prev) => ({ ...prev, diagnosis: { ...(prev.diagnosis || {}), [field]: value } }));
    setValidationMessage(null);
  }

  function applySuggestedCaseStatus() {
    updateCase({ caseStatus: "" });
  }

  function updateActiveCanal(field: string, value: string) {
    setCaseData((prev) => ({
      ...prev,
      canals: prev.canals.map((canal) => (canal.name === prev.currentCanal ? { ...canal, [field]: value } : canal)),
    }));
    setValidationMessage(null);
  }

  function applyEalDerivedLengths() {
    const suggested = getSuggestedLengths(activeCanal);
    if (!suggested.patency || !suggested.shaping) {
      setValidationMessage({ optionLabel: "Use EAL ±1", missing: ["Enter a valid EAL 0 first"] });
      return;
    }
    setHistory((prev) => [...prev, { caseData, currentNodeId }]);
    setCaseData((prev) => ({
      ...prev,
      canals: prev.canals.map((canal) =>
        canal.name === prev.currentCanal
          ? { ...canal, patencyLength: suggested.patency, shapingLength: suggested.shaping }
          : canal
      ),
    }));
    setValidationMessage(null);
  }

  function startNewCase() {
    const fresh = { ...initialCase, autosavedAt: new Date().toISOString(), tooth: "", currentCanal: "Main", canals: [blankCanal("Main")] };
    setCaseData(fresh);
    setCurrentNodeId("preop");
    setHistory([]);
    setValidationMessage(null);
  }

  function loadSavedCase(caseId: string) {
    try {
      const saved = JSON.parse(window.localStorage.getItem(`${CASE_RECORD_PREFIX}${caseId}`) || "null");
      if (!saved) return;
      setCaseData({ ...initialCase, ...saved });
      setCurrentNodeId(getSavedCurrentNodeId(saved));
      setHistory([]);
      setValidationMessage(null);
    } catch {
      setValidationMessage({ optionLabel: "Load saved case", missing: ["Could not load saved case from local storage"] });
    }
  }

  function deleteSavedCase(caseId: string) {
    window.localStorage.removeItem(`${CASE_RECORD_PREFIX}${caseId}`);
    setSavedCases((prev) => {
      const next = prev.filter((item) => item.id !== caseId);
      window.localStorage.setItem(CASE_INDEX_KEY, JSON.stringify(next));
      return next;
    });
  }

  function clearSavedCurrentCase() {
    const caseId = makeCaseId(caseData);
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(`${CASE_RECORD_PREFIX}${caseId}`);
    deleteSavedCase(caseId);
    startNewCase();
  }

  function resetAllSavedCases() {
    Object.keys(window.localStorage).forEach((key) => {
      if (key.startsWith(CASE_RECORD_PREFIX) || key === STORAGE_KEY || key === CASE_INDEX_KEY) window.localStorage.removeItem(key);
    });
    setSavedCases([]);
    startNewCase();
  }

  function downloadCaseJson() {
    const blob = new Blob([JSON.stringify(buildJsonExport(caseData, currentNodeId), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `endo-case-${caseData.patientNumber || "no-patient"}-${caseData.tooth || "tooth"}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function importCaseJson() {
    try {
      const parsed = JSON.parse(importText);
      const globalEvents: ClinicalEvent[] = Array.isArray(parsed.events) ? parsed.events : Array.isArray(parsed.globalEvents) ? parsed.globalEvents : [];
      const importedCanals = Array.isArray(parsed.canals) && parsed.canals.length
        ? parsed.canals.map((canal: any) => {
            const normalizedCanal = { ...blankCanal(canal.name || "Canal"), ...canal };
            return { ...normalizedCanal, events: hydrateCanalEventsFromGlobalEvents(normalizedCanal, globalEvents) };
          })
        : initialCase.canals;
      const imported = { ...initialCase, ...parsed, caseStatus: hydrateCaseStatusOverride(parsed), canals: importedCanals, globalEvents, autosavedAt: new Date().toISOString() };
      setCaseData(imported);
      setCurrentNodeId(getSavedCurrentNodeId(imported));
      setHistory([]);
      setShowImportBox(false);
      setImportText("");
      setValidationMessage(null);
    } catch {
      setValidationMessage({ optionLabel: "Import JSON", missing: ["Invalid JSON or unsupported case format"] });
    }
  }

  function selectCanal(canalName: string) {
    setCaseData((prev) => ({ ...prev, currentCanal: canalName }));
    setCurrentNodeId(getCanalCheckpointNodeId(caseData, canalName));
    setValidationMessage(null);
  }

  function addCanal() {
    const typedName = newCanalName.trim();
    const canalName = typedName ? typedName.toUpperCase() : makeDefaultNewCanalName(caseData.canals);
    if (caseData.canals.some((canal) => canal.name === canalName)) {
      selectCanal(canalName);
      return;
    }
    const nextCaseData = { ...caseData, currentCanal: canalName, canals: [...caseData.canals, blankCanal(canalName)] };
    setCaseData(nextCaseData);
    setCurrentNodeId(getCanalCheckpointNodeId(nextCaseData, canalName));
    setRenameCanalName(canalName);
    setNewCanalName("");
    setValidationMessage(null);
  }

  function renameActiveCanal() {
    const nextName = renameCanalName.trim().toUpperCase();
    if (!activeCanal || !nextName) return;
    if (caseData.canals.some((canal) => canal.name === nextName && canal.name !== activeCanal.name)) {
      setValidationMessage({ optionLabel: "Rename canal", missing: [`A canal named ${nextName} already exists`] });
      return;
    }
    setHistory((prev) => [...prev, { caseData, currentNodeId }]);
    setCaseData((prev) => ({
      ...prev,
      currentCanal: nextName,
      canals: prev.canals.map((canal) => canal.name === prev.currentCanal ? { ...canal, name: nextName, events: (canal.events || []).map((event) => ({ ...event, canal: nextName })) } : canal),
      globalEvents: prev.globalEvents.map((event) => event.canal === prev.currentCanal ? { ...event, canal: nextName } : event),
    }));
    setValidationMessage(null);
  }

  function deleteActiveCanal() {
    if (!activeCanal) return;
    if (caseData.canals.length <= 1) {
      setValidationMessage({ optionLabel: "Delete canal", missing: ["At least one canal must remain. Rename this canal instead."] });
      return;
    }
    setHistory((prev) => [...prev, { caseData, currentNodeId }]);
    setCaseData((prev) => {
      const remaining = prev.canals.filter((canal) => canal.name !== prev.currentCanal);
      return { ...prev, currentCanal: remaining[0]?.name || "", canals: remaining, globalEvents: prev.globalEvents.filter((event) => event.canal !== prev.currentCanal) };
    });
    setRenameCanalName("");
    setValidationMessage(null);
  }

  function addManualCanalEvent(type: string, label: string, nextNodeId: string | null = null, difficultyFlag: DifficultyFlag | null = null) {
    if (!activeCanal) return;
    setHistory((prev) => [...prev, { caseData, currentNodeId }]);
    const event = makeRuntimeEvent({ type, tooth: caseData.tooth, canal: activeCanal.name, nodeId: currentNode.id, label, activeCanal });
    setCaseData((prev) => ({
      ...prev,
      difficulty: difficultyFlag || prev.difficulty,
      canals: prev.canals.map((canal) => canal.name === prev.currentCanal ? { ...canal, events: [...(canal.events || []), event] } : canal),
      globalEvents: [...prev.globalEvents, event],
    }));
    if (nextNodeId) setCurrentNodeId(nextNodeId);
    setCopied(false);
    setValidationMessage(null);
  }

  function resetActiveCanalManualStatus() {
    if (!activeCanal) return;
    setHistory((prev) => [...prev, { caseData, currentNodeId }]);

    const nextCaseData = {
      ...caseData,
      canals: caseData.canals.map((canal) =>
        canal.name === caseData.currentCanal
          ? { ...canal, events: (canal.events || []).filter((event) => !isManualCanalStatusEvent(event.type)) }
          : canal
      ),
      globalEvents: caseData.globalEvents.filter(
        (event) => event.canal !== caseData.currentCanal || !isManualCanalStatusEvent(event.type)
      ),
    };

    setCaseData(nextCaseData);
    setCurrentNodeId(inferCurrentNodeIdFromEvents(nextCaseData));
    setValidationMessage(null);
  }

  function findNextIncompleteCanal(data = caseData) {
    const currentIndex = data.canals.findIndex((canal) => canal.name === data.currentCanal);
    return (
      data.canals.find((canal, index) => index > currentIndex && getCanalStatus(canal) !== "complete") ||
      data.canals.find((canal) => canal.name !== data.currentCanal && getCanalStatus(canal) !== "complete") ||
      null
    );
  }

  function findNextUnstartedCanal(data = caseData) {
    const currentIndex = data.canals.findIndex((canal) => canal.name === data.currentCanal);
    return (
      data.canals.find((canal, index) => index > currentIndex && getCanalStatus(canal) === "notStarted") ||
      data.canals.find((canal) => canal.name !== data.currentCanal && getCanalStatus(canal) === "notStarted") ||
      null
    );
  }

  function createNewCanalAtEstimate(data = caseData) {
    const name = makeDefaultNewCanalName(data.canals);
    const nextCaseData = { ...data, currentCanal: name, canals: [...data.canals, blankCanal(name)] };
    setCaseData(nextCaseData);
    setCurrentNodeId("estimate-wl");
    setRenameCanalName(name);
    setValidationMessage(null);
    return true;
  }

  function continueCanal(target: CanalContinuationTarget) {
    if (!target || target.disabled || !target.nextNodeId) {
      setValidationMessage({ optionLabel: target?.label || "Continue canal", missing: [target?.reason || "No continuation action is available for this canal"] });
      return;
    }

    const targetCanal = caseData.canals.find((canal) => canal.name === target.canalName);
    if (!targetCanal) {
      setValidationMessage({ optionLabel: target.label, missing: [`Canal ${target.canalName} was not found`] });
      return;
    }

    setHistory((prev) => [...prev, { caseData, currentNodeId }]);

    const event = makeRuntimeEvent({
      type: "workflow.switchedCanal",
      tooth: caseData.tooth,
      canal: target.canalName,
      nodeId: currentNode.id,
      label: target.label,
      activeCanal: targetCanal,
    });
    event.details = {
      ...event.details,
      previousActiveCanal: caseData.currentCanal,
      newActiveCanal: target.canalName,
      previousNode: currentNode.id,
      nextNode: target.nextNodeId,
      reason: target.reason || target.label,
    };

    setCaseData((prev) => ({
      ...prev,
      currentCanal: target.canalName,
      canals: prev.canals.map((canal) =>
        canal.name === target.canalName
          ? { ...canal, events: [...(canal.events || []), event] }
          : canal
      ),
      globalEvents: [...prev.globalEvents, event],
    }));
    setCurrentNodeId(target.nextNodeId);
    setCopied(false);
    setValidationMessage(null);
  }

  function startAnotherCanal(data = caseData) {
    const nextCanal = findNextUnstartedCanal(data);
    if (nextCanal) {
      setCaseData((prev) => ({ ...prev, currentCanal: nextCanal.name }));
      setCurrentNodeId(getCanalCheckpointNodeId(data, nextCanal.name));
      setValidationMessage(null);
      return true;
    }
    return createNewCanalAtEstimate(data);
  }

  function startNextCanal(data = caseData) {
    return startAnotherCanal(data);
  }

  function applyDecision(option: DecisionOption) {
    const { eventId, timestamp } = createRuntimeEventArgs();
    const result = applyDecisionEngine({
      currentNodeId: currentNode.id,
      selectedOptionId: option.id || option.label,
      selectedOptionLabel: option.label,
      caseData,
      activeCanalName: activeCanal?.name || caseData.currentCanal,
      eventId,
      timestamp,
    });

    if (result.errors.length) {
      setValidationMessage({ optionLabel: option.label, missing: result.errors });
      return;
    }

    setHistory((prev) => [...prev, { caseData, currentNodeId }]);

    if (option.noteEvent?.type === "workflow.nextCanalBeforeClosure") {
      const nextCanal = findNextIncompleteCanal(result.updatedCaseData);
      if (!nextCanal) {
        setCaseData(result.updatedCaseData);
        setCurrentNodeId("canal-obturation-complete");
        setValidationMessage({ optionLabel: option.label, missing: ["No other incomplete canal found. Use 'All canals obturated; proceed to chamber cleanup' if ready."] });
        return;
      }
      setCaseData({ ...result.updatedCaseData, currentCanal: nextCanal.name });
      setCurrentNodeId(getCanalCheckpointNodeId(result.updatedCaseData, nextCanal.name));
      setCopied(false);
      setValidationMessage(null);
      return;
    }

    if (option.noteEvent?.type === "workflow.nextCanalSelected") {
      startAnotherCanal(result.updatedCaseData);
      setCopied(false);
      return;
    }

    setCaseData(result.updatedCaseData);
    setCurrentNodeId(result.nextNodeId);
    setCopied(false);
    setValidationMessage(null);
  }

  function undo() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setCaseData(previous.caseData);
    setCurrentNodeId(previous.currentNodeId);
    setHistory((prev) => prev.slice(0, -1));
    setValidationMessage(null);
  }

  const compactNote = buildCompactNote(caseData);
  const fullNote = buildFullNote(caseData);
  const patientSummary = buildPatientSummary(caseData);
  const jsonExport = JSON.stringify(buildJsonExport(caseData, currentNodeId), null, 2);
  const printableSummary = buildPrintableSummary(caseData);
  const eventLogExport = buildEventLogExport(caseData);
  const displayedNote = noteMode === "compact" ? compactNote : noteMode === "full" ? fullNote : noteMode === "patient" ? patientSummary : noteMode === "print" ? printableSummary : noteMode === "event log" ? eventLogExport : jsonExport;

  async function copyDisplayedNote() {
    try {
      await navigator.clipboard.writeText(displayedNote);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900">
      <div className="mx-auto max-w-[96rem] space-y-4">
        <header className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Canvas MVP · layout pass</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Endodontic Chairside Decision Guide</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">State-machine chairside workflow with event-based notes and local case persistence.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex min-h-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold leading-none text-slate-700">Patient: {caseData.patientNumber || "—"}</span>
              <span className="inline-flex min-h-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold leading-none text-slate-700">Tooth: {caseData.tooth || "—"}</span>
              <span className="inline-flex min-h-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold leading-none text-slate-700">{caseData.procedureType || "RCT"}</span>
              <span className="inline-flex min-h-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold leading-none text-slate-700">{getCaseStatus(caseData)}</span>
              <span className="inline-flex min-h-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold leading-none text-slate-700">Autosaved: {caseData.autosavedAt ? new Date(caseData.autosavedAt).toLocaleTimeString() : "not yet"}</span>
              <button
                type="button"
                onClick={() => setIsCasePanelOpen(true)}
                className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold leading-none text-white transition hover:bg-slate-800"
              >
                Case management
              </button>
            </div>
          </div>
        </header>

        <DifficultyBanner
          caseData={caseData}
          currentPhase={currentNode.phase}
          activeCanal={activeCanal}
          onOpenPhaseMap={() => {
            setSelectedProgressPhase(currentNode.phase);
            setIsProgressDetailOpen(true);
          }}
        />

        <main className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_360px] 2xl:grid-cols-[240px_minmax(360px,1fr)_320px_340px]">
          <aside className="contents 2xl:block 2xl:min-w-0 2xl:space-y-4">
            <CanalSelector
              caseData={caseData}
              newCanalName={newCanalName}
              renameCanalName={renameCanalName}
              onNewCanalNameChange={setNewCanalName}
              onRenameCanalNameChange={setRenameCanalName}
              onSelectCanal={selectCanal}
              onAddCanal={addCanal}
              onRenameActiveCanal={renameActiveCanal}
              onDeleteActiveCanal={deleteActiveCanal}
              className="order-1 xl:col-start-1 xl:row-start-1 2xl:col-auto 2xl:row-auto 2xl:order-none"
            />

            <CanalControls
              activeCanal={activeCanal}
              onManualEvent={addManualCanalEvent}
              onStartNextCanal={() => startNextCanal()}
              onResetManualStatus={resetActiveCanalManualStatus}
              className="order-2 xl:col-start-2 xl:row-start-1 2xl:col-auto 2xl:row-auto 2xl:order-none"
            />
          </aside>

          <section className="contents 2xl:block 2xl:min-w-0 2xl:space-y-4">
            <DecisionCard
              currentNode={currentNode}
              caseData={caseData}
              activeCanal={activeCanal}
              historyLength={history.length}
              validationMessage={validationMessage}
              isHandoffNode={isHandoffNode}
              continuationTargets={continuationTargets}
              onUndo={undo}
              onApplyDecision={applyDecision}
              onContinueCanal={continueCanal}
              onCreateNewCanal={() => createNewCanalAtEstimate(caseData)}
            />
          </section>

          <MeasurementPanel
            caseData={caseData}
            activeCanal={activeCanal}
            currentNodeId={currentNodeId}
            onUpdatePreOp={updatePreOp}
            onUpdateActiveCanal={updateActiveCanal}
            onApplyEalDerivedLengths={applyEalDerivedLengths}
          />

          <aside className="order-6 min-w-0 space-y-4 lg:col-span-2 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 xl:col-span-1 xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:block xl:space-y-4 2xl:col-auto 2xl:row-auto 2xl:order-none">
            <NotePreview
              noteMode={noteMode}
              displayedNote={displayedNote}
              copied={copied}
              onNoteModeChange={setNoteMode}
              onCopyDisplayedNote={copyDisplayedNote}
            />
            <EventLog events={caseData.globalEvents} />
          </aside>
        </main>

        {isCasePanelOpen ? (
          <CaseManagementModal
            caseData={caseData}
            savedCases={savedCases}
            importText={importText}
            showImportBox={showImportBox}
            onClose={() => setIsCasePanelOpen(false)}
            onUpdateCase={updateCase}
            onUpdateDiagnosis={updateDiagnosis}
            onApplySuggestedCaseStatus={applySuggestedCaseStatus}
            onStartNewCase={startNewCase}
            onDownloadCaseJson={downloadCaseJson}
            onToggleImportBox={() => setShowImportBox((value) => !value)}
            onImportTextChange={setImportText}
            onImportCaseJson={importCaseJson}
            onClearSavedCurrentCase={clearSavedCurrentCase}
            onResetAllSavedCases={resetAllSavedCases}
            onLoadSavedCase={loadSavedCase}
            onDeleteSavedCase={deleteSavedCase}
          />
        ) : null}

        {isProgressDetailOpen ? (
          <PhaseCanalMapModal
            caseData={caseData}
            currentPhase={currentNode.phase}
            progressPhase={progressPhase}
            onSelectProgressPhase={setSelectedProgressPhase}
            onSelectCanal={selectCanal}
            onClose={() => setIsProgressDetailOpen(false)}
          />
        ) : null}
      </div>
    </div>
  );
}

export { getNextRecommendedNodeForCanal };
