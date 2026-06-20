import React, { useEffect, useMemo, useState } from "react";
import type { CanalContinuationTarget, CaseSetupFocusTarget, DecisionOption, DifficultyFlag, EmbeddedWorkflowLaunch, EndoCase, ValidationMessage } from "./types";
import { ActiveWorkflowTargetPanel } from "./components/ActiveWorkflowTargetPanel";
import { DecisionCard } from "./components/DecisionCard";
import { CaseManagementModal, PriorVisitModal, SavedCasesModal } from "./components/CaseManagementModal";
import { DifficultyBanner } from "./components/DifficultyBanner";
import { EventLog } from "./components/EventLog";
import { MeasurementPanel } from "./components/MeasurementPanel";
import { NotePreview } from "./components/NotePreview";
import { OperativeWorkflowRunner } from "./components/OperativeWorkflowRunner";
import { PhaseCanalMapModal } from "./components/PhaseCanalMapModal";
import { SharedWorkflowRunnerModal } from "./components/SharedWorkflowRunnerModal";
import { SharedReadinessCard } from "./components/SharedReadinessCard";
import { WorkflowLauncher } from "./components/WorkflowLauncher";
import { cx, headerActionButton } from "./components/uiStyles";
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
import { getPhaseAwareCanalTargets } from "./protocol/continuation";
import { handoffNodeIds, protocolNodes } from "./protocol/nodes";
import { getConservativeResumeNodeForCanal, getManualResumeNodeForCanal, getPriorVisitResumeNodeForCanal } from "./engine/resume";
import { loadUserAnesthesiaCatalogItems, saveUserAnesthesiaCatalogItems } from "./state/anesthesiaCatalogPersistence";
import { loadUserIsolationCatalogItems, saveUserIsolationCatalogItems } from "./state/isolationCatalogPersistence";
import { blankCanal, CASE_INDEX_KEY, CASE_RECORD_PREFIX, initialCase, makeCaseId, makeDefaultNewCanalName, normalizeImportedEndoCase, STORAGE_KEY } from "./state/persistence";
import { endodonticRootWorkflowId } from "./workflow/registry";
import {
  buildOperativeSetupEventDetails,
  buildOperativeRestorationPlacedEvent,
  createOperativeSetupScope,
  createOperativeReadinessScopes,
  getOperativeRestorationEvents,
  getLatestOperativeWorkflowSetup,
  getOperativeReadinessCapabilitySummary,
  operativeDirectRestorationWorkflowId,
  operativeDirectRestorationWorkflowVersion,
  operativeScopeRecordedEventType,
  type OperativeWorkflowSetupState,
  upsertOperativeScopeRecordedEvent,
} from "./workflow/operative";
import type { AnesthesiaEventDetails, AnesthesiaEventType } from "./workflow/anesthesia";
import {
  anesthesiaEventTypes,
  getAnesthesiaAdequateCapabilityOutput,
  getAnesthesiaScopeFromDetails,
  sharedAnesthesiaWorkflowId,
  sharedAnesthesiaWorkflowVersion,
} from "./workflow/anesthesia";
import type { AnesthesiaEventOptions } from "./workflow/anesthesiaForm";
import type { IsolationEventDetails, IsolationEventType } from "./workflow/isolation";
import {
  buildIsolationEstablishedCapability,
  getIsolationScopeFromDetails,
  isolationEventTypes,
  sharedIsolationWorkflowId,
  sharedIsolationWorkflowVersion,
} from "./workflow/isolation";
import { getCaseCapabilitySummary } from "./workflow/selectors";

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

type ThemeMode = "light" | "dark";
type PrimaryWorkflowId = typeof endodonticRootWorkflowId | typeof operativeDirectRestorationWorkflowId;

const THEME_STORAGE_KEY = "nodedent-theme";
const LIGHT_FAVICON_PATH = "/nodedent_connected_tooth_icon_reference.svg";
const DARK_FAVICON_PATH = "/nodedent_connected_tooth_icon_reference_inverted_dark_bg.svg";

function makeWorkflowRunId(prefix: string) {
  return `run_${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getSavedCaseIndex(): SavedCaseSummary[] {
  try {
    return JSON.parse(window.localStorage.getItem(CASE_INDEX_KEY) || "[]");
  } catch {
    return [];
  }
}

function getInitialTheme(): ThemeMode {
  try {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  } catch {
    return "light";
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function createRuntimeEventArgs() {
  const now = Date.now();
  return {
    eventId: `evt_${now}_${Math.random().toString(16).slice(2)}`,
    timestamp: new Date(now).toISOString(),
  };
}

export default function NodeDentApp() {
  const [caseData, setCaseData] = useState<EndoCase>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return initialCase;
      const parsed = JSON.parse(saved);
      return normalizeImportedEndoCase(parsed, parsed.autosavedAt || new Date().toISOString());
    } catch {
      return initialCase;
    }
  });
  const [userAnesthesiaCatalogItems, setUserAnesthesiaCatalogItems] = useState(() => loadUserAnesthesiaCatalogItems());
  const [userIsolationCatalogItems, setUserIsolationCatalogItems] = useState(() => loadUserIsolationCatalogItems());
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
  const [activePrimaryWorkflowId, setActivePrimaryWorkflowId] = useState<PrimaryWorkflowId | null>(null);
  const [isCasePanelOpen, setIsCasePanelOpen] = useState(false);
  const [casePanelFocusTarget, setCasePanelFocusTarget] = useState<CaseSetupFocusTarget | null>(null);
  const [casePanelWorkflowId, setCasePanelWorkflowId] = useState("");
  const [embeddedWorkflowLaunch, setEmbeddedWorkflowLaunch] = useState<EmbeddedWorkflowLaunch | null>(null);
  const [rootWorkflowRunId, setRootWorkflowRunId] = useState(() => makeWorkflowRunId("endo_root"));
  const [isWorkflowLauncherOpen, setIsWorkflowLauncherOpen] = useState(false);
  const [isSavedCasesOpen, setIsSavedCasesOpen] = useState(false);
  const [isPriorVisitOpen, setIsPriorVisitOpen] = useState(false);
  const [isNewCaseConfirmOpen, setIsNewCaseConfirmOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [showImportBox, setShowImportBox] = useState(false);
  const [savedCases, setSavedCases] = useState<SavedCaseSummary[]>(getSavedCaseIndex);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme);

  const currentNode = protocolNodes[currentNodeId] || protocolNodes.preop;
  const activeCanal = useMemo(
    () => caseData.canals.find((canal) => canal.name === caseData.currentCanal) || caseData.canals[0],
    [caseData.canals, caseData.currentCanal]
  );
  const activeCanalStatus = getCanalStatus(activeCanal);
  const hasActivePrimaryWorkflow = Boolean(activePrimaryWorkflowId);
  const isEndodonticWorkflowActive = activePrimaryWorkflowId === endodonticRootWorkflowId;
  const operativeSetup = useMemo(() => getLatestOperativeWorkflowSetup(caseData), [caseData.globalEvents]);
  const latestOperativeRestorationEvent = useMemo(() => getOperativeRestorationEvents(caseData).at(-1), [caseData.globalEvents]);
  const caseCapabilitySummary = useMemo(() => getCaseCapabilitySummary(caseData), [caseData]);
  const operativeReadinessSummary = useMemo(() => getOperativeReadinessCapabilitySummary(caseData, operativeSetup), [caseData, operativeSetup]);
  const activeReadinessSummary = activePrimaryWorkflowId === operativeDirectRestorationWorkflowId ? operativeReadinessSummary : caseCapabilitySummary;
  const activeSharedModuleTargetTooth = activePrimaryWorkflowId === operativeDirectRestorationWorkflowId || casePanelWorkflowId === operativeDirectRestorationWorkflowId
    ? createOperativeReadinessScopes(operativeSetup, caseData.tooth).toothScope?.tooth
    : caseData.tooth;
  const disabledReadinessActionLabels =
    embeddedWorkflowLaunch?.workflowId === sharedAnesthesiaWorkflowId
      ? ["Anesthesia"]
      : embeddedWorkflowLaunch?.workflowId === sharedIsolationWorkflowId
        ? ["Isolation"]
        : [];
  const latestAnesthesiaEvent = useMemo(
    () => (caseData.globalEvents || []).filter((event) => Object.values(anesthesiaEventTypes).includes(event.type as AnesthesiaEventType)).at(-1),
    [caseData.globalEvents]
  );
  const canResumeActiveCanalFromPriorVisit = Boolean(
    caseData.priorVisit?.continuedFromPriorVisit ||
    caseData.globalEvents.some((event) => event.type === "case.continuedFromPriorVisit") ||
    activeCanal?.priorVisitStatus ||
    activeCanal?.priorVisitNote ||
    activeCanalStatus === "paused" ||
    activeCanalStatus === "medicated"
  );
  const progressPhase = selectedProgressPhase || currentNode.phase;
  const isHandoffNode = handoffNodeIds.has(currentNode.id);
  const continuationTargets = useMemo(
    () => getPhaseAwareCanalTargets(caseData, currentNode.id, activeCanal?.name),
    [caseData, currentNode.id, activeCanal?.name]
  );

  useEffect(() => setRenameCanalName(activeCanal?.name || ""), [activeCanal?.name]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    document.documentElement.style.colorScheme = themeMode;
    document
      .getElementById("app-favicon")
      ?.setAttribute("href", themeMode === "dark" ? DARK_FAVICON_PATH : LIGHT_FAVICON_PATH);
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

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

  function updateUserAnesthesiaCatalogItems(items: typeof userAnesthesiaCatalogItems) {
    setUserAnesthesiaCatalogItems(items);
    saveUserAnesthesiaCatalogItems(items);
  }

  function updateUserIsolationCatalogItems(items: typeof userIsolationCatalogItems) {
    setUserIsolationCatalogItems(items);
    saveUserIsolationCatalogItems(items);
  }

  function updatePreOp(field: string, value: string | boolean) {
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

  function recordAnesthesiaEvent(
    eventType: AnesthesiaEventType,
    details: AnesthesiaEventDetails,
    context?: { nodeId?: string; label?: string; workflowRunId?: string; parentWorkflowRunId?: string | null } & AnesthesiaEventOptions
  ) {
    setHistory((prev) => [...prev, { caseData, currentNodeId }]);
    const scope = getAnesthesiaScopeFromDetails(details, caseData.tooth);
    const eventTooth = details.tooth || details.teeth?.[0] || scope.tooth || caseData.tooth;
    const event = makeRuntimeEvent({
      type: eventType,
      tooth: eventTooth,
      canal: "All",
      nodeId: context?.nodeId || currentNode.id,
      label: context?.label || eventType,
      activeCanal,
      workflowId: sharedAnesthesiaWorkflowId,
      workflowVersion: sharedAnesthesiaWorkflowVersion,
      workflowRunId: context?.workflowRunId,
      parentWorkflowRunId: context?.parentWorkflowRunId,
      scope,
      expiresAt: context?.expiresAt,
    });
    event.details = { ...event.details, ...details };
    if (context?.nodeId) event.details.parentNodeId = currentNode.id;
    const capability = getAnesthesiaAdequateCapabilityOutput(event);
    if (capability) event.capabilitiesSatisfied = [capability];

    setCaseData((prev) => ({
      ...prev,
      globalEvents: [...prev.globalEvents, event],
    }));
    setCopied(false);
    setValidationMessage(null);
  }

  function recordIsolationEvent(
    eventType: IsolationEventType,
    details: IsolationEventDetails,
    context?: { nodeId?: string; label?: string; workflowRunId?: string; parentWorkflowRunId?: string | null }
  ) {
    setHistory((prev) => [...prev, { caseData, currentNodeId }]);
    const scope = getIsolationScopeFromDetails(details, caseData.tooth);
    const eventTooth = details.exposedTeeth?.[0] || scope.tooth || caseData.tooth;
    const event = makeRuntimeEvent({
      type: eventType,
      tooth: eventTooth,
      canal: "All",
      nodeId: context?.nodeId || currentNode.id,
      label: context?.label || eventType,
      activeCanal,
      workflowId: sharedIsolationWorkflowId,
      workflowVersion: sharedIsolationWorkflowVersion,
      workflowRunId: context?.workflowRunId,
      parentWorkflowRunId: context?.parentWorkflowRunId,
      scope,
    });
    event.details = { ...event.details, ...details };
    if (context?.nodeId) event.details.parentNodeId = currentNode.id;
    if (
      eventType === isolationEventTypes.rubberDamPlaced ||
      eventType === isolationEventTypes.alternativeIsolationUsed ||
      eventType === isolationEventTypes.replaced
    ) {
      event.capabilitiesSatisfied = [buildIsolationEstablishedCapability(event)];
    }

    setCaseData((prev) => ({
      ...prev,
      globalEvents: [...prev.globalEvents, event],
    }));
    setCopied(false);
    setValidationMessage(null);
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
    setCopied(false);
    setIsNewCaseConfirmOpen(false);
    setIsCasePanelOpen(false);
    setCasePanelFocusTarget(null);
    setCasePanelWorkflowId("");
    setActivePrimaryWorkflowId(null);
    setEmbeddedWorkflowLaunch(null);
    setIsWorkflowLauncherOpen(false);
    setRootWorkflowRunId(makeWorkflowRunId("endo_root"));
    setIsSavedCasesOpen(false);
    setIsPriorVisitOpen(false);
  }

  function openCasePanel(focusTarget?: CaseSetupFocusTarget, workflowId = activePrimaryWorkflowId || "") {
    setIsWorkflowLauncherOpen(false);
    setCasePanelFocusTarget(focusTarget || null);
    setCasePanelWorkflowId(workflowId);
    setIsCasePanelOpen(true);
  }

  function activatePrimaryWorkflow(workflowId: string) {
    if (workflowId !== endodonticRootWorkflowId && workflowId !== operativeDirectRestorationWorkflowId) return;
    setActivePrimaryWorkflowId(workflowId);
    setCasePanelWorkflowId(workflowId);
    setRootWorkflowRunId(makeWorkflowRunId(workflowId === operativeDirectRestorationWorkflowId ? "operative_direct" : "endo_root"));
    setIsWorkflowLauncherOpen(false);
  }

  function updateOperativeSetup(updates: Partial<OperativeWorkflowSetupState>) {
    setCaseData((prev) => {
      const nextSetup = { ...getLatestOperativeWorkflowSetup(prev), ...updates };
      const scope = createOperativeSetupScope(nextSetup, prev.tooth);
      const details = buildOperativeSetupEventDetails(nextSetup, prev.tooth);
      const event = makeRuntimeEvent({
        type: operativeScopeRecordedEventType,
        tooth: scope.tooth || prev.tooth,
        canal: "N/A",
        nodeId: "operative-surface-scope",
        label: "Operative setup recorded",
        workflowId: operativeDirectRestorationWorkflowId,
        workflowVersion: operativeDirectRestorationWorkflowVersion,
        scope,
      });
      event.details = { ...event.details, ...details };

      return {
        ...prev,
        globalEvents: upsertOperativeScopeRecordedEvent(prev.globalEvents, event),
      };
    });
    setValidationMessage(null);
  }

  function recordOperativeRestoration(record: { outcome: string; notes: string }) {
    setHistory((prev) => [...prev, { caseData, currentNodeId }]);
    const { eventId, timestamp } = createRuntimeEventArgs();
    const event = buildOperativeRestorationPlacedEvent({
      id: eventId,
      timestamp,
      record: {
        ...operativeSetup,
        tooth: operativeSetup.tooth || caseData.tooth,
        outcome: record.outcome,
        notes: record.notes,
      },
      fallbackTooth: caseData.tooth,
      workflowRunId: rootWorkflowRunId,
    });

    setCaseData((prev) => ({
      ...prev,
      globalEvents: [...prev.globalEvents, event],
    }));
    setCopied(false);
    setValidationMessage(null);
  }

  function openIsolationWorkflow(entryNodeId?: string) {
    setIsWorkflowLauncherOpen(false);
    setIsCasePanelOpen(false);
    setCasePanelFocusTarget(null);
    setEmbeddedWorkflowLaunch({
      workflowId: sharedIsolationWorkflowId,
      entryNodeId,
      workflowRunId: makeWorkflowRunId("shared_isolation"),
      targetTooth: activeSharedModuleTargetTooth,
    });
  }

  function openAnesthesiaWorkflow(entryNodeId?: string) {
    setIsWorkflowLauncherOpen(false);
    setIsCasePanelOpen(false);
    setCasePanelFocusTarget(null);
    setEmbeddedWorkflowLaunch({
      workflowId: sharedAnesthesiaWorkflowId,
      entryNodeId,
      workflowRunId: makeWorkflowRunId("shared_anesthesia"),
      targetTooth: activeSharedModuleTargetTooth,
    });
  }

  function continueFromPriorVisit() {
    setHistory((prev) => [...prev, { caseData, currentNodeId }]);
    const event = makeRuntimeEvent({
      type: "case.continuedFromPriorVisit",
      tooth: caseData.tooth,
      canal: "All",
      nodeId: currentNode.id,
      label: "Continue from prior visit",
      activeCanal,
    });

    setCaseData((prev) => ({
      ...prev,
      caseStatus: prev.caseStatus || "Resume next visit",
      priorVisit: {
        ...(prev.priorVisit || {}),
        continuedFromPriorVisit: true,
      },
      globalEvents: prev.globalEvents.some((item) => item.type === "case.continuedFromPriorVisit")
        ? prev.globalEvents
        : [...prev.globalEvents, event],
    }));
    setCopied(false);
    setValidationMessage(null);
  }

  function resumeActiveCanalFromPriorVisit() {
    if (!activeCanal) return;
    if (!canResumeActiveCanalFromPriorVisit) {
      setValidationMessage({ optionLabel: "Resume active canal", missing: ["Set up prior visit history or prior status for the active canal first"] });
      return;
    }
    const nextNodeId = getPriorVisitResumeNodeForCanal(activeCanal) || getManualResumeNodeForCanal(activeCanal) || getConservativeResumeNodeForCanal(activeCanal);
    if (!protocolNodes[nextNodeId]) {
      setValidationMessage({ optionLabel: "Resume active canal", missing: [`No resume node exists for ${nextNodeId}`] });
      return;
    }

    setHistory((prev) => [...prev, { caseData, currentNodeId }]);
    const event = makeRuntimeEvent({
      type: "workflow.resumedFromPriorVisit",
      tooth: caseData.tooth,
      canal: activeCanal.name,
      nodeId: currentNode.id,
      label: `Resume ${activeCanal.name} from prior visit`,
      activeCanal,
    });
    event.details = {
      ...event.details,
      nextNodeId,
      nextNode: nextNodeId,
      phaseLabel: protocolNodes[nextNodeId]?.title,
      reason: `resumed ${activeCanal.name} from prior visit history`,
    };

    setCaseData((prev) => ({
      ...prev,
      currentCanal: activeCanal.name,
      priorVisit: {
        ...(prev.priorVisit || {}),
        continuedFromPriorVisit: true,
      },
      canals: prev.canals.map((canal) =>
        canal.name === activeCanal.name
          ? { ...canal, events: [...(canal.events || []), event] }
          : canal
      ),
      globalEvents: [...prev.globalEvents, event],
    }));
    setCurrentNodeId(nextNodeId);
    setCopied(false);
    setValidationMessage(null);
  }

  function loadSavedCase(caseId: string) {
    try {
      const saved = JSON.parse(window.localStorage.getItem(`${CASE_RECORD_PREFIX}${caseId}`) || "null");
      if (!saved) return;
      const normalized = normalizeImportedEndoCase(saved, saved.autosavedAt || new Date().toISOString());
      setCaseData(normalized);
      setCurrentNodeId(getSavedCurrentNodeId(normalized));
      setHistory([]);
      setValidationMessage(null);
      setIsWorkflowLauncherOpen(false);
      setIsSavedCasesOpen(false);
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
      const imported = normalizeImportedEndoCase(parsed);
      imported.caseStatus = hydrateCaseStatusOverride(parsed);
      setCaseData(imported);
      setCurrentNodeId(getSavedCurrentNodeId(imported));
      setHistory([]);
      setShowImportBox(false);
      setIsWorkflowLauncherOpen(false);
      setIsSavedCasesOpen(false);
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
      previousCanal: caseData.currentCanal,
      nextCanal: target.canalName,
      previousNode: currentNode.id,
      nextNode: target.nextNodeId,
      previousNodeId: currentNode.id,
      nextNodeId: target.nextNodeId,
      reason: target.reason || target.label,
      phaseLabel: target.phaseLabel,
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

  function openSavedCases() {
    setIsWorkflowLauncherOpen(false);
    setIsSavedCasesOpen(true);
  }

  function openPriorVisit() {
    setIsWorkflowLauncherOpen(false);
    setIsPriorVisitOpen(true);
  }

  function openNewCaseConfirm() {
    setIsWorkflowLauncherOpen(false);
    setIsNewCaseConfirmOpen(true);
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
    <div className="min-h-screen bg-brand-light-slate p-4 text-brand-navy">
      <div className="mx-auto max-w-[96rem] space-y-4">
        <header className="rounded-3xl border border-brand-light-node bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-slate">NodeDent · clinical workspace</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-navy">NodeDent Clinical Workspace</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-slate">
                {hasActivePrimaryWorkflow
                  ? `Active workflow: ${isEndodonticWorkflowActive ? "Endodontic decision guide" : "Operative direct restoration"}. Shared modules, setup, notes, and case history stay available around the workflow.`
                  : "Choose a primary workflow or open shared setup and module capture."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex min-h-9 items-center justify-center rounded-full border border-brand-light-node bg-brand-light-slate px-3 py-1.5 font-semibold leading-none text-brand-slate">Patient: {caseData.patientNumber || "—"}</span>
              <span className="inline-flex min-h-9 items-center justify-center rounded-full border border-brand-light-node bg-brand-light-slate px-3 py-1.5 font-semibold leading-none text-brand-slate">Tooth: {caseData.tooth || "—"}</span>
              <span className="inline-flex min-h-9 items-center justify-center rounded-full border border-brand-light-node bg-brand-light-slate px-3 py-1.5 font-semibold leading-none text-brand-slate">{caseData.procedureType || "RCT"}</span>
              <span className="inline-flex min-h-9 items-center justify-center rounded-full border border-brand-light-node bg-brand-light-slate px-3 py-1.5 font-semibold leading-none text-brand-slate">{getCaseStatus(caseData)}</span>
              <span className="inline-flex min-h-9 items-center justify-center rounded-full border border-brand-light-node bg-brand-light-slate px-3 py-1.5 font-semibold leading-none text-brand-slate">Autosaved: {caseData.autosavedAt ? new Date(caseData.autosavedAt).toLocaleTimeString() : "not yet"}</span>
              {hasActivePrimaryWorkflow ? (
                <button
                  type="button"
                  onClick={() => setIsWorkflowLauncherOpen(true)}
                  className={headerActionButton.mint}
                >
                  NodeDent Home
                </button>
              ) : null}
              <button
                type="button"
                aria-pressed={themeMode === "dark"}
                onClick={() => setThemeMode((value) => value === "dark" ? "light" : "dark")}
                className={cx(headerActionButton.secondaryCompact, "gap-2")}
              >
                <span className={`h-3 w-3 rounded-full border ${themeMode === "dark" ? "border-brand-mint bg-brand-mint" : "border-brand-slate bg-brand-light-slate"}`} />
                {themeMode === "dark" ? "Dark" : "Light"} mode
              </button>
              <button
                type="button"
                onClick={() => openCasePanel()}
                className={headerActionButton.primary}
              >
                Case Setup & Status
              </button>
              <button
                type="button"
                onClick={openSavedCases}
                className={headerActionButton.info}
              >
                Resume saved workflow
              </button>
              <button
                type="button"
                onClick={openPriorVisit}
                className={headerActionButton.warning}
              >
                Prior visit
              </button>
              <button
                type="button"
                onClick={openNewCaseConfirm}
                className={headerActionButton.secondary}
              >
                New case
              </button>
            </div>
          </div>
        </header>

        {!hasActivePrimaryWorkflow ? (
          <main>
            <WorkflowLauncher
              caseData={caseData}
              capabilitySummary={activeReadinessSummary}
              currentNodeTitle={currentNode.title}
              currentNodePhase={currentNode.phase}
              savedCaseCount={savedCases.length}
              presentation="page"
              onClose={() => undefined}
              onContinueEndodonticWorkflow={() => activatePrimaryWorkflow(endodonticRootWorkflowId)}
              onOpenCaseSetupStatus={() => openCasePanel()}
              onOpenSavedCases={openSavedCases}
              onOpenPriorVisit={openPriorVisit}
              onOpenNewCaseConfirm={openNewCaseConfirm}
              onOpenPrimaryWorkflowSetup={activatePrimaryWorkflow}
              onOpenAnesthesiaWorkflow={() => openAnesthesiaWorkflow()}
              onOpenIsolationWorkflow={() => openIsolationWorkflow()}
            />
          </main>
        ) : (
          <>
            <SharedReadinessCard
              caseData={caseData}
              capabilitySummary={activeReadinessSummary}
              onOpenCaseSetupStatus={openCasePanel}
              onOpenAnesthesiaWorkflow={openAnesthesiaWorkflow}
              onOpenIsolationWorkflow={openIsolationWorkflow}
              disabledActionLabels={disabledReadinessActionLabels}
            />

            {isEndodonticWorkflowActive ? (
              <DifficultyBanner
                caseData={caseData}
                currentPhase={currentNode.phase}
                activeCanal={activeCanal}
                onOpenPhaseMap={() => {
                  setSelectedProgressPhase(currentNode.phase);
                  setIsProgressDetailOpen(true);
                }}
              />
            ) : null}

            <main className="grid items-start gap-4 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)] xl:grid-cols-[240px_minmax(360px,1fr)_320px] 2xl:grid-cols-[240px_minmax(360px,1fr)_320px_340px]">
              <aside className="order-1 min-w-0 space-y-4 lg:col-start-1 lg:row-start-1 xl:col-start-1 xl:row-start-1">
                <ActiveWorkflowTargetPanel
                  activeWorkflowId={activePrimaryWorkflowId || endodonticRootWorkflowId}
                  endodonticProps={{
                    caseData,
                    newCanalName,
                    renameCanalName,
                    onNewCanalNameChange: setNewCanalName,
                    onRenameCanalNameChange: setRenameCanalName,
                    onSelectCanal: selectCanal,
                    onAddCanal: addCanal,
                    onRenameActiveCanal: renameActiveCanal,
                    onDeleteActiveCanal: deleteActiveCanal,
                    onManualEvent: addManualCanalEvent,
                    onResetManualStatus: resetActiveCanalManualStatus,
                    onOpenPhaseMap: () => {
                      setSelectedProgressPhase(currentNode.phase);
                      setIsProgressDetailOpen(true);
                    },
                  }}
                  operativeProps={{
                    caseData,
                    setup: operativeSetup,
                    onSetupChange: updateOperativeSetup,
                  }}
                />
              </aside>

              {isEndodonticWorkflowActive ? (
                <>
                  <section className="contents">
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
                      onOpenCaseSetupStatus={openCasePanel}
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
                </>
              ) : (
                <OperativeWorkflowRunner
                  caseData={caseData}
                  setup={operativeSetup}
                  capabilitySummary={operativeReadinessSummary}
                  latestRestorationEvent={latestOperativeRestorationEvent}
                  onSetupChange={updateOperativeSetup}
                  onRecordRestoration={recordOperativeRestoration}
                  onOpenCaseSetupStatus={openCasePanel}
                  onOpenAnesthesiaWorkflow={openAnesthesiaWorkflow}
                  onOpenIsolationWorkflow={openIsolationWorkflow}
                />
              )}

          <aside className="order-4 min-w-0 space-y-4 lg:col-span-2 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 xl:col-span-3 xl:col-start-1 xl:row-start-2 2xl:col-span-1 2xl:col-start-4 2xl:row-start-1 2xl:block 2xl:space-y-4">
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
          </>
        )}

        {isWorkflowLauncherOpen ? (
          <WorkflowLauncher
            caseData={caseData}
            capabilitySummary={activeReadinessSummary}
            currentNodeTitle={currentNode.title}
            currentNodePhase={currentNode.phase}
            savedCaseCount={savedCases.length}
            onClose={() => setIsWorkflowLauncherOpen(false)}
            onContinueEndodonticWorkflow={() => activatePrimaryWorkflow(endodonticRootWorkflowId)}
            onOpenCaseSetupStatus={() => openCasePanel()}
            onOpenSavedCases={openSavedCases}
            onOpenPriorVisit={openPriorVisit}
            onOpenNewCaseConfirm={openNewCaseConfirm}
            onOpenPrimaryWorkflowSetup={activatePrimaryWorkflow}
            onOpenAnesthesiaWorkflow={() => openAnesthesiaWorkflow()}
            onOpenIsolationWorkflow={() => openIsolationWorkflow()}
          />
        ) : null}

        {isCasePanelOpen ? (
          <CaseManagementModal
            caseData={caseData}
            activeCanal={activeCanal}
            activeWorkflowId={casePanelWorkflowId}
            currentNodeId={casePanelWorkflowId === operativeDirectRestorationWorkflowId ? "operative-readiness" : currentNodeId}
            onClose={() => {
              setIsCasePanelOpen(false);
              setCasePanelFocusTarget(null);
              setCasePanelWorkflowId(activePrimaryWorkflowId || "");
            }}
            onUpdateCase={updateCase}
            onUpdateDiagnosis={updateDiagnosis}
            onUpdatePreOp={updatePreOp}
            onUpdateActiveCanal={updateActiveCanal}
            onApplySuggestedCaseStatus={applySuggestedCaseStatus}
            onRecordAnesthesiaEvent={recordAnesthesiaEvent}
            onRecordIsolationEvent={recordIsolationEvent}
            onOpenAnesthesiaWorkflow={openAnesthesiaWorkflow}
            onOpenIsolationWorkflow={openIsolationWorkflow}
            userAnesthesiaCatalogItems={userAnesthesiaCatalogItems}
            onUserAnesthesiaCatalogItemsChange={updateUserAnesthesiaCatalogItems}
            userIsolationCatalogItems={userIsolationCatalogItems}
            onUserIsolationCatalogItemsChange={updateUserIsolationCatalogItems}
            onDownloadCaseJson={downloadCaseJson}
            initialFocusSection={casePanelFocusTarget}
          />
        ) : null}

        {embeddedWorkflowLaunch ? (
          <SharedWorkflowRunnerModal
            launch={embeddedWorkflowLaunch}
            caseData={caseData}
            parentNodeTitle={currentNode.title}
            parentWorkflowRunId={rootWorkflowRunId}
            latestAnesthesiaEvent={
              activePrimaryWorkflowId === operativeDirectRestorationWorkflowId
                ? activeReadinessSummary.anesthesia.sourceEvent
                : activeReadinessSummary.anesthesia.sourceEvent || latestAnesthesiaEvent
            }
            latestIsolationEvent={activeReadinessSummary.isolation.sourceEvent}
            userAnesthesiaCatalogItems={userAnesthesiaCatalogItems}
            onUserAnesthesiaCatalogItemsChange={updateUserAnesthesiaCatalogItems}
            userIsolationCatalogItems={userIsolationCatalogItems}
            onUserIsolationCatalogItemsChange={updateUserIsolationCatalogItems}
            onClose={() => setEmbeddedWorkflowLaunch(null)}
            onRecordAnesthesiaEvent={recordAnesthesiaEvent}
            onRecordIsolationEvent={recordIsolationEvent}
          />
        ) : null}

        {isSavedCasesOpen ? (
          <SavedCasesModal
            savedCases={savedCases}
            importText={importText}
            showImportBox={showImportBox}
            onClose={() => setIsSavedCasesOpen(false)}
            onToggleImportBox={() => setShowImportBox((value) => !value)}
            onImportTextChange={setImportText}
            onImportCaseJson={importCaseJson}
            onClearSavedCurrentCase={clearSavedCurrentCase}
            onResetAllSavedCases={resetAllSavedCases}
            onLoadSavedCase={loadSavedCase}
            onDeleteSavedCase={deleteSavedCase}
          />
        ) : null}

        {isPriorVisitOpen ? (
          <PriorVisitModal
            caseData={caseData}
            onClose={() => setIsPriorVisitOpen(false)}
            onUpdateCase={updateCase}
            onContinueFromPriorVisit={continueFromPriorVisit}
            onResumeActiveCanalFromPriorVisit={resumeActiveCanalFromPriorVisit}
            canResumeActiveCanalFromPriorVisit={canResumeActiveCanalFromPriorVisit}
          />
        ) : null}

        {isNewCaseConfirmOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy-deep/30 p-4">
            <section className="w-full max-w-md rounded-3xl border border-brand-light-node bg-white p-5 shadow-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-slate">New case</p>
              <h2 className="mt-1 text-xl font-bold text-brand-navy">Start a blank case?</h2>
              <p className="mt-2 text-sm leading-6 text-brand-slate">The current case is autosaved locally. Starting a new case clears the active workspace and returns the workflow to pre-op.</p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setIsNewCaseConfirmOpen(false)}
                  className="rounded-xl border border-brand-light-node bg-white px-3 py-2 text-sm font-semibold text-brand-slate hover:bg-brand-light-slate"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={startNewCase}
                  className="rounded-xl border border-brand-navy bg-brand-navy px-3 py-2 text-sm font-semibold text-white hover:bg-brand-navy-deep"
                >
                  Start new case
                </button>
              </div>
            </section>
          </div>
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

export { getNextRecommendedNodeForCanal } from "./protocol/continuation";
