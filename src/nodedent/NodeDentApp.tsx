import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CanalContinuationTarget, CaseSetupFocusTarget, DecisionOption, DifficultyFlag, EmbeddedWorkflowLaunch, EndoCase, ValidationMessage } from "./types";
import { ActiveWorkflowTargetPanel } from "./components/ActiveWorkflowTargetPanel";
import { DecisionCard } from "./components/DecisionCard";
import { CaseManagementModal, PriorVisitModal, SavedCasesModal } from "./components/CaseManagementModal";
import { ClinicalDataNotice } from "./components/ClinicalDataNotice";
import { ClinicalVaultGate, type ClinicalVaultAccess } from "./components/ClinicalVaultGate";
import { AppFooter, PRIVACY_POLICY_HASH } from "./components/AppFooter";
import { PrivacyPolicyPage } from "./components/PrivacyPolicyPage";
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
import { buildClinicalExportFilename, buildVaultBackupFilename } from "./notes/exportFilename";
import { getPhaseAwareCanalTargets } from "./protocol/continuation";
import { handoffNodeIds, protocolNodes } from "./protocol/nodes";
import { getConservativeResumeNodeForCanal, getManualResumeNodeForCanal, getPriorVisitResumeNodeForCanal } from "./engine/resume";
import { loadUserAnesthesiaCatalogItems, saveUserAnesthesiaCatalogItems } from "./state/anesthesiaCatalogPersistence";
import { CLINICAL_VAULT_IDLE_TIMEOUT_MS, ClinicalVaultError, type ClinicalVaultSession, type SavedCaseSummary } from "./state/clinicalVault";
import { loadUserIsolationCatalogItems, saveUserIsolationCatalogItems } from "./state/isolationCatalogPersistence";
import { blankCanal, createEncounterId, createFreshCase, makeDefaultNewCanalName, normalizeImportedEndoCase } from "./state/persistence";
import { EndoCaseSchema } from "./schemas/EndoCase.schema";
import { endodonticRootWorkflowId } from "./workflow/registry";
import { isNoTreatmentSelected, noTreatmentSelectedProcedure } from "./workflow/procedures";
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
import type { RadiologyEventDetails } from "./workflow/radiology";
import {
  buildRadiographsReviewedCapability,
  getRadiologyScopeFromDetails,
  isRadiologyReviewedEvent,
  radiologyEventTypes,
  sharedRadiologyWorkflowId,
  sharedRadiologyWorkflowVersion,
} from "./workflow/radiology";
import { getCaseCapabilitySummary } from "./workflow/selectors";

type HistoryEntry = {
  caseData: EndoCase;
  currentNodeId: string;
};

type ThemeMode = "light" | "dark";
type PrimaryWorkflowId = typeof endodonticRootWorkflowId | typeof operativeDirectRestorationWorkflowId;

const THEME_STORAGE_KEY = "nodedent-theme";
const LIGHT_FAVICON_PATH = "/nodedent_connected_tooth_icon_reference.svg";
const DARK_FAVICON_PATH = "/nodedent_connected_tooth_icon_reference_inverted_dark_bg.svg";

function makeWorkflowRunId(prefix: string) {
  return `run_${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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

type StorageStatus = "loading" | "saving" | "saved" | "failed" | "conflict";

class ClinicalWorkspaceErrorBoundary extends React.Component<
  { children: React.ReactNode; onFatalError: () => void; onLock: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFatalError();
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="min-h-screen bg-brand-light-slate p-4 text-brand-navy">
        <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-2xl place-items-center">
          <section className="w-full rounded-3xl border border-red-300 bg-white p-6 shadow-xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-800">Protected workspace locked</p>
            <h1 className="mt-2 text-2xl font-bold">NodeDent encountered an unexpected display error</h1>
            <p className="mt-3 text-sm leading-6 text-brand-slate">The in-memory vault key was cleared. No diagnostic containing clinical data was sent anywhere. Return to the lock screen and reopen the protected case.</p>
            <button type="button" onClick={this.props.onLock} className="mt-4 rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-deep">Return to vault lock screen</button>
          </section>
        </div>
      </main>
    );
  }
}

function downloadFile(content: BlobPart, type: string, filename: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function NodeDentApp() {
  const [vaultAccess, setVaultAccess] = useState<ClinicalVaultAccess | null>(null);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(() => window.location.hash === PRIVACY_POLICY_HASH);

  useEffect(() => {
    const handleHashChange = () => {
      const shouldShowPrivacyPolicy = window.location.hash === PRIVACY_POLICY_HASH;
      if (shouldShowPrivacyPolicy && vaultAccess) {
        vaultAccess.session.close();
        setVaultAccess(null);
      }
      setShowPrivacyPolicy(shouldShowPrivacyPolicy);
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [vaultAccess]);

  let content: React.ReactNode;

  if (showPrivacyPolicy) {
    content = <PrivacyPolicyPage />;
  } else if (!vaultAccess) {
    content = <ClinicalVaultGate onAccess={setVaultAccess} />;
  } else {
    const lockAndReset = () => {
      vaultAccess.session.close();
      setVaultAccess(null);
    };

    content = (
      <ClinicalWorkspaceErrorBoundary onFatalError={() => vaultAccess.session.close()} onLock={lockAndReset}>
        <ClinicalWorkspace access={vaultAccess} onLocked={lockAndReset} />
      </ClinicalWorkspaceErrorBoundary>
    );
  }

  return (
    <div className="min-h-screen bg-brand-light-slate">
      {content}
      <AppFooter />
    </div>
  );
}

function ClinicalWorkspace({ access, onLocked }: { access: ClinicalVaultAccess; onLocked: () => void }) {
  const { session, persistentStorage } = access;
  const [caseData, setCaseData] = useState<EndoCase>(createFreshCase);
  const [userAnesthesiaCatalogItems, setUserAnesthesiaCatalogItems] = useState(() => loadUserAnesthesiaCatalogItems());
  const [userIsolationCatalogItems, setUserIsolationCatalogItems] = useState(() => loadUserIsolationCatalogItems());
  const [currentNodeId, setCurrentNodeId] = useState("preop");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [newCanalName, setNewCanalName] = useState("");
  const [renameCanalName, setRenameCanalName] = useState("");
  const [noteMode, setNoteMode] = useState("compact");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
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
  const [savedCases, setSavedCases] = useState<SavedCaseSummary[]>([]);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme);
  const [isVaultReady, setIsVaultReady] = useState(false);
  const [storageStatus, setStorageStatus] = useState<StorageStatus>("loading");
  const [storageMessage, setStorageMessage] = useState("Opening protected storage…");
  const revisionByEncounter = useRef(new Map<string, number>());
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const latestCaseData = useRef(caseData);
  const latestNodeId = useRef(currentNodeId);
  const lockInProgress = useRef(false);
  const controlChannel = useRef<BroadcastChannel | null>(null);
  const tabId = useRef(globalThis.crypto.randomUUID());
  const storageStatusRef = useRef(storageStatus);

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
        : embeddedWorkflowLaunch?.workflowId === sharedRadiologyWorkflowId
          ? ["Radiographs"]
          : [];
  const latestAnesthesiaEvent = useMemo(
    () => (caseData.globalEvents || []).filter((event) => Object.values(anesthesiaEventTypes).includes(event.type as AnesthesiaEventType)).at(-1),
    [caseData.globalEvents]
  );
  const latestRadiologyEvent = useMemo(
    () => (caseData.globalEvents || []).filter(isRadiologyReviewedEvent).at(-1),
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

  latestCaseData.current = caseData;
  latestNodeId.current = currentNodeId;
  storageStatusRef.current = storageStatus;

  const refreshSavedCases = useCallback(async () => {
    const cases = await session.listCases();
    setSavedCases(cases);
    return cases;
  }, [session]);

  const queueCaseSave = useCallback((snapshot: EndoCase, nodeId: string) => {
    const queuedSnapshot = structuredClone(snapshot);
    const job = saveQueue.current.then(async () => {
      setStorageStatus("saving");
      setStorageMessage("Encrypting and saving…");
      const expectedRevision = revisionByEncounter.current.get(queuedSnapshot.encounterId) || 0;
      const saved = await session.saveCase(queuedSnapshot, nodeId, expectedRevision);
      revisionByEncounter.current.set(queuedSnapshot.encounterId, saved.revision);
      setStorageStatus("saved");
      setStorageMessage(`Saved ${new Date(saved.savedAt).toLocaleTimeString()}`);
      await refreshSavedCases();
    });
    saveQueue.current = job.catch((error) => {
      const conflict = error instanceof ClinicalVaultError && error.code === "CONFLICT";
      setStorageStatus(conflict ? "conflict" : "failed");
      setStorageMessage(error instanceof Error ? error.message : "Protected storage failed.");
    });
    return job;
  }, [refreshSavedCases, session]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const activeSnapshot = await session.loadActiveCase();
        if (cancelled) return;
        if (activeSnapshot) {
          revisionByEncounter.current.set(activeSnapshot.encounterId, activeSnapshot.revision);
          setCaseData(activeSnapshot.caseData);
          setCurrentNodeId(activeSnapshot.currentNodeId);
          setStorageMessage(`Saved ${new Date(activeSnapshot.savedAt).toLocaleTimeString()}`);
        } else {
          const fresh = createFreshCase();
          const saved = await session.saveCase(fresh, "preop", 0);
          if (cancelled) return;
          revisionByEncounter.current.set(fresh.encounterId, saved.revision);
          setCaseData(saved.caseData);
          setCurrentNodeId("preop");
          setStorageMessage(`Saved ${new Date(saved.savedAt).toLocaleTimeString()}`);
        }
        await refreshSavedCases();
        if (!cancelled) {
          setStorageStatus("saved");
          setIsVaultReady(true);
        }
      } catch (error) {
        if (!cancelled) {
          setStorageStatus("failed");
          setStorageMessage(error instanceof Error ? error.message : "Could not open protected storage.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshSavedCases, session]);

  useEffect(() => setRenameCanalName(activeCanal?.name || ""), [activeCanal?.name]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    document
      .getElementById("app-favicon")
      ?.setAttribute("href", themeMode === "dark" ? DARK_FAVICON_PATH : LIGHT_FAVICON_PATH);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // Theme persistence is optional and never contains clinical data.
    }
  }, [themeMode]);

  useEffect(() => {
    if (!isVaultReady) return;
    const timeoutId = window.setTimeout(() => {
      void queueCaseSave(caseData, currentNodeId).catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(timeoutId);
  }, [caseData, currentNodeId, isVaultReady, queueCaseSave]);

  const lockVault = useCallback(async (flush = true, broadcast = true) => {
    if (lockInProgress.current) return;
    lockInProgress.current = true;
    if (flush && isVaultReady && storageStatusRef.current !== "conflict") {
      try {
        await queueCaseSave(latestCaseData.current, latestNodeId.current);
        await saveQueue.current;
      } catch {
        // Locking must still complete when storage is unavailable.
      }
    }
    if (broadcast) controlChannel.current?.postMessage({ type: "lock-all", sender: tabId.current });
    onLocked();
  }, [isVaultReady, onLocked, queueCaseSave]);

  useEffect(() => {
    if (!isVaultReady || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("nodedent-clinical-vault-control-v1");
    controlChannel.current = channel;
    channel.onmessage = (event) => {
      const message = event.data as { type?: string; sender?: string };
      if (message.sender === tabId.current) return;
      if (message.type === "lock-all" || message.type === "lock-other-tabs") void lockVault(false, false);
    };
    channel.postMessage({ type: "lock-other-tabs", sender: tabId.current });
    return () => {
      controlChannel.current = null;
      channel.close();
    };
  }, [isVaultReady, lockVault]);

  useEffect(() => {
    if (!isVaultReady) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") void lockVault(true, true);
    };
    const handlePageHide = () => {
      controlChannel.current?.postMessage({ type: "lock-all", sender: tabId.current });
      session.close();
      onLocked();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [isVaultReady, lockVault, onLocked, session]);

  useEffect(() => {
    if (!isVaultReady) return;
    let timerId = 0;
    const resetTimer = () => {
      window.clearTimeout(timerId);
      timerId = window.setTimeout(() => void lockVault(true, true), CLINICAL_VAULT_IDLE_TIMEOUT_MS);
    };
    const activityEvents: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart"];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      window.clearTimeout(timerId);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
    };
  }, [isVaultReady, lockVault]);

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

  function recordRadiologyEvent(
    details: RadiologyEventDetails,
    context?: { nodeId?: string; label?: string; workflowRunId?: string; parentWorkflowRunId?: string | null }
  ) {
    setHistory((prev) => [...prev, { caseData, currentNodeId }]);
    const scope = getRadiologyScopeFromDetails(details, caseData.tooth);
    const eventTooth = details.tooth || details.teeth?.[0] || scope.tooth || caseData.tooth;
    const event = makeRuntimeEvent({
      type: radiologyEventTypes.reviewed,
      tooth: eventTooth,
      canal: "All",
      nodeId: context?.nodeId || currentNode.id,
      label: context?.label || "Radiograph review recorded",
      activeCanal,
      workflowId: sharedRadiologyWorkflowId,
      workflowVersion: sharedRadiologyWorkflowVersion,
      workflowRunId: context?.workflowRunId || makeWorkflowRunId("shared_radiology"),
      parentWorkflowRunId: context?.parentWorkflowRunId,
      scope,
    });
    event.details = { ...event.details, ...details };
    if (context?.nodeId) event.details.parentNodeId = currentNode.id;
    event.capabilitiesSatisfied = [buildRadiographsReviewedCapability(event)];

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
    const fresh = createFreshCase();
    revisionByEncounter.current.set(fresh.encounterId, 0);
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
    setCaseData((prev) => {
      if (!isNoTreatmentSelected(prev.procedureType)) return prev;
      return {
        ...prev,
        procedureType: workflowId === operativeDirectRestorationWorkflowId ? "Direct restoration" : "RCT",
      };
    });
    setIsWorkflowLauncherOpen(false);
  }

  function openOperativeWorkflowSetupFromCasePanel() {
    setIsCasePanelOpen(false);
    setCasePanelFocusTarget(null);
    activatePrimaryWorkflow(operativeDirectRestorationWorkflowId);
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

  function openRadiologyWorkflow(entryNodeId?: string) {
    setIsWorkflowLauncherOpen(false);
    setIsCasePanelOpen(false);
    setCasePanelFocusTarget(null);
    setEmbeddedWorkflowLaunch({
      workflowId: sharedRadiologyWorkflowId,
      entryNodeId,
      workflowRunId: makeWorkflowRunId("shared_radiology"),
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

  async function loadSavedCase(caseId: string) {
    try {
      await saveQueue.current;
      const saved = await session.loadCase(caseId);
      if (!saved) throw new Error("Protected case not found.");
      revisionByEncounter.current.set(saved.encounterId, saved.revision);
      setCaseData(saved.caseData);
      setCurrentNodeId(saved.currentNodeId);
      setHistory([]);
      setValidationMessage(null);
      setIsWorkflowLauncherOpen(false);
      setIsSavedCasesOpen(false);
    } catch (error) {
      setStorageStatus("failed");
      setStorageMessage(error instanceof Error ? error.message : "Could not load protected case.");
    }
  }

  async function deleteSavedCase(caseId: string) {
    const summary = savedCases.find((item) => item.id === caseId);
    if (!window.confirm(`Delete the protected local case for chart ${summary?.patientNumber || "not recorded"}? This does not delete the official EMR record.`)) return;
    try {
      await saveQueue.current;
      await session.deleteCase(caseId);
      revisionByEncounter.current.delete(caseId);
      await refreshSavedCases();
      if (caseData.encounterId === caseId) startNewCase();
    } catch (error) {
      setStorageStatus("failed");
      setStorageMessage(error instanceof Error ? error.message : "Could not delete protected case.");
    }
  }

  async function clearSavedCurrentCase() {
    if (!window.confirm(`Delete the current protected local case for chart ${caseData.patientNumber || "not recorded"} and start a blank case? The official EMR record is not affected.`)) return;
    try {
      await saveQueue.current;
      await session.deleteCase(caseData.encounterId);
      revisionByEncounter.current.delete(caseData.encounterId);
      startNewCase();
      await refreshSavedCases();
    } catch (error) {
      setStorageStatus("failed");
      setStorageMessage(error instanceof Error ? error.message : "Could not clear the current protected case.");
    }
  }

  async function resetAllSavedCases() {
    const confirmation = window.prompt(`Type DELETE ${savedCases.length} CASES to remove every protected local case. ClearDent and Dentrix records are not affected.`);
    if (confirmation !== `DELETE ${savedCases.length} CASES`) return;
    try {
      await saveQueue.current;
      await session.clearCases();
      revisionByEncounter.current.clear();
      setSavedCases([]);
      startNewCase();
    } catch (error) {
      setStorageStatus("failed");
      setStorageMessage(error instanceof Error ? error.message : "Could not reset protected cases.");
    }
  }

  function downloadCaseJson() {
    if (!window.confirm("Download a plaintext NodeDent case JSON? It contains the chart number and full clinical workflow record. Store and transfer it only through approved clinic systems.")) return;
    const exportCase = { ...caseData, revision: revisionByEncounter.current.get(caseData.encounterId) || caseData.revision || 0 };
    downloadFile(
      JSON.stringify(buildJsonExport(exportCase, currentNodeId), null, 2),
      "application/json",
      buildClinicalExportFilename(exportCase, "json")
    );
  }

  async function downloadEncryptedVaultBackup() {
    try {
      await saveQueue.current;
      const backup = await session.exportEncryptedBackup();
      downloadFile(JSON.stringify(backup), "application/octet-stream", buildVaultBackupFilename());
    } catch (error) {
      setStorageStatus("failed");
      setStorageMessage(error instanceof Error ? error.message : "Could not export the encrypted vault backup.");
    }
  }

  function downloadDisplayedText() {
    if (noteMode === "json") {
      downloadCaseJson();
      return;
    }
    if (!window.confirm("Download this plaintext clinical output? Verify the chart number and destination record in ClearDent or Dentrix.")) return;
    downloadFile(displayedNote, "text/plain;charset=utf-8", buildClinicalExportFilename(caseData, "txt"));
  }

  function importCaseJson() {
    try {
      if (importText.length > 1_000_000) throw new Error("Case JSON exceeds the 1 MB import limit.");
      const parsed = JSON.parse(importText);
      if (parsed?.exportKind !== "nodedent-case") throw new Error("A versioned NodeDent case export is required.");
      if (parsed?.schemaVersion !== 1) throw new Error("Unsupported or missing case schema version.");
      const validation = EndoCaseSchema.safeParse(normalizeImportedEndoCase(parsed));
      if (!validation.success) throw new Error(`Invalid case structure: ${validation.error.issues[0]?.message || "schema validation failed"}`);
      const imported = validation.data as EndoCase;
      const duplicate = savedCases.find((item) => item.id === imported.encounterId);
      if (duplicate && !window.confirm(`Replace the protected local case for chart ${duplicate.patientNumber} with this explicitly imported JSON?`)) return;
      if (!duplicate) imported.encounterId = createEncounterId();
      imported.caseStatus = hydrateCaseStatusOverride(parsed);
      imported.revision = duplicate?.revision || 0;
      revisionByEncounter.current.set(imported.encounterId, duplicate?.revision || 0);
      setCaseData(imported);
      setCurrentNodeId(getSavedCurrentNodeId(imported));
      setHistory([]);
      setShowImportBox(false);
      setIsWorkflowLauncherOpen(false);
      setIsSavedCasesOpen(false);
      setImportText("");
      setValidationMessage(null);
    } catch (error) {
      setValidationMessage({ optionLabel: "Import JSON", missing: [error instanceof Error ? error.message : "Invalid JSON or unsupported case format"] });
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
      setCopyError("");
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
      setCopyError("Clipboard access was blocked. Select the preview text and copy it manually.");
    }
  }

  if (!isVaultReady) {
    return (
      <main className="min-h-screen bg-brand-light-slate p-4 text-brand-navy">
        <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-2xl place-items-center">
          <section className="w-full rounded-3xl border border-brand-light-node bg-white p-6 shadow-xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-slate">NodeDent protected clinical workspace</p>
            <h1 className="mt-2 text-2xl font-bold">{storageStatus === "failed" ? "Protected storage could not open" : "Opening protected storage…"}</h1>
            <p role={storageStatus === "failed" ? "alert" : "status"} className={`mt-3 rounded-2xl border p-4 text-sm leading-6 ${storageStatus === "failed" ? "border-red-300 bg-red-50 text-red-900" : "border-brand-light-node bg-brand-light-slate text-brand-slate"}`}>
              {storageMessage}
            </p>
            <button type="button" onClick={() => void lockVault(false)} className="mt-4 rounded-xl border border-brand-light-node bg-white px-4 py-2 text-sm font-semibold hover:bg-brand-light-slate">
              Return to vault lock screen
            </button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-brand-light-slate p-4 text-brand-navy">
      <div className="mx-auto max-w-[96rem] space-y-4">
        <ClinicalDataNotice />
        {!persistentStorage ? (
          <div role="status" className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            This browser did not grant persistent storage. It may remove the encrypted vault under storage pressure; download encrypted backups regularly.
          </div>
        ) : null}
        {storageStatus === "failed" || storageStatus === "conflict" ? (
          <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between">
            <p><strong>Protected autosave needs attention.</strong> {storageMessage} The current in-memory work will not overwrite a newer record. If clinic policy permits, export the current plaintext JSON before locking; otherwise lock and reopen the protected case.</p>
            <button type="button" onClick={downloadCaseJson} className="shrink-0 rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-bold text-red-900 hover:bg-red-100">Export current JSON</button>
          </div>
        ) : null}
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
              <span className="inline-flex min-h-9 items-center justify-center rounded-full border border-brand-light-node bg-brand-light-slate px-3 py-1.5 font-semibold leading-none text-brand-slate">Chart: {caseData.patientNumber || "—"}</span>
              <span className="inline-flex min-h-9 items-center justify-center rounded-full border border-brand-light-node bg-brand-light-slate px-3 py-1.5 font-semibold leading-none text-brand-slate">Tooth: {caseData.tooth || "—"}</span>
              <span className="inline-flex min-h-9 items-center justify-center rounded-full border border-brand-light-node bg-brand-light-slate px-3 py-1.5 font-semibold leading-none text-brand-slate">{getCaseStatus(caseData)}</span>
              <span
                role="status"
                className={`inline-flex min-h-9 items-center justify-center rounded-full border px-3 py-1.5 font-semibold leading-none ${storageStatus === "failed" || storageStatus === "conflict" ? "border-red-300 bg-red-50 text-red-900" : storageStatus === "saving" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-brand-light-node bg-brand-light-slate text-brand-slate"}`}
              >
                Vault: {storageMessage}
              </span>
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
              {isEndodonticWorkflowActive ? (
                <button
                  type="button"
                  onClick={openPriorVisit}
                  className={headerActionButton.warning}
                >
                  Prior visit
                </button>
              ) : null}
              <button
                type="button"
                onClick={openNewCaseConfirm}
                className={headerActionButton.secondary}
              >
                New case
              </button>
              <button
                type="button"
                onClick={() => void lockVault()}
                className={headerActionButton.secondary}
              >
                Lock vault
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
              onOpenRadiologyWorkflow={() => openRadiologyWorkflow()}
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
              onOpenRadiologyWorkflow={openRadiologyWorkflow}
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
                  latestRestorationEvent={latestOperativeRestorationEvent}
                  onSetupChange={updateOperativeSetup}
                  onRecordRestoration={recordOperativeRestoration}
                />
              )}

          <aside className="order-4 min-w-0 space-y-4 lg:col-span-2 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 xl:col-span-3 xl:col-start-1 xl:row-start-2 2xl:col-span-1 2xl:col-start-4 2xl:row-start-1 2xl:block 2xl:space-y-4">
            <NotePreview
              noteMode={noteMode}
              displayedNote={displayedNote}
              copied={copied}
              copyError={copyError}
              onNoteModeChange={(mode) => {
                setNoteMode(mode);
                setCopyError("");
              }}
              onCopyDisplayedNote={copyDisplayedNote}
              onDownloadDisplayedText={downloadDisplayedText}
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
            onOpenRadiologyWorkflow={() => openRadiologyWorkflow()}
          />
        ) : null}

        {isCasePanelOpen ? (
          <CaseManagementModal
            caseData={caseData}
            activeCanal={activeCanal}
            activeWorkflowId={casePanelWorkflowId}
            currentNodeId={casePanelWorkflowId === operativeDirectRestorationWorkflowId ? "operative-readiness" : currentNodeId}
            operativeSetup={operativeSetup}
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
            onRecordRadiologyEvent={recordRadiologyEvent}
            onOpenAnesthesiaWorkflow={openAnesthesiaWorkflow}
            onOpenIsolationWorkflow={openIsolationWorkflow}
            onOpenRadiologyWorkflow={openRadiologyWorkflow}
            onOpenOperativeWorkflowSetup={openOperativeWorkflowSetupFromCasePanel}
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
            latestRadiologyEvent={activeReadinessSummary.radiographs.sourceEvent || latestRadiologyEvent}
            userAnesthesiaCatalogItems={userAnesthesiaCatalogItems}
            onUserAnesthesiaCatalogItemsChange={updateUserAnesthesiaCatalogItems}
            userIsolationCatalogItems={userIsolationCatalogItems}
            onUserIsolationCatalogItemsChange={updateUserIsolationCatalogItems}
            onClose={() => setEmbeddedWorkflowLaunch(null)}
            onRecordAnesthesiaEvent={recordAnesthesiaEvent}
            onRecordIsolationEvent={recordIsolationEvent}
            onRecordRadiologyEvent={recordRadiologyEvent}
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
            onDownloadEncryptedVaultBackup={downloadEncryptedVaultBackup}
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
              <p className="mt-2 text-sm leading-6 text-brand-slate">The current case is autosaved in the encrypted local vault. Starting a new case clears the active workspace and returns the workflow to pre-op.</p>
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
