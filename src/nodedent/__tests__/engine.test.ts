import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { EndoCase } from "../types";
import { ActiveWorkflowTargetPanel } from "../components/ActiveWorkflowTargetPanel";
import { CaseManagementModal } from "../components/CaseManagementModal";
import { OperativeWorkflowRunner } from "../components/OperativeWorkflowRunner";
import { getSharedReadinessActions, SharedReadinessCard } from "../components/SharedReadinessCard";
import { SharedWorkflowRunnerModal } from "../components/SharedWorkflowRunnerModal";
import { WorkflowLauncher } from "../components/WorkflowLauncher";
import { applyDecision } from "../engine/applyDecision";
import { getCanalStatus, statusLabels } from "../engine/deriveCanalStatus";
import { getCanalsBlockingClosure, getMissingRequirements } from "../engine/validateDecision";
import { buildCompactNote } from "../notes/buildCompactNote";
import { buildFullNote } from "../notes/buildFullNote";
import { buildJsonExport } from "../notes/buildJsonExport";
import { buildPatientSummary } from "../notes/buildPatientSummary";
import { eventFragment } from "../notes/fragments";
import { inferCurrentNodeIdFromEvents } from "../engine/getCurrentNode";
import { getManualResumeNodeForCanal } from "../engine/resume";
import { getNextRecommendedNodeForCanal, getPhaseAwareCanalTargets } from "../protocol/continuation";
import { handoffNodeIds, protocolNodes } from "../protocol/nodes";
import { CanalRecordSchema, RadiographStatusSchema } from "../schemas/CanalRecord.schema";
import { ClinicalEventSchema } from "../schemas/ClinicalEvent.schema";
import { EndoCaseSchema } from "../schemas/EndoCase.schema";
import { loadUserAnesthesiaCatalogItems, saveUserAnesthesiaCatalogItems, USER_ANESTHESIA_CATALOG_STORAGE_KEY } from "../state/anesthesiaCatalogPersistence";
import { loadUserIsolationCatalogItems, saveUserIsolationCatalogItems, USER_ISOLATION_CATALOG_STORAGE_KEY } from "../state/isolationCatalogPersistence";
import { blankCanal, hydrateCanalEventsFromGlobalEvents, initialCase, normalizeImportedEndoCase } from "../state/persistence";
import {
  anesthesiaAdequacyResponses,
  anesthesiaEventTypes,
  anesthesiaRoutes,
  buildAnesthesiaAdequateCapability,
  getAnesthesiaAdequateCapabilityOutput,
  getAnesthesiaEventDetails,
  getAnesthesiaScopeFromEvent,
  isAdequateAnesthesiaResponse,
  isAnesthesiaAdequacyResponse,
  isAnesthesiaRoute,
  sharedAnesthesiaWorkflow,
  sharedAnesthesiaWorkflowId,
} from "../workflow/anesthesia";
import { anesthesiaCatalogOwnership, buildUserAnesthesiaCatalogItemsFromForm, createUserAnesthesiaCatalogItem, createUserAnesthesiaCatalogOverride, getAnesthesiaCatalogOptions, seedAnesthesiaCatalogItems } from "../workflow/anesthesiaCatalog";
import { buildAnesthesiaEventFromForm, defaultAnesthesiaFormState } from "../workflow/anesthesiaForm";
import type { CatalogItem } from "../workflow/catalogs";
import { getCatalogLabels, mergeCatalogItems } from "../workflow/catalogs";
import { capabilityScopeRules, knownCapabilityNames } from "../workflow/capabilities";
import { buildIsolationEstablishedCapability, getIsolationCoverageSummary, getIsolationEventDetails, isolationEventTypes, sharedIsolationWorkflow, sharedIsolationWorkflowId } from "../workflow/isolation";
import { buildUserIsolationCatalogItemsFromForm, createUserIsolationCatalogItem, createUserIsolationCatalogOverride, getIsolationCatalogOptions, isolationCatalogOwnership, seedIsolationCatalogItems } from "../workflow/isolationCatalog";
import {
  blankOperativeWorkflowSetup,
  buildFinalRestorationPlacedCapability,
  buildOperativeSetupEventDetails,
  buildOperativeRestorationEventDetails,
  buildOperativeRestorationPlacedEvent,
  createOperativeReadinessScopes,
  createOperativeRestorationScope,
  getLatestOperativeWorkflowSetup,
  getOperativeSetupFromEvent,
  getOperativeReadinessCapabilitySummary,
  getOperativeRestorationEvents,
  getOperativeRestorationRecordFromEvent,
  normalizeOperativeSurfaces,
  createOperativeSurfaceScope,
  finalRestorationPlacedEventType,
  isEndodonticCanalScope,
  isOperativeRestorationPlacedEvent,
  isOperativeSurfaceScope,
  operativeDirectRestorationWorkflowId,
  operativeDirectRestorationWorkflow,
  operativeReadinessCapabilityRequirements,
  operativeRestorationOutputCapabilities,
  operativeScopeRecordedEventType,
  scopesTargetDifferentToothSubstructures,
  sharedDiagnosisWorkflowId,
  upsertOperativeScopeRecordedEvent,
} from "../workflow/operative";
import {
  buildRadiographsReviewedCapability,
  formatRadiologyEventFragment,
  getRadiologyEventDetails,
  getRadiologyScopeFromEvent,
  radiologyEventTypes,
  sharedRadiologyWorkflowId,
} from "../workflow/radiology";
import {
  endodonticRootWorkflow,
  endodonticRootWorkflowId,
  getReadyWorkflowLauncherEntries,
  getSharedModuleLauncherEntries,
  workflowLauncherEntries,
} from "../workflow/registry";
import { getCapabilityStatus, getCaseCapabilitySummary, isCapabilitySatisfied } from "../workflow/selectors";
import { getWorkflowTargetPanelKind, workflowHasEndodonticTargetPanel, workflowHasOperativeTargetPanel } from "../workflow/targetPanels";

function baseCase(overrides: Partial<EndoCase> = {}): EndoCase {
  const canal = {
    ...blankCanal("MB"),
    estimatedWorkingLength: "20",
    referencePoint: "MB cusp",
  };

  return {
    ...initialCase,
    patientNumber: "123",
    tooth: "30",
    preOp: { ...initialCase.preOp, estimatedChamberDepth: "5" },
    currentCanal: "MB",
    canals: [canal],
    globalEvents: [],
    ...overrides,
  };
}

function listFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function memoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

function applyFirstOption(caseData: EndoCase, currentNodeId: string) {
  const option = protocolNodes[currentNodeId].options[0];
  const result = applyDecision({
    currentNodeId,
    selectedOptionLabel: option.label,
    caseData,
    activeCanalName: caseData.currentCanal,
    eventId: `evt_${currentNodeId}`,
    timestamp: "2026-01-01T00:00:00.000Z",
  });

  assert.deepEqual(result.errors, [], `${currentNodeId} should apply without validation errors`);
  assert.equal(result.generatedEvent?.type, option.noteEvent?.type);
  return result;
}

function applyOption(caseData: EndoCase, currentNodeId: string, optionIndex: number) {
  const option = protocolNodes[currentNodeId].options[optionIndex];
  const result = applyDecision({
    currentNodeId,
    selectedOptionLabel: option.label,
    caseData,
    activeCanalName: caseData.currentCanal,
    eventId: `evt_${currentNodeId}_${optionIndex}`,
    timestamp: "2026-01-01T00:00:00.000Z",
  });

  assert.deepEqual(result.errors, [], `${currentNodeId} option ${optionIndex} should apply without validation errors`);
  assert.equal(result.generatedEvent?.type, option.noteEvent?.type);
  return result;
}

function coneFitReadyCase(overrides: Partial<EndoCase> = {}): EndoCase {
  return baseCase({
    canals: [
      {
        ...blankCanal("MB"),
        estimatedWorkingLength: "20",
        eal0: "20",
        patencyLength: "21",
        shapingLength: "19",
        referencePoint: "MB cusp",
        finalShape: "30/.04",
        obturationGauge: "30",
        masterCone: "30/.04",
        coneFitRadiograph: "acceptable",
        dryingStatus: "dry",
        events: [
          { id: "evt_cone_pa", timestamp: "2026-01-01T00:00:00.000Z", type: "coneFit.radiographAcceptable", canal: "MB" },
        ],
      },
    ],
    globalEvents: [
      { id: "evt_cone_pa", timestamp: "2026-01-01T00:00:00.000Z", type: "coneFit.radiographAcceptable", canal: "MB" },
    ],
    ...overrides,
  });
}

function postShapingCase(overrides: Partial<EndoCase> = {}): EndoCase {
  return baseCase({
    canals: [
      {
        ...blankCanal("MB"),
        estimatedWorkingLength: "20",
        eal0: "20",
        patencyLength: "21",
        shapingLength: "19",
        referencePoint: "MB cusp",
        finalShape: "30/.04",
        obturationGauge: "30",
        masterCone: "30/.04",
        coneFitRadiograph: "acceptable",
      },
    ],
    ...overrides,
  });
}

test("engine and notes modules stay free of React, DOM, and browser storage dependencies", () => {
  const moduleRoots = [join(process.cwd(), "src/nodedent/engine"), join(process.cwd(), "src/nodedent/notes")];
  const forbiddenPatterns = [
    /from ["']react["']/,
    /\bwindow\b/,
    /\bdocument\b/,
    /\blocalStorage\b/,
    /\bnavigator\b/,
  ];

  moduleRoots.flatMap(listFiles).forEach((file) => {
    const source = readFileSync(file, "utf8");
    forbiddenPatterns.forEach((pattern) => {
      assert.equal(pattern.test(source), false, `${file} should not match ${pattern}`);
    });
  });
});

test("protocol option targets resolve to existing nodes", () => {
  Object.values(protocolNodes).forEach((node) => {
    node.options.forEach((option) => {
      assert.ok(
        protocolNodes[option.nextNodeId],
        `${node.id} option "${option.label}" points to missing node ${option.nextNodeId}`
      );
    });
  });
});

test("new cases leave radiograph review unchecked by default", () => {
  assert.equal(initialCase.preOp.radiographsReviewed, false);
  assert.equal(initialCase.preOp.paReviewed, false);
  assert.equal(initialCase.preOp.bwReviewed, false);
  assert.equal(initialCase.preOp.cbctReviewed, false);
  assert.equal(initialCase.priorVisit?.priorRadiographsAvailable, false);
});

test("shared radiology reviewed events satisfy radiograph readiness", () => {
  const event = {
    id: "evt_radiology_reviewed",
    timestamp: "2026-06-20T20:00:00.000Z",
    type: radiologyEventTypes.reviewed,
    workflowId: sharedRadiologyWorkflowId,
    scope: { kind: "custom" as const, teeth: ["36", "37"], regionLabel: "Q3" },
    tooth: "36",
    details: {
      modalities: ["pa", "cbct"],
      teeth: ["36", "37"],
      regionLabel: "Q3",
      imageDate: "2026-06-20",
      sourceLabel: "current visit",
      limitations: "limited distal view",
      notes: "reviewed by clinician",
    },
  };
  const caseData = baseCase({
    tooth: "36",
    preOp: { ...initialCase.preOp },
    globalEvents: [
      {
        ...event,
        capabilitiesSatisfied: [buildRadiographsReviewedCapability(event)],
      },
    ],
  });
  const status = getCapabilityStatus(caseData, "radiographs.reviewed", { kind: "tooth", tooth: "36" });

  assert.equal(status.satisfied, true);
  assert.equal(status.source, "event");
  assert.equal(status.summary, "Radiographs reviewed");
  assert.equal(isCapabilitySatisfied(caseData, "radiographs.reviewed", { kind: "tooth", tooth: "30" }), false);
  assert.deepEqual(getRadiologyScopeFromEvent(event), { kind: "custom", teeth: ["36", "37"], regionLabel: "Q3" });
  assert.deepEqual(getRadiologyEventDetails(event).modalities, ["pa", "cbct"]);
  assert.match(formatRadiologyEventFragment(event), /Radiograph review recorded \(modalities: PA, CBCT; teeth 36, 37; image date: 2026-06-20; source: current visit; limitations: limited distal view\)/);
  assert.match(eventFragment(event), /reviewed by clinician/);
  assert.match(buildFullNote(caseData), /Radiology:\n- Radiograph review recorded/);
  assert.equal(ClinicalEventSchema.safeParse(caseData.globalEvents[0]).success, true);
});

test("handoff nodes are intentional and resolvable", () => {
  const expectedHandoffs = [
    "identify-canals",
    "estimate-wl",
    "advance-10c",
    "patency-10c",
    "gauge-final-shape",
    "remove-smear-layer",
    "ready-for-obturation",
    "ready-for-sealer-cone-seating",
    "canal-obturation-complete",
    "endodontic-pathway-complete",
  ];

  assert.deepEqual([...handoffNodeIds].sort(), expectedHandoffs.sort());
  expectedHandoffs.forEach((nodeId) => {
    assert.ok(protocolNodes[nodeId], `Handoff node ${nodeId} should exist`);
  });
});

test("workflow target panel routing keeps operative workflows out of the endodontic canal panel", () => {
  assert.equal(getWorkflowTargetPanelKind(endodonticRootWorkflowId), "endodontic");
  assert.equal(workflowHasEndodonticTargetPanel(endodonticRootWorkflowId), true);
  assert.equal(workflowHasOperativeTargetPanel(endodonticRootWorkflowId), false);

  assert.equal(getWorkflowTargetPanelKind(operativeDirectRestorationWorkflowId), "operative");
  assert.equal(workflowHasEndodonticTargetPanel(operativeDirectRestorationWorkflowId), false);
  assert.equal(workflowHasOperativeTargetPanel(operativeDirectRestorationWorkflowId), true);

  assert.equal(getWorkflowTargetPanelKind(sharedAnesthesiaWorkflowId), "none");
  assert.equal(getWorkflowTargetPanelKind(sharedIsolationWorkflowId), "none");
  assert.equal(getWorkflowTargetPanelKind("future.cleaning"), "none");
  assert.equal(workflowHasEndodonticTargetPanel(sharedAnesthesiaWorkflowId), false);
  assert.equal(workflowHasOperativeTargetPanel(sharedIsolationWorkflowId), false);
});

test("case setup hides endodontic active-canal setup for operative workflows", () => {
  const caseData = baseCase();
  const noop = () => {};
  const markup = renderToStaticMarkup(React.createElement(CaseManagementModal, {
    caseData,
    activeCanal: caseData.canals[0],
    activeWorkflowId: operativeDirectRestorationWorkflowId,
    currentNodeId: "operative-readiness",
    onClose: noop,
    onUpdateCase: noop,
    onUpdateDiagnosis: noop,
    onUpdatePreOp: noop,
    onUpdateActiveCanal: noop,
    operativeSetup: {
      tooth: "36",
      surfaces: "MO",
      restorationIntent: "direct restoration",
      material: "composite",
      shade: "A2",
    },
    onApplySuggestedCaseStatus: noop,
    onRecordAnesthesiaEvent: noop,
    onRecordIsolationEvent: noop,
    onOpenAnesthesiaWorkflow: noop,
    onOpenIsolationWorkflow: noop,
    onOpenOperativeWorkflowSetup: noop,
    onDownloadCaseJson: noop,
  }));

  assert.equal(markup.includes("Case identity"), true);
  assert.equal(markup.includes("Shared readiness"), true);
  assert.equal(markup.includes("Operative setup"), true);
  assert.equal(markup.includes("Operative setup summary"), true);
  assert.equal(markup.includes("Edit tooth and surface scope in the active operative workflow."), true);
  assert.equal(markup.includes("Open operative workflow"), true);
  assert.equal(markup.includes("36 MO"), true);
  assert.equal(markup.includes("placeholder=\"e.g., M O\""), false);
  assert.equal(markup.includes("Diagnosis readiness"), true);
  assert.equal(markup.includes("Radiograph readiness"), true);
  assert.equal(markup.includes("Shared radiology event"), true);
  assert.equal(markup.includes("Record radiograph review"), true);
  assert.equal(markup.includes("Endodontic setup"), false);
  assert.equal(markup.includes("Endodontic workflow setup"), false);
  assert.equal(markup.includes("Estimated WL for"), false);
  assert.equal(markup.includes("Active canal status"), false);
});

test("case setup hides workflow target setup for shared module contexts", () => {
  const caseData = baseCase();
  const noop = () => {};
  const markup = renderToStaticMarkup(React.createElement(CaseManagementModal, {
    caseData,
    activeCanal: caseData.canals[0],
    activeWorkflowId: sharedAnesthesiaWorkflowId,
    currentNodeId: "anesthesia-select-route",
    onClose: noop,
    onUpdateCase: noop,
    onUpdateDiagnosis: noop,
    onUpdatePreOp: noop,
    onUpdateActiveCanal: noop,
    onApplySuggestedCaseStatus: noop,
    onRecordAnesthesiaEvent: noop,
    onRecordIsolationEvent: noop,
    onOpenAnesthesiaWorkflow: noop,
    onOpenIsolationWorkflow: noop,
    onDownloadCaseJson: noop,
  }));

  assert.equal(markup.includes("Case identity"), true);
  assert.equal(markup.includes("Shared readiness"), true);
  assert.equal(markup.includes("Endodontic setup"), false);
  assert.equal(markup.includes("Endodontic workflow setup"), false);
  assert.equal(markup.includes("Operative setup"), false);
  assert.equal(markup.includes("Estimated WL for"), false);
});

test("case setup opens anesthesia and isolation catalogs from inline shortcut manager actions", () => {
  const caseData = baseCase();
  const noop = () => {};
  const markup = renderToStaticMarkup(React.createElement(CaseManagementModal, {
    caseData,
    activeCanal: caseData.canals[0],
    activeWorkflowId: sharedAnesthesiaWorkflowId,
    currentNodeId: "anesthesia-select-route",
    onClose: noop,
    onUpdateCase: noop,
    onUpdateDiagnosis: noop,
    onUpdatePreOp: noop,
    onUpdateActiveCanal: noop,
    onApplySuggestedCaseStatus: noop,
    onRecordAnesthesiaEvent: noop,
    onRecordIsolationEvent: noop,
    onOpenAnesthesiaWorkflow: noop,
    onOpenIsolationWorkflow: noop,
    onUserAnesthesiaCatalogItemsChange: noop,
    onUserIsolationCatalogItemsChange: noop,
    onDownloadCaseJson: noop,
  }));

  assert.equal(markup.includes("Save shortcuts"), true);
  assert.equal(markup.includes("Manage shortcuts"), true);
  assert.equal(markup.includes("Favorites appear first in the selected field"), false);
});

test("active workflow target panel renders operative setup without canal controls", () => {
  const caseData = baseCase({ tooth: "36" });
  const noop = () => {};
  const markup = renderToStaticMarkup(React.createElement(ActiveWorkflowTargetPanel, {
    activeWorkflowId: operativeDirectRestorationWorkflowId,
    endodonticProps: {
      caseData,
      newCanalName: "",
      renameCanalName: "",
      onNewCanalNameChange: noop,
      onRenameCanalNameChange: noop,
      onSelectCanal: noop,
      onAddCanal: noop,
      onRenameActiveCanal: noop,
      onDeleteActiveCanal: noop,
      onManualEvent: noop,
      onResetManualStatus: noop,
      onOpenPhaseMap: noop,
    },
    operativeProps: {
      caseData,
      setup: {
        tooth: "36",
        surfaces: "M O",
        restorationIntent: "direct restoration",
        material: "composite",
        shade: "A2",
      },
      onSetupChange: noop,
    },
  }));

  assert.equal(markup.includes("Operative setup"), true);
  assert.equal(markup.includes("Current operative scope"), true);
  assert.equal(markup.includes("36 MO"), true);
  assert.equal(markup.includes("Endodontic progress"), false);
  assert.equal(markup.includes("Active canal status"), false);
});

test("shared readiness actions open reusable setup and module paths for operative context", () => {
  const caseData = baseCase({
    diagnosis: { pulpal: "normal pulp", apical: "normal apical tissues" },
    preOp: { ...initialCase.preOp, paReviewed: true },
  });
  const caseSetupTargets: string[] = [];
  const anesthesiaEntries: Array<string | undefined> = [];
  const isolationEntries: Array<string | undefined> = [];
  const actions = getSharedReadinessActions({
    capabilitySummary: getCaseCapabilitySummary(caseData),
    onOpenCaseSetupStatus: (focusTarget) => caseSetupTargets.push(focusTarget || ""),
    onOpenAnesthesiaWorkflow: (entryNodeId) => anesthesiaEntries.push(entryNodeId),
    onOpenIsolationWorkflow: (entryNodeId) => isolationEntries.push(entryNodeId),
  });

  assert.deepEqual(actions.map((action) => action.label), ["Diagnosis", "Radiographs", "Anesthesia", "Isolation"]);
  actions.find((action) => action.label === "Diagnosis")?.onClick();
  actions.find((action) => action.label === "Radiographs")?.onClick();
  actions.find((action) => action.label === "Anesthesia")?.onClick();
  actions.find((action) => action.label === "Isolation")?.onClick();

  assert.deepEqual(caseSetupTargets, ["diagnosis", "radiographs"]);
  assert.deepEqual(anesthesiaEntries, [undefined]);
  assert.deepEqual(isolationEntries, [undefined]);
});

test("shared readiness band uses row-specific actions without a generic case setup action", () => {
  const caseData = baseCase({
    diagnosis: { pulpal: "normal pulp", apical: "normal apical tissues" },
    preOp: { ...initialCase.preOp, paReviewed: true },
  });
  const noop = () => {};
  const markup = renderToStaticMarkup(React.createElement(SharedReadinessCard, {
    caseData,
    capabilitySummary: getCaseCapabilitySummary(caseData),
    onOpenCaseSetupStatus: noop,
    onOpenAnesthesiaWorkflow: noop,
    onOpenIsolationWorkflow: noop,
    disabledActionLabels: ["Anesthesia"],
  }));

  assert.equal(markup.includes("Shared readiness"), true);
  assert.equal(markup.includes("Diagnosis"), true);
  assert.equal(markup.includes("Radiographs"), true);
  assert.equal(markup.includes("Anesthesia"), true);
  assert.equal(markup.includes("Isolation"), true);
  assert.equal(markup.includes("Case Setup"), false);
  assert.equal(markup.includes("Currently open in the workspace."), true);
  assert.match(markup, /<button[^>]+disabled=""/);
});

test("shared readiness uses review labels when shared module status already exists", () => {
  const caseData = baseCase({
    tooth: "30",
    globalEvents: [
      {
        id: "evt_anesthesia_ready",
        timestamp: "2026-01-01T10:00:00.000Z",
        type: anesthesiaEventTypes.adequacyConfirmed,
        tooth: "30",
        canal: "N/A",
        details: { response: "adequate", tooth: "30" },
        scope: { kind: "tooth", tooth: "30" },
      },
      {
        id: "evt_isolation_ready",
        timestamp: "2026-01-01T10:05:00.000Z",
        type: isolationEventTypes.rubberDamPlaced,
        tooth: "30",
        canal: "N/A",
        details: { method: "rubberDam", exposedTeeth: ["30"] },
        scope: { kind: "tooth", tooth: "30" },
      },
    ],
  });
  const anesthesiaEntries: Array<string | undefined> = [];
  const isolationEntries: Array<string | undefined> = [];
  const noop = () => {};
  const summary = getCaseCapabilitySummary(caseData);
  const actions = getSharedReadinessActions({
    capabilitySummary: summary,
    onOpenCaseSetupStatus: noop,
    onOpenAnesthesiaWorkflow: (entryNodeId) => anesthesiaEntries.push(entryNodeId),
    onOpenIsolationWorkflow: (entryNodeId) => isolationEntries.push(entryNodeId),
  });
  const markup = renderToStaticMarkup(React.createElement(SharedReadinessCard, {
    caseData,
    capabilitySummary: summary,
    onOpenCaseSetupStatus: noop,
    onOpenAnesthesiaWorkflow: noop,
    onOpenIsolationWorkflow: noop,
  }));

  assert.equal(actions.find((action) => action.label === "Anesthesia")?.actionLabel, "Review anesthesia");
  assert.equal(actions.find((action) => action.label === "Isolation")?.actionLabel, "Review isolation");
  actions.find((action) => action.label === "Anesthesia")?.onClick();
  actions.find((action) => action.label === "Isolation")?.onClick();
  assert.deepEqual(anesthesiaEntries, [undefined]);
  assert.deepEqual(isolationEntries, ["isolation-needs-reassessment"]);
  assert.equal(markup.includes("Review anesthesia"), true);
  assert.equal(markup.includes("Review isolation"), true);
  assert.equal(markup.includes("Open anesthesia workflow"), false);
  assert.equal(markup.includes("Open isolation workflow"), false);
});

test("workflow launcher exposes operative runner entry", () => {
  const noop = () => {};
  const markup = renderToStaticMarkup(React.createElement(WorkflowLauncher, {
    caseData: baseCase(),
    currentNodeTitle: "Pre-op",
    currentNodePhase: "Pre-op",
    savedCaseCount: 0,
    onClose: noop,
    onContinueEndodonticWorkflow: noop,
    onOpenCaseSetupStatus: noop,
    onOpenSavedCases: noop,
    onOpenPriorVisit: noop,
    onOpenNewCaseConfirm: noop,
    onOpenPrimaryWorkflowSetup: noop,
    onOpenAnesthesiaWorkflow: noop,
    onOpenIsolationWorkflow: noop,
  }));

  assert.equal(markup.includes("Operative direct restoration"), true);
  assert.equal(markup.includes("Not started"), true);
  assert.equal(markup.includes("Start workflow"), true);
  assert.equal(markup.includes("Continue workflow"), false);
  assert.equal(markup.includes("Start / resume workflow"), true);
  assert.equal(markup.includes("Model only"), false);
});

test("workflow launcher switches endodontic action after the first node", () => {
  const noop = () => {};
  const markup = renderToStaticMarkup(React.createElement(WorkflowLauncher, {
    caseData: baseCase(),
    currentNodeTitle: "Access pulp chamber",
    currentNodePhase: "Access",
    savedCaseCount: 0,
    onClose: noop,
    onContinueEndodonticWorkflow: noop,
    onOpenCaseSetupStatus: noop,
    onOpenSavedCases: noop,
    onOpenPriorVisit: noop,
    onOpenNewCaseConfirm: noop,
    onOpenPrimaryWorkflowSetup: noop,
    onOpenAnesthesiaWorkflow: noop,
    onOpenIsolationWorkflow: noop,
  }));

  assert.equal(markup.includes("In progress"), true);
  assert.equal(markup.includes("Continue workflow"), true);
});

test("workflow launcher uses review labels for shared modules with current events", () => {
  const noop = () => {};
  const caseData = baseCase({
    tooth: "30",
    globalEvents: [
      {
        id: "evt_anesthesia_ready",
        timestamp: "2026-01-01T10:00:00.000Z",
        type: anesthesiaEventTypes.adequacyConfirmed,
        tooth: "30",
        canal: "N/A",
        details: { response: "adequate", tooth: "30" },
        scope: { kind: "tooth", tooth: "30" },
      },
      {
        id: "evt_isolation_ready",
        timestamp: "2026-01-01T10:05:00.000Z",
        type: isolationEventTypes.rubberDamPlaced,
        tooth: "30",
        canal: "N/A",
        details: { method: "rubberDam", exposedTeeth: ["30"] },
        scope: { kind: "tooth", tooth: "30" },
      },
    ],
  });
  const markup = renderToStaticMarkup(React.createElement(WorkflowLauncher, {
    caseData,
    currentNodeTitle: "Pre-op",
    currentNodePhase: "Pre-op",
    savedCaseCount: 0,
    onClose: noop,
    onContinueEndodonticWorkflow: noop,
    onOpenCaseSetupStatus: noop,
    onOpenSavedCases: noop,
    onOpenPriorVisit: noop,
    onOpenNewCaseConfirm: noop,
    onOpenPrimaryWorkflowSetup: noop,
    onOpenAnesthesiaWorkflow: noop,
    onOpenIsolationWorkflow: noop,
  }));

  assert.equal(markup.includes("Review anesthesia"), true);
  assert.equal(markup.includes("Review isolation"), true);
  assert.match(markup, /Anesthesia[\s\S]*Ready[\s\S]*Review anesthesia/);
  assert.match(markup, /Isolation[\s\S]*Ready[\s\S]*Review isolation/);
  assert.equal(markup.includes("Open anesthesia workflow"), false);
  assert.equal(markup.includes("Open isolation workflow"), false);
});

test("operative runner renders setup record and completion states without readiness duplication or endodontic controls", () => {
  const caseData = baseCase({ tooth: "36" });
  const setup = {
    tooth: "36",
    surfaces: "M O",
    restorationIntent: "direct restoration",
    material: "composite",
    shade: "A2",
  };
  const completionEvent = buildOperativeRestorationPlacedEvent({
    id: "evt_operative_runner_complete",
    timestamp: "2026-01-01T11:00:00.000Z",
    record: {
      ...setup,
      outcome: "placed",
      notes: "Occlusion checked by clinician",
    },
  });
  const noop = () => {};
  const markup = renderToStaticMarkup(React.createElement(OperativeWorkflowRunner, {
    caseData,
    setup,
    latestRestorationEvent: completionEvent,
    onSetupChange: noop,
    onRecordRestoration: noop,
  }));

  assert.equal(markup.includes("Direct restoration"), true);
  assert.equal(markup.includes("Shared readiness"), false);
  assert.equal(markup.includes("Operative setup"), true);
  assert.equal(markup.includes("Restoration record"), true);
  assert.equal(markup.includes("Operative workflow complete"), true);
  assert.equal(markup.includes("Record final restoration"), true);
  assert.equal(markup.includes("Active canal status"), false);
  assert.equal(markup.includes("WL/shape data"), false);
  assert.equal(markup.includes("Decision"), false);
});

test("shared workflow modal uses close labels instead of return labels for dismiss actions", () => {
  const caseData = baseCase();
  const noop = () => {};
  const anesthesiaMarkup = renderToStaticMarkup(React.createElement(SharedWorkflowRunnerModal, {
    launch: {
      workflowId: sharedAnesthesiaWorkflowId,
      entryNodeId: "anesthesia-complete",
      workflowRunId: "run_shared_anesthesia_test",
    },
    caseData,
    parentNodeTitle: "Direct restoration",
    parentWorkflowRunId: "run_parent_test",
    onClose: noop,
    onRecordAnesthesiaEvent: noop,
    onRecordIsolationEvent: noop,
  }));
  const isolationMarkup = renderToStaticMarkup(React.createElement(SharedWorkflowRunnerModal, {
    launch: {
      workflowId: sharedIsolationWorkflowId,
      entryNodeId: "isolation-complete",
      workflowRunId: "run_shared_isolation_test",
    },
    caseData,
    parentNodeTitle: "Direct restoration",
    parentWorkflowRunId: "run_parent_test",
    onClose: noop,
    onRecordAnesthesiaEvent: noop,
    onRecordIsolationEvent: noop,
  }));
  const activeIsolationMarkup = renderToStaticMarkup(React.createElement(SharedWorkflowRunnerModal, {
    launch: {
      workflowId: sharedIsolationWorkflowId,
      entryNodeId: "isolation-select-method",
      workflowRunId: "run_shared_isolation_active_test",
    },
    caseData,
    parentNodeTitle: "Direct restoration",
    parentWorkflowRunId: "run_parent_test",
    onClose: noop,
    onRecordAnesthesiaEvent: noop,
    onRecordIsolationEvent: noop,
    onUserIsolationCatalogItemsChange: noop,
  }));

  assert.equal(anesthesiaMarkup.includes("Close"), true);
  assert.equal(anesthesiaMarkup.includes("Close shared workflow"), true);
  assert.equal(anesthesiaMarkup.includes("Return to parent workflow"), false);
  assert.equal(isolationMarkup.includes("Close"), true);
  assert.equal(isolationMarkup.includes("Close shared workflow"), true);
  assert.equal(isolationMarkup.includes("Return to parent workflow"), false);
  assert.equal(activeIsolationMarkup.includes("Record placement"), true);
  assert.equal(activeIsolationMarkup.includes("Record reassessment"), true);
  assert.equal(activeIsolationMarkup.includes("Record rubber dam placed"), true);
  assert.equal(activeIsolationMarkup.includes("Save shortcuts"), true);
  assert.equal(activeIsolationMarkup.includes("Close shared workflow"), true);
  assert.ok(activeIsolationMarkup.indexOf("Record rubber dam placed") < activeIsolationMarkup.indexOf("Close shared workflow"));
});

test("every protocol note event has a note fragment", () => {
  const noteEventTypes = [
    ...new Set(
      Object.values(protocolNodes).flatMap((node) =>
        node.options.map((option) => option.noteEvent?.type).filter((type): type is string => Boolean(type))
      )
    ),
  ];

  noteEventTypes.forEach((type) => {
    const fragment = eventFragment({
      id: `evt_${type}`,
      timestamp: "2026-01-01T00:00:00.000Z",
      type,
      canal: "MB",
      details: {
        canalSnapshot: {
          estimatedWorkingLength: "20",
          fileTerminalLength: "18",
          availableTreatmentSpace: "17",
          eal0: "20",
          patencyLength: "21",
          shapingLength: "19",
          referencePoint: "MB cusp",
          wlRadiographStatus: "acceptable",
          finalShape: "30/.04",
          obturationGauge: "30",
          masterCone: "30/.04",
          coneFitRadiograph: "acceptable",
        },
      },
    });

    assert.notEqual(fragment, `MB: ${type}.`, `Missing event fragment for ${type}`);
  });
});

test("valid transition produces next node and event", () => {
  const input = baseCase();
  const output = applyDecision({
    currentNodeId: "preop",
    selectedOptionLabel: "Pre-op review complete",
    caseData: input,
    activeCanalName: "MB",
    eventId: "evt_test",
    timestamp: "2026-01-01T00:00:00.000Z",
  });

  assert.deepEqual(output.errors, []);
  assert.equal(output.nextNodeId, "access-chamber");
  assert.equal(output.generatedEvent?.type, "preop.reviewCompleted");
  assert.equal(output.updatedCaseData.globalEvents.length, 1);
});

test("invalid node ID returns an error", () => {
  const output = applyDecision({
    currentNodeId: "bad-node",
    selectedOptionLabel: "Anything",
    caseData: baseCase(),
    activeCanalName: "MB",
  });

  assert.equal(output.errors[0], "Invalid node ID: bad-node");
});

test("invalid option returns an error", () => {
  const output = applyDecision({
    currentNodeId: "preop",
    selectedOptionLabel: "Not an option",
    caseData: baseCase(),
    activeCanalName: "MB",
  });

  assert.equal(output.errors[0], "Invalid option for node preop");
});

test("invalid option ID returns an error", () => {
  const output = applyDecision({
    currentNodeId: "preop",
    selectedOptionId: "bad-option-id",
    caseData: baseCase(),
    activeCanalName: "MB",
  });

  assert.equal(output.errors[0], "Invalid option for node preop");
});

test("difficulty flag is applied", () => {
  const input = baseCase({
    canals: [{ ...blankCanal("MB"), estimatedWorkingLength: "20", availableTreatmentSpace: "17", referencePoint: "MB cusp" }],
  });
  const output = applyDecision({
    currentNodeId: "measure-available-space",
    selectedOptionLabel: "Available treatment space >16 mm",
    caseData: input,
    activeCanalName: "MB",
  });

  assert.deepEqual(output.errors, []);
  assert.equal(output.updatedCaseData.difficulty, "caution");
});

test("input case data is not mutated", () => {
  const input = baseCase();
  const before = JSON.stringify(input);
  applyDecision({
    currentNodeId: "preop",
    selectedOptionLabel: "Pre-op review complete",
    caseData: input,
    activeCanalName: "MB",
  });

  assert.equal(JSON.stringify(input), before);
});

test("ATS 15 blocks >16", () => {
  const caseData = baseCase({ canals: [{ ...blankCanal("MB"), availableTreatmentSpace: "15", referencePoint: "MB cusp" }] });
  const option = protocolNodes["measure-available-space"].options[0];
  assert.ok(getMissingRequirements("measure-available-space", option, caseData, caseData.canals[0]).includes("Available treatment space must be >16 mm for this option"));
});

test("ATS 17 blocks less-or-equal-16 and ATS 16 allows it", () => {
  const option = protocolNodes["measure-available-space"].options[1];
  const greaterThanOption = protocolNodes["measure-available-space"].options[0];
  const ats17 = baseCase({ canals: [{ ...blankCanal("MB"), availableTreatmentSpace: "17", referencePoint: "MB cusp" }] });
  const ats16 = baseCase({ canals: [{ ...blankCanal("MB"), availableTreatmentSpace: "16", referencePoint: "MB cusp" }] });

  assert.ok(getMissingRequirements("measure-available-space", option, ats17, ats17.canals[0]).includes("Available treatment space must be ≤16 mm for this option"));
  assert.deepEqual(getMissingRequirements("measure-available-space", option, ats16, ats16.canals[0]), []);
  assert.ok(getMissingRequirements("measure-available-space", greaterThanOption, ats16, ats16.canals[0]).includes("Available treatment space must be >16 mm for this option"));
});

test("10C branch consistency validation", () => {
  const reached = protocolNodes["advance-10c"].options[0];
  const stopped = protocolNodes["advance-10c"].options[1];
  const shortTerminal = baseCase({ canals: [{ ...blankCanal("MB"), estimatedWorkingLength: "20", fileTerminalLength: "19" }] });
  const equalTerminal = baseCase({ canals: [{ ...blankCanal("MB"), estimatedWorkingLength: "20", fileTerminalLength: "20" }] });

  assert.ok(getMissingRequirements("advance-10c", reached, shortTerminal, shortTerminal.canals[0]).includes("10C terminal length is shorter than estimated WL, so this option cannot be selected"));
  assert.ok(getMissingRequirements("advance-10c", stopped, equalTerminal, equalTerminal.canals[0]).includes("10C terminal length is not shorter than estimated WL, so this option cannot be selected"));
});

test("WL PA blank blocks EAL completion and not taken allows it", () => {
  const option = protocolNodes["establish-eal0"].options[0];
  const blank = baseCase({ canals: [{ ...blankCanal("MB"), eal0: "20", patencyLength: "21", shapingLength: "19", referencePoint: "MB cusp", wlRadiographStatus: "" }] });
  const notTaken = baseCase({ canals: [{ ...blankCanal("MB"), eal0: "20", patencyLength: "21", shapingLength: "19", referencePoint: "MB cusp", wlRadiographStatus: "not taken" }] });

  assert.ok(getMissingRequirements("establish-eal0", option, blank, blank.canals[0]).includes("WL PA status"));
  assert.deepEqual(getMissingRequirements("establish-eal0", option, notTaken, notTaken.canals[0]), []);
});

test("final shaping file validation accepts size/taper and system-specific labels", () => {
  const option = protocolNodes["create-final-shape"].options[0];
  ["30/.04", "25/.06", "PTN X2 25/.06", "PTG F2 25/.08", "WaveOne Gold Primary 25/.07", "Reciproc R25"].forEach((finalShape) => {
    const caseData = baseCase({ canals: [{ ...blankCanal("MB"), finalShape }] });
    assert.deepEqual(getMissingRequirements("create-final-shape", option, caseData, caseData.canals[0]), []);
  });
});

test("final shaping file validation rejects blank values", () => {
  const option = protocolNodes["create-final-shape"].options[0];
  const caseData = baseCase({ canals: [{ ...blankCanal("MB"), finalShape: "" }] });
  assert.ok(getMissingRequirements("create-final-shape", option, caseData, caseData.canals[0]).includes("Final shaping file, e.g. 30/.04 or PTN X2 25/.06"));
});

test("final shaping protocol labels are system-flexible", () => {
  const node = protocolNodes["create-final-shape"];

  assert.equal(node.title, "Complete final shaping");
  assert.equal(node.options[0].label, "Final shaping file reached shaping length");
  assert.equal(node.options[1].label, "Final shaping file did not reach shaping length");
  assert.match(node.chairsideInstruction, /final shaping file\/system/);
});

test("increase shaping gauge loop does not require final shaping file until gauge selection", () => {
  const continueGauging = protocolNodes["increase-shaping-gauge"].options[0];
  const finalGaugeSelected = protocolNodes["increase-shaping-gauge"].options[1];
  const caseData = baseCase({ canals: [{ ...blankCanal("MB"), shapingLength: "19" }] });

  assert.deepEqual(getMissingRequirements("increase-shaping-gauge", continueGauging, caseData, caseData.canals[0]), []);
  assert.ok(getMissingRequirements("increase-shaping-gauge", finalGaugeSelected, caseData, caseData.canals[0]).includes("Final shaping file, e.g. 30/.04 or PTN X2 25/.06"));
});

test("final shaping notes include the recorded file or system", () => {
  const caseData = baseCase({
    canals: [{ ...blankCanal("MB"), finalShape: "PTN X2 25/.06" }],
    globalEvents: [
      {
        id: "evt_shape",
        timestamp: "2026-01-01T00:00:00.000Z",
        type: "shaping.finalShapeAchieved",
        canal: "MB",
        details: { canalSnapshot: { finalShape: "PTN X2 25/.06" } },
      },
    ],
  });

  assert.match(buildCompactNote(caseData), /final shaping file PTN X2 25\/\.06/);
  assert.match(buildFullNote(caseData), /MB final shaping file: PTN X2 25\/\.06/);
  assert.match(buildFullNote(caseData), /MB: Final shaping completed with PTN X2 25\/\.06/);
});

test("final shape gauge options identify the 25 NiTi file", () => {
  const labels = protocolNodes["gauge-final-shape"].options.map((option) => option.label);

  assert.deepEqual(labels, [
    "25 NiTi reaches shaping length with no resistance",
    "25 NiTi reaches within 0 to 2 mm with resistance",
    "25 NiTi more than 2 mm short",
  ]);
});

test("post-shaping protocol chain reaches sealer cone seating handoff", () => {
  let caseData = baseCase({
    canals: [
      {
        ...blankCanal("MB"),
        estimatedWorkingLength: "20",
        eal0: "20",
        patencyLength: "21",
        shapingLength: "19",
        referencePoint: "MB cusp",
        finalShape: "30/.04",
        obturationGauge: "30",
        masterCone: "30/.04",
        coneFitRadiograph: "acceptable",
      },
    ],
  });

  const expectedTransitions = [
    ["irrigate-recapitulate", "remove-smear-layer", "shaping.completed"],
    ["remove-smear-layer", "agitate-edta", "smearLayer.edtaPlaced"],
    ["agitate-edta", "final-naocl", "smearLayer.edtaAgitated"],
    ["final-naocl", "ready-for-obturation", "disinfection.finalNaOClCompleted"],
    ["ready-for-obturation", "gauge-obturation-30", "disinfection.readyForObturation"],
    ["gauge-obturation-30", "record-obturation-gauge", "obturationGauge.size30Stop"],
    ["record-obturation-gauge", "fit-master-cone", "obturationGauge.recorded"],
    ["fit-master-cone", "cone-fit-radiograph", "coneFit.masterConeFits"],
    ["cone-fit-radiograph", "ready-for-sealer-cone-seating", "coneFit.radiographAcceptable"],
    ["ready-for-sealer-cone-seating", "dry-for-obturation", "coneFit.readyForSealerConeSeating"],
  ] as const;

  expectedTransitions.forEach(([currentNodeId, nextNodeId, eventType]) => {
    const result = applyFirstOption(caseData, currentNodeId);
    assert.equal(result.nextNodeId, nextNodeId);
    assert.equal(result.generatedEvent?.type, eventType);
    caseData = result.updatedCaseData;
  });
});

test("post-shaping required fields guard EDTA gauging and cone fit decisions", () => {
  const blank = baseCase({ canals: [{ ...blankCanal("MB") }] });

  assert.ok(getMissingRequirements("remove-smear-layer", protocolNodes["remove-smear-layer"].options[0], blank, blank.canals[0]).includes("Shaping length in mm"));
  assert.ok(getMissingRequirements("remove-smear-layer", protocolNodes["remove-smear-layer"].options[0], blank, blank.canals[0]).includes("Final shaping file, e.g. 30/.04 or PTN X2 25/.06"));
  assert.ok(getMissingRequirements("gauge-obturation-30", protocolNodes["gauge-obturation-30"].options[0], blank, blank.canals[0]).includes("Shaping length in mm"));
  assert.ok(getMissingRequirements("record-obturation-gauge", protocolNodes["record-obturation-gauge"].options[0], blank, blank.canals[0]).includes("Obturation gauge size, e.g. 30"));
  assert.ok(getMissingRequirements("fit-master-cone", protocolNodes["fit-master-cone"].options[0], blank, blank.canals[0]).includes("Master cone, e.g. 30/.04"));
  assert.ok(getMissingRequirements("cone-fit-radiograph", protocolNodes["cone-fit-radiograph"].options[0], blank, blank.canals[0]).includes("Cone fit radiograph status"));
});

test("obturation gauge alternate branches route to expected protocol nodes", () => {
  const caseData = postShapingCase();
  const size30Beyond = applyOption(caseData, "gauge-obturation-30", 1);
  const size30Short = applyOption(caseData, "gauge-obturation-30", 2);
  const size25Stop = applyOption(caseData, "gauge-obturation-25", 0);
  const size25Beyond = applyOption(caseData, "gauge-obturation-25", 1);
  const size25Short = applyOption(caseData, "gauge-obturation-25", 2);
  const largerStop = applyOption(caseData, "gauge-obturation-larger", 0);
  const largerBeyond = applyOption(caseData, "gauge-obturation-larger", 1);

  assert.equal(size30Beyond.nextNodeId, "gauge-obturation-larger");
  assert.equal(size30Beyond.updatedCaseData.difficulty, "caution");
  assert.equal(size30Short.nextNodeId, "gauge-obturation-25");
  assert.equal(size30Short.updatedCaseData.difficulty, "caution");
  assert.equal(size25Stop.nextNodeId, "record-obturation-gauge");
  assert.equal(size25Beyond.nextNodeId, "gauge-obturation-larger");
  assert.equal(size25Beyond.updatedCaseData.difficulty, "caution");
  assert.equal(size25Short.nextNodeId, "patency-10c");
  assert.equal(size25Short.updatedCaseData.difficulty, "high");
  assert.equal(largerStop.nextNodeId, "record-obturation-gauge");
  assert.equal(largerBeyond.nextNodeId, "gauge-obturation-larger");
});

test("obturation gauge alternate branches enforce required measurements", () => {
  const blank = baseCase({ canals: [{ ...blankCanal("MB") }] });
  const noGauge = baseCase({ canals: [{ ...blankCanal("MB"), shapingLength: "19" }] });
  const largerStopOption = protocolNodes["gauge-obturation-larger"].options[0];
  const largerBeyondOption = protocolNodes["gauge-obturation-larger"].options[1];

  assert.ok(getMissingRequirements("gauge-obturation-30", protocolNodes["gauge-obturation-30"].options[1], blank, blank.canals[0]).includes("Shaping length in mm"));
  assert.ok(getMissingRequirements("gauge-obturation-25", protocolNodes["gauge-obturation-25"].options[0], blank, blank.canals[0]).includes("Shaping length in mm"));
  assert.ok(getMissingRequirements("gauge-obturation-larger", largerStopOption, noGauge, noGauge.canals[0]).includes("Obturation gauge size, e.g. 30"));
  assert.deepEqual(getMissingRequirements("gauge-obturation-larger", largerBeyondOption, noGauge, noGauge.canals[0]), []);

  const largerBeyond = applyDecision({
    currentNodeId: "gauge-obturation-larger",
    selectedOptionLabel: largerBeyondOption.label,
    caseData: noGauge,
    activeCanalName: "MB",
  });

  assert.deepEqual(largerBeyond.errors, []);
  assert.equal(largerBeyond.nextNodeId, "gauge-obturation-larger");
  assert.equal(largerBeyond.generatedEvent?.type, "obturationGauge.largerSizeAdvancesBeyond");
});

test("smear layer and final NaOCl deferred routes can medicate and temporize", () => {
  let caseData = postShapingCase();
  let result = applyOption(caseData, "remove-smear-layer", 1);
  assert.equal(result.nextNodeId, "calcium-hydroxide");
  assert.equal(result.generatedEvent?.type, "smearLayer.deferred");

  result = applyFirstOption(result.updatedCaseData, "calcium-hydroxide");
  assert.equal(result.nextNodeId, "temporary-closure");
  assert.equal(result.generatedEvent?.type, "medication.calciumHydroxidePlaced");

  result = applyFirstOption(result.updatedCaseData, "temporary-closure");
  assert.equal(result.nextNodeId, "endodontic-pathway-complete");
  assert.equal(result.generatedEvent?.type, "closure.temporary");

  caseData = postShapingCase();
  result = applyOption(caseData, "agitate-edta", 1);
  assert.equal(result.nextNodeId, "calcium-hydroxide");
  assert.equal(result.generatedEvent?.type, "smearLayer.agitationDeferred");

  caseData = postShapingCase();
  result = applyOption(caseData, "final-naocl", 1);
  assert.equal(result.nextNodeId, "persistent-wet");
  assert.equal(result.generatedEvent?.type, "disinfection.cannotCompleteToday");
  assert.equal(result.updatedCaseData.difficulty, "high");

  result = applyOption(result.updatedCaseData, "persistent-wet", 1);
  assert.equal(result.nextNodeId, "calcium-hydroxide");
  assert.equal(result.generatedEvent?.type, "drying.persistentWetConfirmed");
});

test("realistic PR2 note output includes EDTA NaOCl gauge master cone and cone fit PA", () => {
  let caseData = postShapingCase();

  const path = [
    "remove-smear-layer",
    "agitate-edta",
    "final-naocl",
    "ready-for-obturation",
    "gauge-obturation-30",
    "record-obturation-gauge",
    "fit-master-cone",
    "cone-fit-radiograph",
  ];

  path.forEach((nodeId) => {
    caseData = applyFirstOption(caseData, nodeId).updatedCaseData;
  });

  const compactNote = buildCompactNote(caseData);
  const fullNote = buildFullNote(caseData);

  assert.match(compactNote, /17% EDTA smear layer removal performed/);
  assert.match(compactNote, /Final NaOCl disinfection completed/);
  assert.match(compactNote, /gauge 30/);
  assert.match(compactNote, /MC 30\/.04/);
  assert.match(compactNote, /Master cone fit confirmed radiographically/);
  assert.match(fullNote, /17% EDTA placed/);
  assert.match(fullNote, /Final NaOCl disinfection completed/);
  assert.match(fullNote, /Obturation gauge recorded as 30/);
  assert.match(fullNote, /Master cone selected as 30\/.04/);
  assert.match(fullNote, /Cone fit radiograph acceptable/);
});

test("sealer cone seating handoff enforces required inputs", () => {
  const option = protocolNodes["ready-for-sealer-cone-seating"].options[0];
  const blank = baseCase({ canals: [{ ...blankCanal("MB") }] });
  const complete = baseCase({
    canals: [
      {
        ...blankCanal("MB"),
        shapingLength: "19",
        masterCone: "30/.04",
        coneFitRadiograph: "acceptable",
      },
    ],
  });

  assert.deepEqual(getMissingRequirements("ready-for-sealer-cone-seating", option, blank, blank.canals[0]), [
    "Cone fit radiograph status",
    "Master cone",
    "Shaping length in mm",
  ]);
  assert.deepEqual(getMissingRequirements("ready-for-sealer-cone-seating", option, complete, complete.canals[0]), []);
});

test("sealer and cone seating happy path reaches orifice gap evaluation", () => {
  let caseData = coneFitReadyCase();

  const expectedTransitions = [
    ["ready-for-sealer-cone-seating", "dry-for-obturation", "coneFit.readyForSealerConeSeating"],
    ["dry-for-obturation", "patency-before-sealer", "drying.readyForSealer"],
    ["patency-before-sealer", "apply-sealer", "sealer.patencyConfirmed"],
    ["apply-sealer", "paper-point-through-sealer", "sealer.applied"],
    ["paper-point-through-sealer", "reapply-sealer", "sealer.paperPointDistributed"],
    ["reapply-sealer", "seat-gp-cone", "sealer.reapplied"],
    ["seat-gp-cone", "evaluate-orifice-gap", "gpSeating.coneSeated"],
  ] as const;

  expectedTransitions.forEach(([currentNodeId, nextNodeId, eventType]) => {
    const result = applyFirstOption(caseData, currentNodeId);
    assert.equal(result.nextNodeId, nextNodeId);
    assert.equal(result.generatedEvent?.type, eventType);
    caseData = result.updatedCaseData;
  });

  const fullNote = buildFullNote(caseData);
  assert.match(fullNote, /Canal dried to dry\/slightly damp paper point/);
  assert.match(fullNote, /Bioceramic sealer applied/);
  assert.match(fullNote, /Paper point passed through sealer/);
  assert.match(fullNote, /Pre-fit GP cone seated to shaping length/);
});

test("drying and sealer troubleshooting branches route safely", () => {
  const wet = coneFitReadyCase({ canals: [{ ...coneFitReadyCase().canals[0], dryingStatus: "wet" }] });
  const persistentWet = coneFitReadyCase({ canals: [{ ...coneFitReadyCase().canals[0], dryingStatus: "persistent wet" }] });
  const dryOption = protocolNodes["dry-for-obturation"].options[0];
  const wetResult = applyOption(wet, "dry-for-obturation", 1);
  const persistentWetResult = applyOption(persistentWet, "dry-for-obturation", 2);
  const naviTipUnsafe = applyOption(coneFitReadyCase(), "apply-sealer", 1);
  const paperPointShort = applyOption(coneFitReadyCase(), "paper-point-through-sealer", 1);
  const reapplyUnsafe = applyOption(coneFitReadyCase(), "reapply-sealer", 1);
  const coneShort = applyOption(coneFitReadyCase(), "seat-gp-cone", 1);
  const coneLong = applyOption(coneFitReadyCase(), "seat-gp-cone", 2);

  assert.ok(getMissingRequirements("dry-for-obturation", dryOption, wet, wet.canals[0]).includes("Requires dry or slightly damp"));
  assert.equal(wetResult.nextNodeId, "dry-for-obturation");
  assert.equal(persistentWetResult.nextNodeId, "calcium-hydroxide");
  assert.equal(naviTipUnsafe.nextNodeId, "calcium-hydroxide");
  assert.equal(paperPointShort.nextNodeId, "patency-before-sealer");
  assert.equal(reapplyUnsafe.nextNodeId, "calcium-hydroxide");
  assert.equal(coneShort.nextNodeId, "patency-before-sealer");
  assert.equal(coneLong.nextNodeId, "gauge-obturation-30");
});

test("persistent wet sealer route can medicate and temporize", () => {
  let caseData = coneFitReadyCase({ canals: [{ ...coneFitReadyCase().canals[0], dryingStatus: "persistent wet" }] });

  let result = applyOption(caseData, "dry-for-obturation", 2);
  assert.equal(result.nextNodeId, "calcium-hydroxide");
  caseData = result.updatedCaseData;

  result = applyFirstOption(caseData, "calcium-hydroxide");
  assert.equal(result.nextNodeId, "temporary-closure");
  assert.equal(result.generatedEvent?.type, "medication.calciumHydroxidePlaced");
  caseData = result.updatedCaseData;

  result = applyFirstOption(caseData, "temporary-closure");
  assert.equal(result.nextNodeId, "endodontic-pathway-complete");
  assert.equal(result.generatedEvent?.type, "closure.temporary");
});

test("downpack no-gap path completes canal after vertical compaction", () => {
  let caseData = coneFitReadyCase();

  const expectedTransitions = [
    ["evaluate-orifice-gap", "sear-gp-cones", "downpack.noGapSpace"],
    ["sear-gp-cones", "vertical-compaction", "downpack.gpSeared"],
    ["vertical-compaction", "canal-obturation-complete", "downpack.gpStableAfterCompaction"],
  ] as const;

  expectedTransitions.forEach(([currentNodeId, nextNodeId, eventType]) => {
    const result = applyFirstOption(caseData, currentNodeId);
    assert.equal(result.nextNodeId, nextNodeId);
    assert.equal(result.generatedEvent?.type, eventType);
    caseData = result.updatedCaseData;
  });

  assert.equal(getCanalStatus(caseData.canals[0]), "complete");
  assert.match(buildFullNote(caseData), /GP maintained position after vertical compaction/);
});

test("downpack and backfill branch routes remain clinically connected", () => {
  assert.equal(protocolNodes["evaluate-orifice-gap"].options[0].nextNodeId, "sear-gp-cones");
  assert.equal(protocolNodes["evaluate-orifice-gap"].options[1].nextNodeId, "modified-downpack");
  assert.equal(protocolNodes["evaluate-orifice-gap"].options[2].nextNodeId, "add-accessory-cones");
  assert.equal(protocolNodes["modified-downpack"].options[0].nextNodeId, "reapply-sealer-on-gp");
  assert.equal(protocolNodes["modified-downpack"].options[1].nextNodeId, "modified-downpack");
  assert.equal(protocolNodes["modified-downpack"].options[2].nextNodeId, "fit-master-cone");
  assert.equal(protocolNodes["add-accessory-cones"].options[0].nextNodeId, "sear-gp-cones");
  assert.equal(protocolNodes["add-accessory-cones"].options[1].nextNodeId, "modified-downpack");
  assert.equal(protocolNodes["vertical-compaction"].options[1].nextNodeId, "reapply-sealer-on-gp");
  assert.equal(protocolNodes["backfill-canal"].options[1].nextNodeId, "reapply-sealer-on-gp");
  assert.equal(protocolNodes["compact-backfill"].options[0].nextNodeId, "canal-obturation-complete");
  assert.equal(protocolNodes["compact-backfill"].options[1].nextNodeId, "reapply-sealer-on-gp");
  assert.equal(protocolNodes["compact-backfill"].options[2].nextNodeId, "canal-obturation-complete");
  assert.equal(protocolNodes["compact-backfill"].options[3].nextNodeId, "backfill-canal");
});

test("modified downpack and backfill path reaches canal completion after compaction", () => {
  let caseData = coneFitReadyCase();

  const expectedTransitions = [
    ["evaluate-orifice-gap", 1, "modified-downpack", "downpack.roundGapSpace"],
    ["modified-downpack", 0, "reapply-sealer-on-gp", "downpack.modifiedSuccessful"],
    ["reapply-sealer-on-gp", 0, "backfill-canal", "backfill.sealerOnGp"],
    ["backfill-canal", 0, "compact-backfill", "backfill.completed"],
  ] as const;

  expectedTransitions.forEach(([currentNodeId, optionIndex, nextNodeId, eventType]) => {
    const result = applyOption(caseData, currentNodeId, optionIndex);
    assert.equal(result.nextNodeId, nextNodeId);
    assert.equal(result.generatedEvent?.type, eventType);
    caseData = result.updatedCaseData;
  });

  assert.equal(getCanalStatus(caseData.canals[0]), "disinfected");

  const compacted = applyOption(caseData, "compact-backfill", 0);
  assert.equal(compacted.nextNodeId, "canal-obturation-complete");
  assert.equal(compacted.generatedEvent?.type, "backfill.compactedStable");
  assert.equal(getCanalStatus(compacted.updatedCaseData.canals[0]), "complete");
  assert.match(buildFullNote(compacted.updatedCaseData), /Backfilled GP compacted and remained stable/);
});

test("excess GP after backfill is also treated as canal obturation complete", () => {
  const event = { id: "evt_excess", timestamp: "2026-01-01T00:00:00.000Z", type: "backfill.excessInChamber", canal: "MB" };
  const caseData = coneFitReadyCase({ canals: [{ ...coneFitReadyCase().canals[0], events: [event] }], globalEvents: [event] });

  assert.equal(getCanalStatus(caseData.canals[0]), "complete");
});

test("closure guard blocks final chamber cleanup when another canal is still active", () => {
  const option = protocolNodes["canal-obturation-complete"].options[0];
  const completeEvent = { id: "evt_complete", timestamp: "2026-01-01T00:00:00.000Z", type: "backfill.compactedStable", canal: "MB" };
  const caseData = baseCase({
    currentCanal: "MB",
    canals: [
      { ...blankCanal("MB"), events: [completeEvent] },
      { ...blankCanal("ML"), finalShape: "30/.04" },
      { ...blankCanal("DB"), estimatedWorkingLength: "19" },
    ],
    globalEvents: [completeEvent],
  });

  assert.deepEqual(getCanalsBlockingClosure(caseData), ["ML (Shaped)", "DB (Estimated)"]);
  const missing = getMissingRequirements("canal-obturation-complete", option, caseData, caseData.canals[0]);
  assert.deepEqual(missing, ["Canals not ready for final closure: ML (Shaped), DB (Estimated)"]);

  const result = applyDecision({
    currentNodeId: "canal-obturation-complete",
    selectedOptionLabel: option.label,
    caseData,
    activeCanalName: "MB",
  });
  assert.equal(result.nextNodeId, "canal-obturation-complete");
  assert.deepEqual(result.errors, ["Canals not ready for final closure: ML (Shaped), DB (Estimated)"]);
});

test("closure guard allows complete paused medicated and referred canals", () => {
  const completeEvent = { id: "evt_complete", timestamp: "2026-01-01T00:00:00.000Z", type: "backfill.compactedStable", canal: "MB" };
  const pausedEvent = { id: "evt_paused", timestamp: "2026-01-01T00:00:00.000Z", type: "canal.paused", canal: "ML" };
  const medicatedEvent = { id: "evt_med", timestamp: "2026-01-01T00:00:00.000Z", type: "medication.calciumHydroxidePlaced", canal: "DB" };
  const referredEvent = { id: "evt_ref", timestamp: "2026-01-01T00:00:00.000Z", type: "canal.referred", canal: "DL" };
  const caseData = baseCase({
    currentCanal: "MB",
    canals: [
      { ...blankCanal("MB"), events: [completeEvent] },
      { ...blankCanal("ML"), events: [pausedEvent] },
      { ...blankCanal("DB"), events: [medicatedEvent] },
      { ...blankCanal("DL"), events: [referredEvent] },
    ],
    globalEvents: [completeEvent, pausedEvent, medicatedEvent, referredEvent],
  });

  assert.deepEqual(getCanalsBlockingClosure(caseData), []);
  assert.deepEqual(getMissingRequirements("canal-obturation-complete", protocolNodes["canal-obturation-complete"].options[0], caseData, caseData.canals[0]), []);
});

test("temporary closure requires every existing canal to have declared status", () => {
  const medicationEvent = { id: "evt_med", timestamp: "2026-01-01T00:00:00.000Z", type: "medication.calciumHydroxidePlaced", canal: "MB" };
  const pausedEvent = { id: "evt_pause", timestamp: "2026-01-01T00:00:00.000Z", type: "canal.paused", canal: "ML" };
  const caseData = baseCase({
    currentCanal: "MB",
    canals: [
      { ...blankCanal("MB"), events: [medicationEvent] },
      { ...blankCanal("ML"), events: [pausedEvent] },
      blankCanal("DB"),
    ],
    globalEvents: [medicationEvent, pausedEvent],
  });
  const option = protocolNodes["temporary-closure"].options[0];
  const missing = getMissingRequirements("temporary-closure", option, caseData, caseData.canals[0]);

  assert.deepEqual(missing, ["Canals need declared status before temporary closure: DB (Not started)"]);

  const result = applyDecision({
    currentNodeId: "temporary-closure",
    selectedOptionLabel: option.label,
    caseData,
    activeCanalName: "MB",
  });

  assert.deepEqual(result.errors, ["Canals need declared status before temporary closure: DB (Not started)"]);
  assert.equal(result.nextNodeId, "temporary-closure");
});

test("temporary closure proceeds when every existing canal is declared", () => {
  const medicationEvent = { id: "evt_med", timestamp: "2026-01-01T00:00:00.000Z", type: "medication.calciumHydroxidePlaced", canal: "MB" };
  const pausedEvent = { id: "evt_pause", timestamp: "2026-01-01T00:00:00.000Z", type: "canal.paused", canal: "ML" };
  const referredEvent = { id: "evt_ref", timestamp: "2026-01-01T00:00:00.000Z", type: "canal.referred", canal: "DB" };
  const caseData = baseCase({
    currentCanal: "MB",
    canals: [
      { ...blankCanal("MB"), events: [medicationEvent] },
      { ...blankCanal("ML"), events: [pausedEvent] },
      { ...blankCanal("DB"), events: [referredEvent] },
    ],
    globalEvents: [medicationEvent, pausedEvent, referredEvent],
  });

  const result = applyFirstOption(caseData, "temporary-closure");

  assert.equal(result.nextNodeId, "endodontic-pathway-complete");
  assert.equal(result.generatedEvent?.type, "closure.temporary");
});

test("completed RCT closure records cleanup rinse final restoration and export status", () => {
  let caseData = coneFitReadyCase();
  const completeEvent = { id: "evt_complete", timestamp: "2026-01-01T00:00:00.000Z", type: "backfill.compactedStable", canal: "MB" };
  caseData = {
    ...caseData,
    canals: [{ ...caseData.canals[0], events: [...(caseData.canals[0].events || []), completeEvent] }],
    globalEvents: [...caseData.globalEvents, completeEvent],
  };

  let result = applyFirstOption(caseData, "canal-obturation-complete");
  assert.equal(result.nextNodeId, "cleanup-chamber");
  assert.equal(result.generatedEvent?.type, "workflow.allCanalsReadyForClosure");

  result = applyFirstOption(result.updatedCaseData, "cleanup-chamber");
  assert.equal(result.nextNodeId, "rinse-chamber");
  assert.equal(result.generatedEvent?.type, "closure.chamberGpRemoved");

  result = applyFirstOption(result.updatedCaseData, "rinse-chamber");
  assert.equal(result.nextNodeId, "close-access");
  assert.equal(result.generatedEvent?.type, "closure.chamberRinsed");

  result = applyOption(result.updatedCaseData, "close-access", 2);
  assert.equal(result.nextNodeId, "endodontic-pathway-complete");
  assert.equal(result.generatedEvent?.type, "closure.finalRestoration");
  assert.equal(result.updatedCaseData.closure?.type, "closure.finalRestoration");
  assert.equal(buildJsonExport(result.updatedCaseData, result.nextNodeId).caseStatus, "RCT completed");
  assert.equal(buildJsonExport(result.updatedCaseData, result.nextNodeId).closure?.type, "closure.finalRestoration");
  assert.match(buildCompactNote(result.updatedCaseData), /Visit status: RCT completed/);
  assert.match(buildCompactNote(result.updatedCaseData), /Final restoration placed/);
  assert.match(buildFullNote(result.updatedCaseData), /Pulp chamber rinsed until residual sealer was removed/);
});

test("temporary closure after completed obturation is still a completed RCT", () => {
  const completeEvent = { id: "evt_complete", timestamp: "2026-01-01T00:00:00.000Z", type: "downpack.gpStableAfterCompaction", canal: "MB" };
  const temporaryEvent = { id: "evt_temp", timestamp: "2026-01-01T00:00:00.000Z", type: "closure.temporary", canal: "MB" };
  const caseData = baseCase({
    canals: [{ ...blankCanal("MB"), events: [completeEvent, temporaryEvent] }],
    globalEvents: [completeEvent, temporaryEvent],
    closure: { type: "closure.temporary" },
  });

  assert.equal(getCanalStatus(caseData.canals[0]), "complete");
  assert.equal(buildJsonExport(caseData, "endodontic-pathway-complete").caseStatus, "RCT completed");
  assert.match(buildCompactNote(caseData), /Access closed with sponge and temporary restorative material/);
});

test("medicated temporary closure remains medicated and temporized", () => {
  const medicationEvent = { id: "evt_med", timestamp: "2026-01-01T00:00:00.000Z", type: "medication.calciumHydroxidePlaced", canal: "MB" };
  const temporaryEvent = { id: "evt_temp", timestamp: "2026-01-01T00:00:00.000Z", type: "closure.temporary", canal: "MB" };
  const caseData = baseCase({
    canals: [{ ...blankCanal("MB"), events: [medicationEvent, temporaryEvent] }],
    globalEvents: [medicationEvent, temporaryEvent],
    closure: { type: "closure.temporary" },
    nextVisitPlan: "Continue RCT after medication",
  });

  assert.equal(getCanalStatus(caseData.canals[0]), "medicated");
  assert.equal(buildJsonExport(caseData, "endodontic-pathway-complete").caseStatus, "Medicated and temporized");
  assert.match(buildCompactNote(caseData), /Visit status: Medicated and temporized/);
  assert.match(buildFullNote(caseData), /Next visit \/ plan: Continue RCT after medication/);
});

test("referred closure state remains referred in notes and export", () => {
  const referralEvent = { id: "evt_ref", timestamp: "2026-01-01T00:00:00.000Z", type: "treatment.referralRecommended", canal: "MB" };
  const caseData = baseCase({
    difficulty: "refer",
    canals: [{ ...blankCanal("MB"), events: [referralEvent] }],
    globalEvents: [referralEvent],
  });

  assert.equal(getCanalStatus(caseData.canals[0]), "referred");
  assert.equal(buildJsonExport(caseData, "endodontic-pathway-complete").caseStatus, "Referred");
  assert.match(buildCompactNote(caseData), /Visit status: Referred/);
  assert.match(buildFullNote(caseData), /Referral or specialist continuation recommended/);
});

test("referral documentation can still route to medication and temporary closure", () => {
  let result = applyFirstOption(baseCase(), "refer-pathway");
  assert.equal(result.nextNodeId, "referral-next-step");
  assert.equal(result.generatedEvent?.type, "treatment.referralRecommended");

  result = applyFirstOption(result.updatedCaseData, "referral-next-step");
  assert.equal(result.nextNodeId, "calcium-hydroxide");
  assert.equal(result.generatedEvent?.type, "treatment.medicateTemporizeSelected");

  result = applyFirstOption(result.updatedCaseData, "calcium-hydroxide");
  assert.equal(result.nextNodeId, "temporary-closure");

  result = applyFirstOption(result.updatedCaseData, "temporary-closure");
  assert.equal(result.nextNodeId, "endodontic-pathway-complete");
  assert.equal(buildJsonExport(result.updatedCaseData, result.nextNodeId).caseStatus, "Referred");
  assert.match(buildCompactNote(result.updatedCaseData), /Calcium hydroxide placed/);
  assert.match(buildCompactNote(result.updatedCaseData), /Access closed with sponge and temporary restorative material/);
});

test("referral documentation can finish without medication when appropriate", () => {
  let result = applyFirstOption(baseCase(), "refer-pathway");
  result = applyOption(result.updatedCaseData, "referral-next-step", 1);

  assert.equal(result.nextNodeId, "endodontic-pathway-complete");
  assert.equal(result.generatedEvent?.type, "treatment.referralOnlyCompleted");
  assert.equal(buildJsonExport(result.updatedCaseData, result.nextNodeId).caseStatus, "Referred");
  assert.match(buildFullNote(result.updatedCaseData), /Referral note completed without medication/);
});

test("cone fit troubleshooting branches follow protocol loops", () => {
  const coneShort = protocolNodes["cone-short"].options;
  const coneLong = protocolNodes["cone-long"].options;
  const conePa = protocolNodes["cone-fit-radiograph"].options;

  assert.equal(coneShort[0].nextNodeId, "cone-fit-radiograph");
  assert.equal(coneShort[1].nextNodeId, "create-final-shape");
  assert.equal(coneShort[1].noteEvent?.type, "coneFit.smallerConeStillShort");
  assert.equal(coneShort[2].nextNodeId, "cone-long");
  assert.equal(coneLong[0].nextNodeId, "cone-fit-radiograph");
  assert.equal(coneLong[1].nextNodeId, "cone-short");
  assert.equal(coneLong[2].nextNodeId, "cone-long");
  assert.equal(conePa[0].nextNodeId, "ready-for-sealer-cone-seating");
  assert.equal(conePa[1].nextNodeId, "cone-short");
  assert.equal(conePa[2].nextNodeId, "cone-long");
});

test("cone fit radiograph options must match the recorded PA status", () => {
  const [acceptableOption, shortOption, longOption] = protocolNodes["cone-fit-radiograph"].options;
  const acceptableCase = baseCase({ canals: [{ ...blankCanal("MB"), coneFitRadiograph: "acceptable" }] });
  const shortCase = baseCase({ canals: [{ ...blankCanal("MB"), coneFitRadiograph: "short" }] });
  const longCase = baseCase({ canals: [{ ...blankCanal("MB"), coneFitRadiograph: "long" }] });
  const notTakenCase = baseCase({ canals: [{ ...blankCanal("MB"), coneFitRadiograph: "not taken" }] });

  assert.deepEqual(getMissingRequirements("cone-fit-radiograph", acceptableOption, acceptableCase, acceptableCase.canals[0]), []);
  assert.deepEqual(getMissingRequirements("cone-fit-radiograph", shortOption, shortCase, shortCase.canals[0]), []);
  assert.deepEqual(getMissingRequirements("cone-fit-radiograph", longOption, longCase, longCase.canals[0]), []);

  assert.ok(getMissingRequirements("cone-fit-radiograph", acceptableOption, shortCase, shortCase.canals[0]).includes("Cone fit radiograph status must be acceptable for this option"));
  assert.ok(getMissingRequirements("cone-fit-radiograph", shortOption, acceptableCase, acceptableCase.canals[0]).includes("Cone fit radiograph status must be short for this option"));
  assert.ok(getMissingRequirements("cone-fit-radiograph", longOption, acceptableCase, acceptableCase.canals[0]).includes("Cone fit radiograph status must be long for this option"));
  assert.ok(getMissingRequirements("cone-fit-radiograph", acceptableOption, notTakenCase, notTakenCase.canals[0]).includes("Cone fit radiograph status must be acceptable for this option"));

  const mismatch = applyDecision({
    currentNodeId: "cone-fit-radiograph",
    selectedOptionLabel: acceptableOption.label,
    caseData: shortCase,
    activeCanalName: "MB",
  });
  assert.equal(mismatch.nextNodeId, "cone-fit-radiograph");
  assert.deepEqual(mismatch.errors, ["Cone fit radiograph status must be acceptable for this option"]);
});

test("post-shaping event fragments narrate protocol events", () => {
  const caseData = baseCase({
    canals: [{ ...blankCanal("MB"), shapingLength: "19", obturationGauge: "30", masterCone: "30/.04" }],
  });
  const eventTypes = [
    "obturationGauge.size30Stop",
    "obturationGauge.size25Short",
    "coneFit.masterConeFits",
    "coneFit.smallerConeStillShort",
    "coneFit.trimmedConeFits",
    "coneFit.radiographShort",
    "coneFit.readyForSealerConeSeating",
  ];

  eventTypes.forEach((type) => {
    const fragment = eventFragment({
      id: `evt_${type}`,
      timestamp: "2026-01-01T00:00:00.000Z",
      type,
      canal: "MB",
      details: { canalSnapshot: caseData.canals[0] },
    });

    assert.notEqual(fragment, `MB: ${type}.`);
    assert.match(fragment, /^MB: /);
  });
});

test("canal continuation maps key statuses", () => {
  assert.equal(getNextRecommendedNodeForCanal(blankCanal("MB")).nextNodeId, "estimate-wl");
  assert.equal(getCanalStatus({ ...blankCanal("MB"), estimatedWorkingLength: "20" }), "estimated");
  assert.equal(statusLabels[getCanalStatus({ ...blankCanal("MB"), estimatedWorkingLength: "20" })], "Estimated");
  assert.equal(getNextRecommendedNodeForCanal({ ...blankCanal("MB"), estimatedWorkingLength: "20" }).nextNodeId, "estimate-wl");
  assert.equal(getNextRecommendedNodeForCanal({ ...blankCanal("MB"), events: [{ id: "evt", timestamp: "t", type: "scouting.estimatedWLSet", canal: "MB" }] }).nextNodeId, "open-orifice");
  assert.equal(getNextRecommendedNodeForCanal({ ...blankCanal("MB"), eal0: "20" }).nextNodeId, "patency-10c");
  assert.equal(getNextRecommendedNodeForCanal({ ...blankCanal("MB"), events: [{ id: "evt", timestamp: "t", type: "glidePath.created", canal: "MB" }] }).nextNodeId, "gauge-final-shape");
  assert.equal(getNextRecommendedNodeForCanal({ ...blankCanal("MB"), finalShape: "30/.04" }).nextNodeId, "remove-smear-layer");
  assert.equal(getNextRecommendedNodeForCanal({ ...blankCanal("MB"), events: [{ id: "evt", timestamp: "t", type: "coneFit.radiographAcceptable", canal: "MB" }] }).nextNodeId, "ready-for-sealer-cone-seating");
  assert.equal(getNextRecommendedNodeForCanal({ ...blankCanal("MB"), finalShape: "30/.04", events: [{ id: "evt", timestamp: "t", type: "canal.medicated", canal: "MB" }] }).nextNodeId, "remove-smear-layer");
  assert.equal(getNextRecommendedNodeForCanal({ ...blankCanal("MB"), events: [{ id: "evt", timestamp: "t", type: "canal.paused", canal: "MB", details: { nodeId: "gauge-final-shape" } }] }).nextNodeId, "gauge-final-shape");
  assert.equal(getCanalStatus({ ...blankCanal("MB"), events: [{ id: "evt_cone", timestamp: "t", type: "coneFit.radiographAcceptable", canal: "MB" }, { id: "evt_pause", timestamp: "t", type: "canal.paused", canal: "MB" }] }), "paused");
  assert.equal(getNextRecommendedNodeForCanal({ ...blankCanal("MB"), events: [{ id: "evt_ref", timestamp: "t", type: "treatment.referralRecommended", canal: "MB" }] }).nextNodeId, "referral-next-step");
  assert.equal(getNextRecommendedNodeForCanal({ ...blankCanal("MB"), events: [{ id: "evt_ref", timestamp: "t", type: "treatment.referralRecommended", canal: "MB" }, { id: "evt_med", timestamp: "t", type: "medication.calciumHydroxidePlaced", canal: "MB" }] }).nextNodeId, "temporary-closure");
  assert.equal(getNextRecommendedNodeForCanal({ ...blankCanal("MB"), events: [{ id: "evt_ref", timestamp: "t", type: "treatment.referralRecommended", canal: "MB" }, { id: "evt_done", timestamp: "t", type: "treatment.referralOnlyCompleted", canal: "MB" }] }).disabled, true);
  const referred = { ...blankCanal("MB"), events: [{ id: "evt", timestamp: "t", type: "canal.referred", canal: "MB" }] };
  assert.equal(getNextRecommendedNodeForCanal(referred).disabled, true);
});

test("prior undocumented visit statuses fast-forward to conservative resume nodes", () => {
  assert.equal(getNextRecommendedNodeForCanal({ ...blankCanal("MB"), priorVisitStatus: "accessOnly" }).nextNodeId, "identify-canals");
  assert.equal(getCanalStatus({ ...blankCanal("MB"), priorVisitStatus: "unknown" }), "notStarted");
  assert.equal(getCanalStatus({ ...blankCanal("MB"), priorVisitStatus: "accessOnly" }), "notStarted");
  assert.equal(getNextRecommendedNodeForCanal({ ...blankCanal("MB"), priorVisitStatus: "wlEstablished" }).nextNodeId, "patency-10c");
  assert.equal(getNextRecommendedNodeForCanal({ ...blankCanal("MB"), priorVisitStatus: "medicatedTemporized" }).nextNodeId, "remove-smear-layer");
  assert.equal(getNextRecommendedNodeForCanal({ ...blankCanal("MB"), priorVisitStatus: "coneFitVerified" }).nextNodeId, "cone-fit-radiograph");
  assert.equal(getNextRecommendedNodeForCanal({ ...blankCanal("MB"), priorVisitStatus: "coneFitVerified", masterCone: "30/.04", shapingLength: "19", coneFitRadiograph: "acceptable" }).nextNodeId, "ready-for-sealer-cone-seating");

  const target = getNextRecommendedNodeForCanal({ ...blankCanal("MB"), priorVisitStatus: "medicatedTemporized", priorVisitNote: "CaOH and temp placed elsewhere" });
  assert.match(target.label, /prior visit/);
  assert.match(target.reason, /prior visit history/);
});

test("app-tracked paused and medicated canals expose manual resume nodes after import", () => {
  const pausedCanal = {
    ...blankCanal("MB"),
    events: [{ id: "evt_pause", timestamp: "t", type: "canal.paused", canal: "MB", details: { nodeId: "gauge-final-shape" } }],
  };
  const medicatedCanal = {
    ...blankCanal("ML"),
    finalShape: "30/.04",
    events: [{ id: "evt_med", timestamp: "t", type: "canal.medicated", canal: "ML" }],
  };

  assert.equal(getCanalStatus(pausedCanal), "paused");
  assert.equal(getManualResumeNodeForCanal(pausedCanal), "gauge-final-shape");
  assert.equal(getCanalStatus(medicatedCanal), "medicated");
  assert.equal(getManualResumeNodeForCanal(medicatedCanal), "remove-smear-layer");
  assert.equal(getManualResumeNodeForCanal({ ...blankCanal("DB"), events: [{ id: "evt_pause_done", timestamp: "t", type: "canal.paused", canal: "DB", details: { nodeId: "endodontic-pathway-complete" } }] }), null);
});

test("phase-aware canal targets are canal-specific at early handoff nodes", () => {
  const caseData = baseCase({
    currentCanal: "MB",
    canals: [
      { ...blankCanal("MB"), estimatedWorkingLength: "20" },
      blankCanal("ML"),
      { ...blankCanal("DB"), estimatedWorkingLength: "19" },
      { ...blankCanal("DL"), eal0: "21" },
      { ...blankCanal("P"), events: [{ id: "evt_gp", timestamp: "t", type: "glidePath.created", canal: "P" }] },
      { ...blankCanal("MB2"), finalShape: "30/.04" },
      { ...blankCanal("D"), events: [{ id: "evt_ref", timestamp: "t", type: "canal.referred", canal: "D" }] },
    ],
  });

  const targets = getPhaseAwareCanalTargets(caseData, "advance-10c", "MB");
  const byCanal = Object.fromEntries(targets.map((target) => [target.canalName, target]));

  assert.equal(byCanal.ML.label, "Start ML at estimated WL / scouting");
  assert.equal(byCanal.ML.nextNodeId, "estimate-wl");
  assert.equal(byCanal.ML.phaseLabel, "estimated WL / scouting");
  assert.equal(byCanal.DB.label, "Start DB at scouting");
  assert.equal(byCanal.DB.nextNodeId, "estimate-wl");
  assert.equal(byCanal.DL.label, "Continue DL at patency / glide path");
  assert.equal(byCanal.DL.nextNodeId, "patency-10c");
  assert.equal(byCanal.P.label, "Continue P at final shaping");
  assert.equal(byCanal.P.nextNodeId, "gauge-final-shape");
  assert.equal(byCanal.MB2.label, "Proceed with MB2 to final cleaning / obturation");
  assert.equal(byCanal.MB2.nextNodeId, "remove-smear-layer");
  assert.equal(byCanal.D.disabled, true);
});

test("phase-aware canal targets only render at intentional handoff nodes and preserve late handoff behavior", () => {
  const caseData = baseCase({
    currentCanal: "MB",
    canals: [
      { ...blankCanal("MB"), finalShape: "30/.04" },
      {
        ...blankCanal("ML"),
        events: [{ id: "evt_disinfected", timestamp: "t", type: "disinfection.finalNaOClCompleted", canal: "ML" }],
      },
      {
        ...blankCanal("DB"),
        events: [{ id: "evt_cone", timestamp: "t", type: "coneFit.radiographAcceptable", canal: "DB" }],
      },
    ],
  });

  assert.deepEqual(getPhaseAwareCanalTargets(caseData, "preop", "MB"), []);
  const targets = getPhaseAwareCanalTargets(caseData, "ready-for-obturation", "MB");
  const byCanal = Object.fromEntries(targets.map((target) => [target.canalName, target]));

  assert.equal(byCanal.ML.nextNodeId, "ready-for-obturation");
  assert.equal(byCanal.ML.label, "Proceed with ML to obturation gauging");
  assert.equal(byCanal.DB.nextNodeId, "ready-for-sealer-cone-seating");
  assert.equal(byCanal.DB.label, "Proceed with DB to sealer / cone seating");
});

test("phase-aware targets can return to referred canal before temporary closure is complete", () => {
  const referralEvent = { id: "evt_ref", timestamp: "t", type: "treatment.referralRecommended", canal: "L" };
  const medicationEvent = { id: "evt_med", timestamp: "t", type: "medication.calciumHydroxidePlaced", canal: "L" };
  const pausedEvent = { id: "evt_pause", timestamp: "t", type: "canal.paused", canal: "B" };
  const caseData = baseCase({
    currentCanal: "B",
    canals: [
      { ...blankCanal("L"), events: [referralEvent, medicationEvent] },
      { ...blankCanal("B"), events: [pausedEvent] },
    ],
    globalEvents: [referralEvent, medicationEvent, pausedEvent],
  });

  const targets = getPhaseAwareCanalTargets(caseData, "endodontic-pathway-complete", "B");
  const lTarget = targets.find((target) => target.canalName === "L");

  assert.equal(lTarget?.disabled, undefined);
  assert.equal(lTarget?.nextNodeId, "temporary-closure");
  assert.equal(lTarget?.label, "Continue L at temporary closure");
});

test("phase-aware targets do not offer pathway-complete loops for paused canals", () => {
  const referredEvent = { id: "evt_ref", timestamp: "t", type: "canal.referred", canal: "L" };
  const pausedEvent = { id: "evt_pause", timestamp: "t", type: "canal.paused", canal: "B", details: { nodeId: "endodontic-pathway-complete" } };
  const caseData = baseCase({
    currentCanal: "L",
    canals: [
      { ...blankCanal("L"), events: [referredEvent] },
      { ...blankCanal("B"), events: [pausedEvent] },
    ],
    globalEvents: [referredEvent, pausedEvent],
  });

  const targets = getPhaseAwareCanalTargets(caseData, "endodontic-pathway-complete", "L");
  const bTarget = targets.find((target) => target.canalName === "B");

  assert.equal(bTarget?.disabled, true);
  assert.equal(bTarget?.nextNodeId, null);
  assert.equal(bTarget?.label, "B paused; no continuation action");
});

test("switching canal event fragment records canal change and measurements remain canal-local", () => {
  const caseData = baseCase({
    currentCanal: "ML",
    canals: [
      { ...blankCanal("MB"), estimatedWorkingLength: "19" },
      { ...blankCanal("ML"), estimatedWorkingLength: "21" },
    ],
  });
  const event = {
    id: "evt_switch",
    timestamp: "2026-01-01T00:00:00.000Z",
    type: "workflow.switchedCanal",
    canal: "MB",
    details: { previousActiveCanal: "ML", newActiveCanal: "MB", reason: "continued MB at working length" },
  };

  assert.match(eventFragment(event), /Workflow switched from ML to MB/);
  assert.equal(event.type, "workflow.switchedCanal");
  assert.equal(caseData.canals.find((canal) => canal.name === "ML")?.estimatedWorkingLength, "21");
});

test("phase-aware switch event fragment and resume inference use canonical switch details", () => {
  const event = {
    id: "evt_switch_phase",
    timestamp: "2026-01-01T00:00:00.000Z",
    type: "workflow.switchedCanal",
    canal: "DL",
    details: {
      previousCanal: "MB",
      nextCanal: "DL",
      previousNodeId: "advance-10c",
      nextNodeId: "patency-10c",
      reason: "continued DL at patency / glide path",
      phaseLabel: "patency / glide path",
    },
  };

  assert.match(eventFragment(event), /Workflow switched from MB to DL; continued at patency \/ glide path\./);
  assert.equal(inferCurrentNodeIdFromEvents({ globalEvents: [event] }), "patency-10c");
});

test("prior-visit resume event inference uses confirmed resume node", () => {
  const event = {
    id: "evt_resume_prior",
    timestamp: "2026-01-01T00:00:00.000Z",
    type: "workflow.resumedFromPriorVisit",
    canal: "MB",
    details: {
      nextNodeId: "remove-smear-layer",
      phaseLabel: "Remove smear layer",
    },
  };

  assert.match(eventFragment(event), /resumed MB from prior visit history/);
  assert.equal(inferCurrentNodeIdFromEvents({ globalEvents: [event] }), "remove-smear-layer");
});

test("compact and full notes include measurements and event fragments", () => {
  const event = {
    id: "evt_wl",
    timestamp: "2026-01-01T00:00:00.000Z",
    type: "workingLength.established",
    canal: "MB",
    details: { canalSnapshot: { eal0: "20", patencyLength: "21", shapingLength: "19", referencePoint: "MB cusp", wlRadiographStatus: "not taken" } },
  };
  const caseData = baseCase({
    canals: [{ ...blankCanal("MB"), estimatedWorkingLength: "20", eal0: "20", patencyLength: "21", shapingLength: "19", wlRadiographStatus: "not taken" }],
    globalEvents: [event],
  });

  const compactNote = buildCompactNote(caseData);
  const fullNote = buildFullNote(caseData);

  assert.match(compactNote, /30 RCT/);
  assert.match(compactNote, /Canals: MB/);
  assert.match(compactNote, /MB: est WL 20 mm/);
  assert.match(fullNote, /WL PA not taken/);
  assert.match(fullNote, /MB: WL established/);
});

test("full note includes canal switch narrative and patient summary remains concise", () => {
  const switchEvent = {
    id: "evt_switch",
    timestamp: "2026-01-01T00:00:00.000Z",
    type: "workflow.switchedCanal",
    canal: "DB",
    details: { previousActiveCanal: "MB", newActiveCanal: "DB", reason: "continued DB at initial scouting" },
  };
  const caseData = baseCase({ globalEvents: [switchEvent] });

  assert.match(buildFullNote(caseData), /Workflow switched from MB to DB/);
  const summary = buildPatientSummary(caseData);
  assert.match(summary, /^Endodontic treatment workflow was started/);
  assert.ok(summary.length < 220);
});

test("JSON export preserves canal status and radiograph statuses", () => {
  const caseData = baseCase({
    canals: [{ ...blankCanal("MB"), eal0: "20", estimatedWorkingLength: "20", shapingLength: "19", wlRadiographStatus: "not taken", coneFitRadiograph: "acceptable" }],
    globalEvents: [{ id: "evt", timestamp: "2026-01-01T00:00:00.000Z", type: "workingLength.established", canal: "MB" }],
  });
  const exported = buildJsonExport(caseData, "patency-10c");
  assert.equal(exported.canals[0].status, "WL established");
  assert.equal(exported.canals[0].wlRadiographStatus, "not taken");
  assert.equal(exported.canals[0].coneFitRadiograph, "acceptable");
  assert.equal(exported.canals[0].estimatedWorkingLength, "20");
  assert.equal(exported.canals[0].shapingLength, "19");
  assert.equal(exported.events.length, 1);
});

test("notes and JSON export separate prior visit history from today's events", () => {
  const caseData = baseCase({
    priorVisit: {
      continuedFromPriorVisit: true,
      priorVisitDate: "last week",
      accessPreviouslyOpened: true,
      temporaryRestorationPresent: true,
      medicationPresent: "yes",
      priorRadiographsAvailable: true,
      sourceNote: "Outside note reviewed; CaOH placed.",
    },
    canals: [{ ...blankCanal("MB"), priorVisitStatus: "medicatedTemporized", priorVisitNote: "Temporized before app use", finalShape: "30/.04" }],
    globalEvents: [{ id: "evt_marker", timestamp: "2026-01-01T00:00:00.000Z", type: "case.continuedFromPriorVisit", canal: "All" }],
  });

  const compact = buildCompactNote(caseData);
  const full = buildFullNote(caseData);
  const exported = buildJsonExport(caseData, "remove-smear-layer");

  assert.match(compact, /Prior visit history:/);
  assert.match(compact, /Continued from prior visit \/ outside system/);
  assert.match(full, /Prior visit history:/);
  assert.match(full, /MB: Medicated \/ temporized; Temporized before app use/);
  assert.equal(exported.priorVisit?.continuedFromPriorVisit, true);
  assert.equal(exported.canals[0].priorVisitStatus, "medicatedTemporized");
  assert.equal(exported.events.length, 1);
});

test("exported JSON can be imported without losing canals, events, or measurements", () => {
  const caseData = baseCase({
    canals: [{ ...blankCanal("MB"), estimatedWorkingLength: "20" }],
    globalEvents: [{ id: "evt", timestamp: "2026-01-01T00:00:00.000Z", type: "scouting.estimatedWLSet", canal: "MB" }],
  });
  const exported = buildJsonExport(caseData, "advance-10c");
  const restoredCanal = {
    ...blankCanal(exported.canals[0].name),
    ...exported.canals[0],
    events: hydrateCanalEventsFromGlobalEvents(exported.canals[0], exported.events),
  };

  assert.equal(restoredCanal.estimatedWorkingLength, "20");
  assert.equal(restoredCanal.events.length, 1);
  assert.equal(getCanalStatus(restoredCanal), "scouted");
});

test("valid case data passes Zod validation", () => {
  const caseData = baseCase({
    canals: [{ ...blankCanal("MB"), estimatedWorkingLength: "20", wlRadiographStatus: "acceptable", coneFitRadiograph: "not taken" }],
  });

  assert.equal(EndoCaseSchema.safeParse(caseData).success, true);
});

test("schema rejects missing tooth, invalid procedure type, and invalid measurements", () => {
  const missingTooth = { ...baseCase(), tooth: "" };
  const invalidProcedure = { ...baseCase(), procedureType: "Implant" };
  const invalidMeasurement = { ...blankCanal("MB"), estimatedWorkingLength: "abc" };

  assert.equal(EndoCaseSchema.safeParse(missingTooth).success, false);
  assert.equal(EndoCaseSchema.safeParse(invalidProcedure).success, false);
  assert.equal(CanalRecordSchema.safeParse(invalidMeasurement).success, false);
});

test("schema allows valid radiograph statuses plus blank and undefined before entry", () => {
  ["acceptable", "short", "long", "not taken", "", undefined].forEach((status) => {
    assert.equal(RadiographStatusSchema.safeParse(status).success, true);
  });
  assert.equal(RadiographStatusSchema.safeParse("missing").success, false);
});

test("shared workflow capability vocabulary has scope rules", () => {
  knownCapabilityNames.forEach((capability) => {
    const rule = capabilityScopeRules[capability];
    assert.ok(rule);
    assert.ok(rule.acceptedScopes.some((scope) => scope === rule.defaultScope));
  });
});

test("operative direct restoration workflow reuses shared context and owns restoration output", () => {
  const workflow = operativeDirectRestorationWorkflow;
  const readinessNode = workflow.nodes["operative-readiness"];
  const restorationNode = workflow.nodes["operative-restoration-record"];
  const completionNode = workflow.nodes["operative-restoration-complete"];

  assert.equal(workflow.discipline, "operative");
  assert.equal(workflow.supportedScopes.includes("surface"), true);
  assert.equal(workflow.supportedScopes.includes("canal"), false);
  assert.deepEqual(
    operativeReadinessCapabilityRequirements.map((requirement) => requirement.name),
    ["diagnosis.recorded", "radiographs.reviewed", "anesthesia.adequate", "isolation.established"]
  );
  assert.deepEqual(
    readinessNode.moduleCalls?.map((call) => call.workflowId),
    [sharedDiagnosisWorkflowId, sharedAnesthesiaWorkflowId, sharedIsolationWorkflow.workflowId]
  );
  assert.equal(readinessNode.capabilityRequirements, undefined);
  assert.equal(restorationNode.moduleCalls, undefined);
  assert.deepEqual(operativeRestorationOutputCapabilities, ["finalRestoration.placed"]);
  assert.deepEqual(completionNode.capabilityRequirements?.map((requirement) => requirement.name), ["finalRestoration.placed"]);
});

test("operative setup helpers normalize surfaces and scope details", () => {
  assert.deepEqual(normalizeOperativeSurfaces("M O"), ["M", "O"]);
  assert.deepEqual(normalizeOperativeSurfaces("M,O"), ["M", "O"]);
  assert.deepEqual(normalizeOperativeSurfaces("MO"), ["M", "O"]);
  assert.deepEqual(normalizeOperativeSurfaces(["M/O", "O"]), ["M", "O"]);

  const setup = {
    ...blankOperativeWorkflowSetup,
    tooth: "36",
    surfaces: "MO",
    restorationIntent: "direct restoration",
    material: "composite",
    shade: "A2",
  };

  assert.deepEqual(buildOperativeSetupEventDetails(setup, "30"), {
    tooth: "36",
    surfaces: ["M", "O"],
    restorationIntent: "direct restoration",
    material: "composite",
    shade: "A2",
  });
  assert.deepEqual(buildOperativeSetupEventDetails({ ...blankOperativeWorkflowSetup, surfaces: "D" }, "37"), {
    tooth: "37",
    surfaces: ["D"],
  });
  assert.deepEqual(createOperativeSurfaceScope({ tooth: "36", surfaces: "MO" }), {
    kind: "surface",
    tooth: "36",
    procedureId: undefined,
    surface: "M",
    surfaces: ["M", "O"],
    label: "36 MO",
  });
});

test("operative setup hydrates from the latest setup event", () => {
  const olderEvent = {
    id: "evt_operative_scope_old",
    timestamp: "2026-01-01T10:00:00.000Z",
    type: operativeScopeRecordedEventType,
    workflowId: operativeDirectRestorationWorkflowId,
    workflowVersion: "0.1.0",
    nodeId: "operative-surface-scope",
    scope: createOperativeSurfaceScope({ tooth: "36", surfaces: "O" }),
    details: { tooth: "36", surfaces: ["O"], material: "composite" },
  };
  const latestEvent = {
    id: "evt_operative_scope_latest",
    timestamp: "2026-01-01T10:05:00.000Z",
    type: operativeScopeRecordedEventType,
    workflowId: operativeDirectRestorationWorkflowId,
    workflowVersion: "0.1.0",
    nodeId: "operative-surface-scope",
    scope: createOperativeSurfaceScope({ tooth: "36", surfaces: ["M", "O"] }),
    details: {
      tooth: "36",
      surfaces: ["M", "O"],
      restorationIntent: "direct restoration",
      material: "composite",
      shade: "A2",
    },
  };
  const unrelatedEvent = {
    id: "evt_unrelated",
    timestamp: "2026-01-01T10:03:00.000Z",
    type: "case.note",
  };
  const expectedSetup = {
    tooth: "36",
    surfaces: "M O",
    restorationIntent: "direct restoration",
    material: "composite",
    shade: "A2",
  };

  assert.deepEqual(getOperativeSetupFromEvent(latestEvent), expectedSetup);
  assert.deepEqual(getLatestOperativeWorkflowSetup(baseCase({ tooth: "36", globalEvents: [olderEvent, unrelatedEvent, latestEvent] })), expectedSetup);
  assert.deepEqual(upsertOperativeScopeRecordedEvent([unrelatedEvent, olderEvent], latestEvent).map((event) => event.id), ["evt_unrelated", "evt_operative_scope_latest"]);
});

test("operative surface scope stays separate from endodontic canal scope", () => {
  const surfaceScope = createOperativeSurfaceScope({ tooth: "36", surfaces: ["M", "O"], procedureId: "op_36_mo" });
  const canalScope = { kind: "canal" as const, tooth: "36", canal: "MB" };

  assert.deepEqual(surfaceScope, {
    kind: "surface",
    tooth: "36",
    procedureId: "op_36_mo",
    surface: "M",
    surfaces: ["M", "O"],
    label: "36 MO",
  });
  assert.equal(isOperativeSurfaceScope(surfaceScope), true);
  assert.equal(isEndodonticCanalScope(surfaceScope), false);
  assert.equal(isEndodonticCanalScope(canalScope), true);
  assert.equal(isOperativeSurfaceScope(canalScope), false);
  assert.equal(scopesTargetDifferentToothSubstructures(surfaceScope, canalScope), true);

  const caseData = baseCase({
    tooth: "36",
    globalEvents: [
      {
        id: "evt_canal_only",
        timestamp: "2026-01-01T10:00:00.000Z",
        type: "endo.canalProgress",
        capabilitiesSatisfied: [
          {
            name: "finalRestoration.placed",
            scope: canalScope,
          },
        ],
      },
    ],
  });

  assert.equal(isCapabilitySatisfied(caseData, "finalRestoration.placed", surfaceScope), false);
  assert.equal(isCapabilitySatisfied(caseData, "finalRestoration.placed", { kind: "tooth", tooth: "36" }), false);

  const toothScopedRestorationCase = baseCase({
    tooth: "36",
    globalEvents: [
      {
        id: "evt_tooth_restoration_only",
        timestamp: "2026-01-01T10:00:00.000Z",
        type: "finalRestoration.placed",
        capabilitiesSatisfied: [
          {
            name: "finalRestoration.placed",
            scope: { kind: "tooth", tooth: "36" },
          },
        ],
      },
    ],
  });

  assert.equal(isCapabilitySatisfied(toothScopedRestorationCase, "finalRestoration.placed", surfaceScope), false);
});

test("operative restoration event helpers build a surface-scoped final restoration capability", () => {
  const record = {
    tooth: "36",
    surfaces: "MO",
    restorationIntent: "direct restoration",
    material: "composite",
    shade: "A2",
    outcome: "placed",
    notes: "Occlusion checked by clinician",
  };
  const event = buildOperativeRestorationPlacedEvent({
    id: "evt_operative_restoration",
    timestamp: "2026-01-01T11:00:00.000Z",
    record,
    fallbackTooth: "30",
    workflowRunId: "run_operative_1",
  });
  const expectedScope = {
    kind: "surface" as const,
    tooth: "36",
    procedureId: undefined,
    surface: "M",
    surfaces: ["M", "O"],
    label: "36 MO",
  };

  assert.equal(event.type, finalRestorationPlacedEventType);
  assert.equal(event.workflowId, operativeDirectRestorationWorkflowId);
  assert.equal(event.workflowVersion, "0.1.0");
  assert.equal(event.nodeId, "operative-restoration-record");
  assert.deepEqual(event.scope, expectedScope);
  assert.deepEqual(createOperativeRestorationScope(record, "30"), expectedScope);
  assert.deepEqual(buildOperativeRestorationEventDetails(record, "30"), {
    tooth: "36",
    surfaces: ["M", "O"],
    restorationIntent: "direct restoration",
    material: "composite",
    shade: "A2",
    outcome: "placed",
    notes: "Occlusion checked by clinician",
  });
  assert.deepEqual(event.capabilitiesSatisfied, [
    {
      name: "finalRestoration.placed",
      scope: expectedScope,
      sourceEventId: "evt_operative_restoration",
      workflowId: operativeDirectRestorationWorkflowId,
      workflowRunId: "run_operative_1",
      satisfiedAt: "2026-01-01T11:00:00.000Z",
    },
  ]);
  assert.deepEqual(buildFinalRestorationPlacedCapability(event), event.capabilitiesSatisfied?.[0]);
  assert.equal(isOperativeRestorationPlacedEvent(event), true);
  assert.deepEqual(getOperativeRestorationRecordFromEvent(event), { ...record, surfaces: "M O" });
  assert.equal(ClinicalEventSchema.safeParse(event).success, true);
});

test("operative final restoration capability satisfies only matching surface targets", () => {
  const restorationEvent = buildOperativeRestorationPlacedEvent({
    id: "evt_operative_restoration_match",
    timestamp: "2026-01-01T11:00:00.000Z",
    record: {
      tooth: "36",
      surfaces: "MO",
      restorationIntent: "direct restoration",
      material: "composite",
      shade: "A2",
      outcome: "placed",
      notes: "",
    },
  });
  const caseData = baseCase({
    tooth: "36",
    globalEvents: [
      restorationEvent,
      {
        id: "evt_endo_closure",
        timestamp: "2026-01-01T11:05:00.000Z",
        type: "closure.finalRestoration",
        tooth: "36",
        canal: "All",
      },
    ],
  });

  assert.equal(isCapabilitySatisfied(caseData, "finalRestoration.placed", createOperativeSurfaceScope({ tooth: "36", surfaces: "MO" })), true);
  assert.equal(isCapabilitySatisfied(caseData, "finalRestoration.placed", createOperativeSurfaceScope({ tooth: "36", surfaces: "M" })), true);
  assert.equal(isCapabilitySatisfied(caseData, "finalRestoration.placed", createOperativeSurfaceScope({ tooth: "36", surfaces: "DO" })), false);
  assert.equal(isCapabilitySatisfied(caseData, "finalRestoration.placed", createOperativeSurfaceScope({ tooth: "46", surfaces: "MO" })), false);
  assert.equal(isCapabilitySatisfied(caseData, "finalRestoration.placed", { kind: "tooth", tooth: "36" }), false);
  assert.deepEqual(getOperativeRestorationEvents(caseData).map((event) => event.id), ["evt_operative_restoration_match"]);
});

test("operative setup and restoration records appear in notes and JSON export", () => {
  const setupEvent = {
    id: "evt_operative_setup_note",
    timestamp: "2026-01-01T10:50:00.000Z",
    type: operativeScopeRecordedEventType,
    workflowId: operativeDirectRestorationWorkflowId,
    workflowVersion: "0.1.0",
    nodeId: "operative-surface-scope",
    scope: createOperativeSurfaceScope({ tooth: "36", surfaces: "MO" }),
    details: {
      tooth: "36",
      surfaces: ["M", "O"],
      restorationIntent: "direct restoration",
      material: "composite",
      shade: "A2",
    },
  };
  const restorationEvent = buildOperativeRestorationPlacedEvent({
    id: "evt_operative_restoration_note",
    timestamp: "2026-01-01T11:00:00.000Z",
    record: {
      tooth: "36",
      surfaces: "MO",
      restorationIntent: "direct restoration",
      material: "composite",
      shade: "A2",
      outcome: "placed",
      notes: "Occlusion checked by clinician",
    },
  });
  const caseData = baseCase({
    tooth: "36",
    procedureType: "Direct restoration",
    globalEvents: [setupEvent, restorationEvent],
  });
  const compact = buildCompactNote(caseData);
  const full = buildFullNote(caseData);
  const exported = buildJsonExport(caseData, "operative-restoration-complete");

  assert.match(eventFragment(setupEvent), /Operative setup recorded: tooth 36; surfaces M O; intent direct restoration; material composite; shade A2/);
  assert.match(eventFragment(restorationEvent), /Final restoration recorded: tooth 36; surfaces M O; intent direct restoration; material composite; shade A2; outcome placed; notes Occlusion checked by clinician/);
  assert.match(compact, /Operative setup recorded: tooth 36; surfaces M O/);
  assert.match(compact, /Final restoration recorded: tooth 36; surfaces M O; intent direct restoration; material composite; shade A2; outcome placed; notes Occlusion checked by clinician/);
  assert.match(full, /Operative:/);
  assert.match(full, /Operative setup recorded: tooth 36; surfaces M O/);
  assert.match(full, /Final restoration recorded: tooth 36; surfaces M O/);
  assert.equal(exported.operative?.setup?.eventId, "evt_operative_setup_note");
  assert.deepEqual(exported.operative?.setup?.record, {
    tooth: "36",
    surfaces: "M O",
    restorationIntent: "direct restoration",
    material: "composite",
    shade: "A2",
  });
  assert.equal(exported.operative?.restorations.length, 1);
  assert.deepEqual(exported.operative?.restorations[0].record, {
    tooth: "36",
    surfaces: "M O",
    restorationIntent: "direct restoration",
    material: "composite",
    shade: "A2",
    outcome: "placed",
    notes: "Occlusion checked by clinician",
  });
  assert.equal(exported.operative?.restorations[0].capabilitiesSatisfied[0].name, "finalRestoration.placed");
  assert.equal(exported.events.length, 2);
});

test("operative note and export handle partially documented records without inferred wording", () => {
  const setupEvent = {
    id: "evt_operative_setup_partial",
    timestamp: "2026-01-01T10:50:00.000Z",
    type: operativeScopeRecordedEventType,
    workflowId: operativeDirectRestorationWorkflowId,
    nodeId: "operative-surface-scope",
    scope: createOperativeSurfaceScope({ tooth: "36", surfaces: "O" }),
    details: {
      tooth: "36",
      surfaces: ["O"],
    },
  };
  const restorationEvent = buildOperativeRestorationPlacedEvent({
    id: "evt_operative_restoration_partial",
    timestamp: "2026-01-01T11:00:00.000Z",
    record: {
      tooth: "36",
      surfaces: "O",
      restorationIntent: "",
      material: "",
      shade: "",
      outcome: "",
      notes: "",
    },
  });
  const caseData = baseCase({
    tooth: "36",
    globalEvents: [setupEvent, restorationEvent],
  });
  const compact = buildCompactNote(caseData);
  const full = buildFullNote(caseData);
  const exported = buildJsonExport(caseData, "operative-restoration-record");

  assert.match(eventFragment(setupEvent), /^Operative setup recorded: tooth 36; surfaces O\.$/);
  assert.match(eventFragment(restorationEvent), /^Final restoration recorded: tooth 36; surfaces O\.$/);
  assert.match(compact, /Operative setup recorded: tooth 36; surfaces O\./);
  assert.match(full, /Final restoration recorded: tooth 36; surfaces O\./);
  assert.doesNotMatch(`${compact}\n${full}`, /recommend|adequate|successful/i);
  assert.deepEqual(exported.operative?.restorations[0].record, {
    tooth: "36",
    surfaces: "O",
    restorationIntent: "",
    material: "",
    shade: "",
    outcome: "",
    notes: "",
  });
});

test("operative surface queries can compare against tooth-level isolation coverage", () => {
  const surfaceScope = createOperativeSurfaceScope({ tooth: "36", surfaces: ["M", "O"], procedureId: "op_36_mo" });
  const unrelatedSurfaceScope = createOperativeSurfaceScope({ tooth: "46", surface: "O", procedureId: "op_46_o" });
  const rubberDamEvent = {
    id: "evt_surface_ready_iso",
    timestamp: "2026-01-01T10:00:00.000Z",
    type: isolationEventTypes.rubberDamPlaced,
    workflowId: sharedIsolationWorkflow.workflowId,
    workflowVersion: sharedIsolationWorkflow.version,
    scope: { kind: "custom" as const, teeth: ["36", "37"], regionLabel: "Q3" },
    details: {
      method: "rubberDam",
      regionKind: "quadrant",
      regionLabel: "Q3",
      exposedTeeth: ["36", "37"],
      clampCode: "W8A",
      clampTooth: "37",
    },
  };
  const isolatedCase = baseCase({
    tooth: "36",
    globalEvents: [
      {
        ...rubberDamEvent,
        capabilitiesSatisfied: [buildIsolationEstablishedCapability(rubberDamEvent)],
      },
    ],
  });
  const compromisedCase = baseCase({
    tooth: "36",
    globalEvents: [
      ...isolatedCase.globalEvents,
      {
        id: "evt_surface_ready_iso_compromised",
        timestamp: "2026-01-01T10:05:00.000Z",
        type: isolationEventTypes.compromised,
        scope: { kind: "tooth" as const, tooth: "36" },
        details: { reason: "dam displaced" },
      },
    ],
  });
  const currentStatus = getCapabilityStatus(isolatedCase, "isolation.established", surfaceScope);
  const compromisedStatus = getCapabilityStatus(compromisedCase, "isolation.established", surfaceScope);

  assert.equal(currentStatus.satisfied, true);
  assert.equal(currentStatus.needsReassessment, false);
  assert.equal(isCapabilitySatisfied(isolatedCase, "isolation.established", unrelatedSurfaceScope), false);
  assert.equal(compromisedStatus.satisfied, false);
  assert.equal(compromisedStatus.needsReassessment, true);
  assert.equal(getIsolationEventDetails(rubberDamEvent).exposedTeeth?.includes("36"), true);
  assert.equal("surfaces" in (rubberDamEvent.details as Record<string, unknown>), false);
});

test("operative readiness summary targets planned tooth and surfaces", () => {
  const setup = {
    ...blankOperativeWorkflowSetup,
    tooth: "36",
    surfaces: "MO",
  };
  const scopes = createOperativeReadinessScopes(setup, "30");
  const anesthesiaEvent = {
    id: "evt_operative_ready_anesthesia",
    timestamp: "2026-01-01T10:00:00.000Z",
    type: anesthesiaEventTypes.adequacyConfirmed,
    workflowId: sharedAnesthesiaWorkflowId,
    scope: { kind: "tooth" as const, tooth: "36" },
    tooth: "36",
    details: { response: "adequate" as const, tooth: "36" },
  };
  const isolationEvent = {
    id: "evt_operative_ready_isolation",
    timestamp: "2026-01-01T10:01:00.000Z",
    type: isolationEventTypes.rubberDamPlaced,
    workflowId: sharedIsolationWorkflow.workflowId,
    scope: { kind: "custom" as const, teeth: ["36"], regionLabel: "Q3" },
    details: { method: "rubberDam" as const, exposedTeeth: ["36"] },
  };
  const caseData = baseCase({
    tooth: "30",
    diagnosis: { pulpal: "normal pulp", apical: "normal apical tissues" },
    preOp: { ...initialCase.preOp, paReviewed: true },
    globalEvents: [
      {
        ...anesthesiaEvent,
        capabilitiesSatisfied: [buildAnesthesiaAdequateCapability(anesthesiaEvent)],
      },
      {
        ...isolationEvent,
        capabilitiesSatisfied: [buildIsolationEstablishedCapability(isolationEvent)],
      },
    ],
  });
  const summary = getOperativeReadinessCapabilitySummary(caseData, setup);

  assert.deepEqual(scopes.toothScope, { kind: "tooth", tooth: "36" });
  assert.deepEqual(scopes.treatmentScope, {
    kind: "surface",
    tooth: "36",
    procedureId: undefined,
    surface: "M",
    surfaces: ["M", "O"],
    label: "36 MO",
  });
  assert.equal(summary.diagnosis.satisfied, false);
  assert.equal(summary.diagnosis.reason, "Recorded diagnosis is for a different tooth.");
  assert.equal(summary.radiographs.satisfied, false);
  assert.equal(summary.radiographs.reason, "Recorded radiograph review is for a different tooth.");
  assert.equal(summary.anesthesia.satisfied, true);
  assert.equal(summary.isolation.satisfied, true);
  assert.equal(isCapabilitySatisfied(caseData, "anesthesia.adequate", scopes.treatmentScope), true);
  assert.equal(isCapabilitySatisfied(caseData, "isolation.established", scopes.treatmentScope), true);
});

test("workflow launcher registry preserves endodontic fast path and shared module availability", () => {
  const readyEntries = getReadyWorkflowLauncherEntries();
  const sharedEntries = getSharedModuleLauncherEntries();
  const endoEntry = workflowLauncherEntries.find((entry) => entry.workflowId === endodonticRootWorkflowId);
  const operativeEntry = workflowLauncherEntries.find((entry) => entry.workflowId === operativeDirectRestorationWorkflow.workflowId);

  assert.equal(endodonticRootWorkflow.entryNodeIds[0], "preop");
  assert.equal(endodonticRootWorkflow.completionNodeIds.includes("endodontic-pathway-complete"), true);
  assert.equal(endoEntry?.availability, "ready");
  assert.equal(readyEntries.some((entry) => entry.workflowId === endodonticRootWorkflowId), true);
  assert.equal(readyEntries.some((entry) => entry.workflowId === sharedIsolationWorkflow.workflowId), true);
  assert.equal(readyEntries.some((entry) => entry.workflowId === sharedAnesthesiaWorkflowId), true);
  assert.equal(readyEntries.some((entry) => entry.workflowId === operativeDirectRestorationWorkflow.workflowId), true);
  assert.deepEqual(sharedEntries.map((entry) => entry.workflowId), [sharedIsolationWorkflow.workflowId, sharedAnesthesiaWorkflowId]);
  assert.equal(sharedEntries.find((entry) => entry.workflowId === sharedAnesthesiaWorkflowId)?.availability, "ready");
  assert.equal(operativeEntry?.availability, "ready");
  assert.equal(operativeEntry?.launchLabel, "Start / resume workflow");
});

test("shared anesthesia phase 1 model parses typed details and preserves legacy events", () => {
  const event = {
    id: "evt_anesthesia_details",
    timestamp: "2026-01-01T09:55:00.000Z",
    type: anesthesiaEventTypes.administered,
    tooth: "36",
    details: {
      route: "topical",
      agentLabel: "documented anesthetic",
      technique: "documented technique",
      applicationType: "documented application",
      site: "documented site",
      dose: "1.7",
      doseUnit: "mL",
      administeredAt: "09:55",
      vasoconstrictor: "none documented",
      vasoconstrictorDose: "1:200K epinephrine/adrenaline",
      response: "partial",
      notes: "assessment note",
      reason: "documented reason",
      teeth: ["36", " 37 ", ""],
      regionLabel: "Q3",
    },
  };
  const legacyEvent = {
    id: "evt_anesthesia_legacy",
    timestamp: "2026-01-01T09:56:00.000Z",
    type: anesthesiaEventTypes.administered,
    tooth: "36",
    details: {
      route: "legacy route",
      response: "assessment pending",
    },
  };
  const otherRouteEvent = {
    id: "evt_anesthesia_other_route",
    timestamp: "2026-01-01T09:57:00.000Z",
    type: anesthesiaEventTypes.administered,
    tooth: "36",
    details: {
      route: "other",
      routeLabel: "documented non-injection route",
      applicationType: "documented application",
      site: "documented site",
      notes: "free text note",
    },
  };

  assert.deepEqual([...anesthesiaRoutes], ["injection", "topical", "other"]);
  assert.deepEqual([...anesthesiaAdequacyResponses], ["adequate", "partial", "notAdequate", "notAssessed"]);
  assert.equal(isAnesthesiaRoute("topical"), true);
  assert.equal(isAnesthesiaRoute("legacy route"), false);
  assert.equal(isAnesthesiaAdequacyResponse("partial"), true);
  assert.equal(isAnesthesiaAdequacyResponse("assessment pending"), false);
  assert.equal(isAdequateAnesthesiaResponse("adequate"), true);
  assert.equal(isAdequateAnesthesiaResponse("partial"), false);

  const details = getAnesthesiaEventDetails(event);
  assert.equal(details.route, "topical");
  assert.equal(details.applicationType, "documented application");
  assert.equal(details.administeredAt, "09:55");
  assert.equal(details.vasoconstrictorDose, "1:200K epinephrine/adrenaline");
  assert.equal(details.response, "partial");
  assert.deepEqual(details.teeth, ["36", "37"]);
  assert.deepEqual(getAnesthesiaScopeFromEvent(event), { kind: "custom", teeth: ["36", "37"], regionLabel: "Q3" });
  assert.match(eventFragment(event), /route: topical/);
  assert.match(eventFragment(event), /documented application/);
  assert.match(eventFragment(event), /time: 09:55/);
  assert.match(eventFragment(event), /vasoconstrictor dose: 1:200K epinephrine\/adrenaline/);
  assert.match(eventFragment(event), /Response: partial/);

  const otherDetails = getAnesthesiaEventDetails(otherRouteEvent);
  assert.equal(otherDetails.route, "other");
  assert.equal(otherDetails.routeLabel, "documented non-injection route");
  assert.match(eventFragment(otherRouteEvent), /route: documented non-injection route/);
  assert.doesNotMatch(eventFragment(otherRouteEvent), /route: other/);

  const legacyDetails = getAnesthesiaEventDetails(legacyEvent);
  assert.equal(legacyDetails.route, undefined);
  assert.equal(legacyDetails.response, undefined);
  assert.equal(legacyDetails.tooth, "36");
  assert.equal(isCapabilitySatisfied(baseCase({ tooth: "36", globalEvents: [legacyEvent] }), "anesthesia.adequate", { kind: "tooth", tooth: "36" }), false);
});

test("shared anesthesia catalog suggestions are route scoped and non-prescriptive", () => {
  assert.equal(anesthesiaCatalogOwnership.owner, "seed");
  assert.equal(anesthesiaCatalogOwnership.clinicalUse, "documentationSuggestionsOnly");
  assert.equal(anesthesiaCatalogOwnership.allowsCustomText, true);
  assert.equal(anesthesiaCatalogOwnership.hasDoseDefaults, false);
  assert.equal(anesthesiaCatalogOwnership.hasProductRecommendations, false);

  assert.equal(seedAnesthesiaCatalogItems.every((item) => item.owner === "seed"), true);
  assert.equal(seedAnesthesiaCatalogItems.every((item) => item.category === "anesthesia"), true);
  assert.equal(seedAnesthesiaCatalogItems.some((item) => item.label === "Infiltration" && item.appliesTo?.route === "injection" && item.appliesTo.field === "techniques"), true);
  assert.deepEqual(getAnesthesiaCatalogOptions("injection", "agents"), []);
  assert.deepEqual(getAnesthesiaCatalogOptions("topical", "agents"), []);
  assert.deepEqual(getAnesthesiaCatalogOptions("other", "agents"), []);
  assert.equal(getAnesthesiaCatalogOptions("injection", "techniques").includes("Infiltration"), true);
  assert.equal(getAnesthesiaCatalogOptions("topical", "techniques").includes("Infiltration"), false);
  assert.equal(getAnesthesiaCatalogOptions("topical", "applicationTypes").includes("Topical application"), true);
  assert.equal(getAnesthesiaCatalogOptions("injection", "applicationTypes").includes("Topical application"), false);
  assert.deepEqual(getAnesthesiaCatalogOptions("injection", "doseUnits"), ["mL", "carpule(s)"]);
  assert.deepEqual(getAnesthesiaCatalogOptions("topical", "doseUnits"), []);
  assert.deepEqual(getAnesthesiaCatalogOptions("injection", "vasoconstrictorDoses"), ["1:100K epinephrine/adrenaline", "1:200K epinephrine/adrenaline"]);
  assert.deepEqual(getAnesthesiaCatalogOptions("topical", "vasoconstrictorDoses"), []);
  assert.equal(getAnesthesiaCatalogOptions("other", "routeLabels").includes("Inhaled"), true);
});

test("shared isolation catalog suggestions are narrow and non-prescriptive", () => {
  assert.equal(isolationCatalogOwnership.owner, "seed");
  assert.equal(isolationCatalogOwnership.clinicalUse, "documentationSuggestionsOnly");
  assert.equal(isolationCatalogOwnership.allowsCustomText, true);
  assert.equal(isolationCatalogOwnership.hasClampRecommendations, false);
  assert.equal(isolationCatalogOwnership.hasMethodRecommendations, false);
  assert.equal(isolationCatalogOwnership.hasOperativeReadinessRules, false);

  assert.equal(seedIsolationCatalogItems.every((item) => item.owner === "seed"), true);
  assert.equal(seedIsolationCatalogItems.every((item) => item.category === "isolation"), true);
  assert.equal(seedIsolationCatalogItems.some((item) => item.label === "Rubber dam" && item.appliesTo?.field === "methodLabels"), true);
  assert.equal(seedIsolationCatalogItems.some((item) => item.appliesTo?.field === "supportTypes" && item.label === "Clamp"), true);
  assert.deepEqual(getIsolationCatalogOptions("clampCodes"), []);
  assert.equal(getIsolationCatalogOptions("methodLabels").includes("Rubber dam"), true);
  assert.equal(getIsolationCatalogOptions("supportTypes").includes("Clamp"), true);
  assert.equal(getIsolationCatalogOptions("reasons").includes("Saliva contamination"), true);
  assert.equal(getIsolationCatalogOptions("notes").includes("Isolation stable"), true);
});

test("shared isolation catalog merges user items, hides seed rows, and snapshots event labels", () => {
  const userClampCode = createUserIsolationCatalogItem({
    field: "clampCodes",
    label: "W8A",
    aliases: ["8A"],
    favorite: true,
    sortOrder: 1,
  });
  const userReason = createUserIsolationCatalogItem({
    field: "reasons",
    label: "Clinic reason",
    favorite: true,
    sortOrder: 1,
  });
  const hiddenSeedReason = createUserIsolationCatalogOverride(
    seedIsolationCatalogItems.find((item) => item.label === "Saliva contamination")!,
    { active: false, favorite: false }
  );
  const favoriteSeedNote = createUserIsolationCatalogOverride(
    seedIsolationCatalogItems.find((item) => item.label === "Isolation monitored throughout")!,
    { active: true, favorite: true }
  );
  const customItems = [userClampCode, userReason, hiddenSeedReason, favoriteSeedNote];
  const clampCodes = getIsolationCatalogOptions("clampCodes", customItems);
  const reasons = getIsolationCatalogOptions("reasons", customItems);
  const notes = getIsolationCatalogOptions("notes", customItems);
  const reasonAliases = getCatalogLabels(mergeCatalogItems(seedIsolationCatalogItems, customItems), {
    category: "isolation",
    field: "clampCodes",
    includeAliases: true,
  });
  const event = {
    id: "evt_isolation_catalog_snapshot",
    timestamp: "2026-01-01T10:00:00.000Z",
    type: isolationEventTypes.rubberDamPlaced,
    details: {
      method: "rubberDam",
      clampCode: clampCodes[0],
      reason: reasons[0],
      notes: notes[0],
    },
  };
  const hiddenAfterRecording = [
    createUserIsolationCatalogOverride(userClampCode, { active: false, favorite: userClampCode.favorite }),
    createUserIsolationCatalogOverride(userReason, { active: false, favorite: userReason.favorite }),
    createUserIsolationCatalogOverride(favoriteSeedNote, { active: false, favorite: favoriteSeedNote.favorite }),
  ];

  assert.deepEqual(clampCodes, ["W8A"]);
  assert.deepEqual(reasonAliases, ["W8A", "8A"]);
  assert.equal(reasons[0], "Clinic reason");
  assert.equal(reasons.includes("Saliva contamination"), false);
  assert.equal(notes[0], "Isolation monitored throughout");
  assert.deepEqual(getIsolationCatalogOptions("clampCodes", hiddenAfterRecording), []);
  assert.equal(getIsolationEventDetails(event).clampCode, "W8A");
  assert.equal(getIsolationEventDetails(event).reason, "Clinic reason");
  assert.equal(getIsolationEventDetails(event).notes, "Isolation monitored throughout");
});

test("user isolation catalog persistence loads, validates, and merges local user items", () => {
  const userClampCode = createUserIsolationCatalogItem({
    field: "clampCodes",
    label: "W8A",
    aliases: ["8A"],
    favorite: true,
    sortOrder: 1,
  });
  const userReason = createUserIsolationCatalogItem({
    field: "reasons",
    label: "User reason",
    favorite: true,
    sortOrder: 1,
  });
  const hiddenUserNote = createUserIsolationCatalogItem({
    field: "notes",
    label: "Hidden note",
    active: false,
    sortOrder: 0,
  });
  const hiddenSeedReason = createUserIsolationCatalogOverride(
    seedIsolationCatalogItems.find((item) => item.label === "Saliva contamination")!,
    { active: false, favorite: false }
  );
  const favoriteSeedNote = createUserIsolationCatalogOverride(
    seedIsolationCatalogItems.find((item) => item.label === "Isolation monitored throughout")!,
    { active: true, favorite: true }
  );
  const invalidFieldItem: CatalogItem = {
    ...userReason,
    id: "user.isolation.invalid-field",
    appliesTo: { field: "agents" },
  };
  const routedItem: CatalogItem = {
    ...userReason,
    id: "user.isolation.routed",
    appliesTo: { route: "injection", field: "reasons" },
  };
  const storage = memoryStorage();

  assert.deepEqual(loadUserIsolationCatalogItems(storage), []);
  assert.deepEqual(loadUserIsolationCatalogItems(memoryStorage({ [USER_ISOLATION_CATALOG_STORAGE_KEY]: "not json" })), []);
  assert.deepEqual(loadUserIsolationCatalogItems(memoryStorage({ [USER_ISOLATION_CATALOG_STORAGE_KEY]: JSON.stringify({ version: 2, items: [userReason] }) })), []);

  saveUserIsolationCatalogItems([
    userClampCode,
    userReason,
    hiddenUserNote,
    hiddenSeedReason,
    favoriteSeedNote,
    { ...userReason, id: "seed-owned-ignored", owner: "seed" },
    { ...userReason, id: "wrong-category-ignored", category: "anesthesia" },
    invalidFieldItem,
    routedItem,
  ], storage);

  const loadedItems = loadUserIsolationCatalogItems(storage);
  const clampCodes = getIsolationCatalogOptions("clampCodes", loadedItems);
  const reasons = getIsolationCatalogOptions("reasons", loadedItems);
  const notes = getIsolationCatalogOptions("notes", loadedItems);
  const event = {
    id: "evt_isolation_user_catalog_no_inference",
    timestamp: "2026-01-01T10:00:00.000Z",
    type: isolationEventTypes.removed,
    tooth: "36",
    scope: { kind: "tooth" as const, tooth: "36" },
    details: {
      clampCode: clampCodes[0],
      reason: reasons[0],
      notes: notes[0],
    },
  };
  const caseData = baseCase({ tooth: "36", globalEvents: [event] });

  assert.equal(loadedItems.every((item) => item.owner === "user" && item.category === "isolation"), true);
  assert.equal(loadedItems.some((item) => item.id === "seed-owned-ignored"), false);
  assert.equal(loadedItems.some((item) => item.id === "wrong-category-ignored"), false);
  assert.equal(loadedItems.some((item) => item.id === "user.isolation.invalid-field"), false);
  assert.equal(loadedItems.some((item) => item.id === "user.isolation.routed"), false);
  assert.deepEqual(clampCodes, ["W8A"]);
  assert.equal(reasons[0], "User reason");
  assert.equal(reasons.includes("Saliva contamination"), false);
  assert.equal(notes[0], "Isolation monitored throughout");
  assert.equal(notes.includes("Hidden note"), false);
  assert.equal(getIsolationEventDetails(event).clampCode, "W8A");
  assert.equal(getCapabilityStatus(caseData, "isolation.established", { kind: "tooth", tooth: "36" }).satisfied, false);
  assert.equal(getCapabilityStatus(caseData, "isolation.established", { kind: "tooth", tooth: "36" }).needsReassessment, true);
});

test("isolation shortcut saving captures only catalog-backed documentation fields", () => {
  const placementItems = buildUserIsolationCatalogItemsFromForm({
    action: isolationEventTypes.rubberDamPlaced,
    methodLabel: "Rubber dam",
    regionLabel: "Q3",
    clampCode: "W8A",
    supportType: "Ligature",
    supportPhrase: "Ligature placed",
    note: "Isolation stable",
  });
  const reassessmentItems = buildUserIsolationCatalogItemsFromForm({
    action: isolationEventTypes.compromised,
    regionLabel: "Q3",
    clampCode: "W8A",
    note: "Saliva contamination",
  });
  const removalItems = buildUserIsolationCatalogItemsFromForm({
    action: isolationEventTypes.removed,
    regionLabel: "",
    clampCode: "",
    note: "Dam removed for assessment",
  });

  assert.deepEqual(placementItems.map((item) => item.appliesTo?.field), ["methodLabels", "regionLabels", "clampCodes", "supportTypes", "supportPhrases", "notes"]);
  assert.deepEqual(placementItems.map((item) => item.label), ["Rubber dam", "Q3", "W8A", "Ligature", "Ligature placed", "Isolation stable"]);
  assert.deepEqual(reassessmentItems.map((item) => item.appliesTo?.field), ["regionLabels", "clampCodes", "reasons"]);
  assert.deepEqual(removalItems.map((item) => item.appliesTo?.field), ["reasons"]);
  assert.equal([...placementItems, ...reassessmentItems, ...removalItems].every((item) => item.owner === "user" && item.favorite === true), true);
});

test("isolation event details preserve captured method and support labels", () => {
  const event = {
    id: "evt_isolation_support_labels",
    timestamp: "2026-01-01T10:00:00.000Z",
    type: isolationEventTypes.rubberDamPlaced,
    workflowId: sharedIsolationWorkflow.workflowId,
    workflowVersion: sharedIsolationWorkflow.version,
    details: {
      method: "rubberDam",
      methodLabel: "Rubber dam with ligature support",
      exposedTeeth: ["36", "37"],
      clampCode: "W8A",
      clampTooth: "37",
      supports: [
        { type: "clamp", tooth: "37", clampCode: "W8A" },
        { type: "ligature", label: "Ligature", tooth: "36", notes: "Ligature placed" },
      ],
    },
  };
  const details = getIsolationEventDetails(event);
  const support = details.supports?.at(1);

  assert.equal(details.methodLabel, "Rubber dam with ligature support");
  assert.equal(support?.type, "ligature");
  assert.equal(support?.label, "Ligature");
  assert.equal(support?.tooth, "36");
  assert.equal(support?.notes, "Ligature placed");
  assert.equal(getIsolationCoverageSummary(event).method, "Rubber dam with ligature support");
  assert.match(eventFragment(event), /Rubber dam with ligature support placed/);
  assert.match(eventFragment(event), /Ligature on tooth 36 \(Ligature placed\)/);
});

test("shared catalog infrastructure merges customizable documentation catalog layers", () => {
  const userTechnique: CatalogItem = {
    id: "anesthesia.injection.techniques.clinic-shortcut",
    owner: "user",
    category: "anesthesia",
    label: "Clinic shortcut",
    aliases: ["CS"],
    appliesTo: { route: "injection", field: "techniques" },
    active: true,
    favorite: true,
    sortOrder: 5,
  };
  const hiddenSeedTechnique: CatalogItem = {
    ...seedAnesthesiaCatalogItems.find((item) => item.label === "Block")!,
    owner: "user",
    active: false,
  };
  const replacementSeedTechnique: CatalogItem = {
    ...seedAnesthesiaCatalogItems.find((item) => item.label === "Infiltration")!,
    owner: "clinic",
    label: "Clinic infiltration phrasing",
  };
  const merged = mergeCatalogItems(seedAnesthesiaCatalogItems, [userTechnique, hiddenSeedTechnique, replacementSeedTechnique]);
  const injectionTechniqueLabels = getCatalogLabels(merged, {
    category: "anesthesia",
    route: "injection",
    field: "techniques",
    includeAliases: true,
  });
  const topicalTechniqueLabels = getCatalogLabels(merged, {
    category: "anesthesia",
    route: "topical",
    field: "techniques",
  });

  assert.deepEqual(injectionTechniqueLabels.slice(0, 2), ["Clinic shortcut", "CS"]);
  assert.equal(injectionTechniqueLabels.includes("Clinic infiltration phrasing"), true);
  assert.equal(injectionTechniqueLabels.includes("Infiltration"), false);
  assert.equal(injectionTechniqueLabels.includes("Block"), false);
  assert.deepEqual(topicalTechniqueLabels, []);
  assert.deepEqual(getAnesthesiaCatalogOptions("injection", "techniques", [userTechnique]).slice(0, 1), ["Clinic shortcut"]);
});

test("user anesthesia catalog persistence loads, validates, and merges local user items", () => {
  const userAgent: CatalogItem = {
    id: "user.anesthesia.injection.agents.documented-agent",
    owner: "user",
    category: "anesthesia",
    label: "Documented user agent",
    appliesTo: { route: "injection", field: "agents" },
    active: true,
    favorite: true,
    sortOrder: 1,
  };
  const userTechnique: CatalogItem = {
    id: "user.anesthesia.injection.techniques.custom",
    owner: "user",
    category: "anesthesia",
    label: "User favorite technique",
    aliases: ["UFT"],
    appliesTo: { route: "injection", field: "techniques" },
    active: true,
    favorite: true,
    sortOrder: 1,
  };
  const hiddenUserTechnique: CatalogItem = {
    id: "user.anesthesia.injection.techniques.hidden",
    owner: "user",
    category: "anesthesia",
    label: "Hidden technique",
    appliesTo: { route: "injection", field: "techniques" },
    active: false,
    sortOrder: 0,
  };
  const userVasoconstrictorDose: CatalogItem = {
    id: "user.anesthesia.injection.vasoconstrictor-doses.custom",
    owner: "user",
    category: "anesthesia",
    label: "1:80K epinephrine/adrenaline",
    appliesTo: { route: "injection", field: "vasoconstrictorDoses" },
    active: true,
    sortOrder: 1,
  };
  const storage = memoryStorage();

  assert.deepEqual(loadUserAnesthesiaCatalogItems(storage), []);
  assert.deepEqual(loadUserAnesthesiaCatalogItems(memoryStorage({ [USER_ANESTHESIA_CATALOG_STORAGE_KEY]: "not json" })), []);
  assert.deepEqual(loadUserAnesthesiaCatalogItems(memoryStorage({ [USER_ANESTHESIA_CATALOG_STORAGE_KEY]: JSON.stringify({ version: 2, items: [userTechnique] }) })), []);

  saveUserAnesthesiaCatalogItems([
    userAgent,
    userTechnique,
    userVasoconstrictorDose,
    hiddenUserTechnique,
    { ...userTechnique, id: "seed-owned-ignored", owner: "seed" },
    { ...userTechnique, id: "wrong-category-ignored", category: "operative" },
  ], storage);

  const loadedItems = loadUserAnesthesiaCatalogItems(storage);
  const injectionAgents = getAnesthesiaCatalogOptions("injection", "agents", loadedItems);
  const injectionTechniques = getAnesthesiaCatalogOptions("injection", "techniques", loadedItems);
  const injectionVasoconstrictorDoses = getAnesthesiaCatalogOptions("injection", "vasoconstrictorDoses", loadedItems);
  const topicalTechniques = getAnesthesiaCatalogOptions("topical", "techniques", loadedItems);

  assert.deepEqual(loadedItems.map((item) => item.owner), ["user", "user", "user", "user"]);
  assert.equal(injectionAgents.includes("Documented user agent"), true);
  assert.equal(injectionTechniques[0], "User favorite technique");
  assert.equal(injectionVasoconstrictorDoses[0], "1:80K epinephrine/adrenaline");
  assert.equal(injectionTechniques.includes("Hidden technique"), false);
  assert.equal(injectionTechniques.includes("Infiltration"), true);
  assert.deepEqual(topicalTechniques, []);

  const administrationRecord = buildAnesthesiaEventFromForm("administration", {
    ...defaultAnesthesiaFormState("36"),
    agentLabel: injectionAgents[0],
    dose: "",
    doseUnit: "",
    vasoconstrictor: "With vasoconstrictor",
    vasoconstrictorDose: injectionVasoconstrictorDoses[0],
    administeredAt: "09:55",
  });
  const administrationEvent = {
    id: "evt_user_catalog_agent_no_inference",
    timestamp: "2026-01-01T09:55:00.000Z",
    type: administrationRecord!.eventType,
    tooth: "36",
    scope: { kind: "tooth" as const, tooth: "36" },
    details: administrationRecord!.details,
  };

  assert.equal(administrationRecord?.details.agentLabel, "Documented user agent");
  assert.equal(administrationRecord?.details.vasoconstrictorDose, "1:80K epinephrine/adrenaline");
  assert.equal(administrationRecord?.details.dose, undefined);
  assert.equal(administrationRecord?.details.doseUnit, undefined);
  assert.equal(administrationRecord?.options?.expiresAt, undefined);
  assert.equal(getAnesthesiaAdequateCapabilityOutput(administrationEvent), undefined);
});

test("anesthesia catalog management helpers create user shortcuts and seed overrides", () => {
  const userDoseShortcut = createUserAnesthesiaCatalogItem({
    route: "injection",
    field: "vasoconstrictorDoses",
    label: "1:50K epinephrine/adrenaline",
    favorite: true,
    sortOrder: 1,
  });
  const seedBlock = seedAnesthesiaCatalogItems.find((item) => item.label === "Block")!;
  const hiddenBlock = createUserAnesthesiaCatalogOverride(seedBlock, { active: false, favorite: seedBlock.favorite });
  const seedInfiltration = seedAnesthesiaCatalogItems.find((item) => item.label === "Infiltration")!;
  const favoriteInfiltration = createUserAnesthesiaCatalogOverride(seedInfiltration, { active: true, favorite: true });
  const techniqueLabels = getAnesthesiaCatalogOptions("injection", "techniques", [hiddenBlock, favoriteInfiltration]);
  const doseLabels = getAnesthesiaCatalogOptions("injection", "vasoconstrictorDoses", [userDoseShortcut]);

  assert.equal(userDoseShortcut.owner, "user");
  assert.equal(userDoseShortcut.category, "anesthesia");
  assert.deepEqual(userDoseShortcut.appliesTo, { route: "injection", field: "vasoconstrictorDoses" });
  assert.equal(techniqueLabels[0], "Infiltration");
  assert.equal(techniqueLabels.includes("Block"), false);
  assert.equal(doseLabels[0], "1:50K epinephrine/adrenaline");
});

test("anesthesia entry shortcut saving captures only catalog-backed documentation fields", () => {
  const injectionItems = buildUserAnesthesiaCatalogItemsFromForm({
    ...defaultAnesthesiaFormState("36"),
    route: "injection",
    agentLabel: "Custom agent",
    technique: "Custom technique",
    dose: "1.7",
    doseUnit: "Custom dose unit",
    administeredAt: "09:55",
    vasoconstrictor: "Custom vasoconstrictor",
    vasoconstrictorDose: "1:80K epinephrine/adrenaline",
    targetTeeth: "36 37",
    regionLabel: "Q3",
    expiresAt: "2026-01-01T10:30",
    note: "do not save",
  });
  const topicalItems = buildUserAnesthesiaCatalogItemsFromForm({
    ...defaultAnesthesiaFormState("36"),
    route: "topical",
    agentLabel: "Topical agent",
    applicationType: "Cotton roll topical",
    administeredAt: "09:56",
    note: "do not save",
  });
  const otherItems = buildUserAnesthesiaCatalogItemsFromForm({
    ...defaultAnesthesiaFormState("36"),
    route: "other",
    routeLabel: "Inhaled",
    applicationType: "Other custom application",
    site: "do not save",
  });

  assert.deepEqual(injectionItems.map((item) => item.appliesTo?.field), ["agents", "techniques", "doseUnits", "vasoconstrictors", "vasoconstrictorDoses"]);
  assert.deepEqual(injectionItems.map((item) => item.label), ["Custom agent", "Custom technique", "Custom dose unit", "Custom vasoconstrictor", "1:80K epinephrine/adrenaline"]);
  assert.equal(injectionItems.some((item) => ["1.7", "09:55", "36 37", "Q3", "2026-01-01T10:30", "do not save"].includes(item.label)), false);
  assert.deepEqual(topicalItems.map((item) => item.appliesTo?.field), ["agents", "applicationTypes"]);
  assert.deepEqual(otherItems.map((item) => item.appliesTo?.field), ["routeLabels", "applicationTypes"]);
  assert.equal(injectionItems.every((item) => item.owner === "user" && item.favorite === true), true);
});

test("shared anesthesia phase 6A uses explicit clinician-entered reassessment time only", () => {
  const assessmentForm = {
    ...defaultAnesthesiaFormState("36"),
    response: "adequate" as const,
    targetTeeth: "36",
    expiresAt: "2026-01-01T10:30",
  };
  const assessmentRecord = buildAnesthesiaEventFromForm("assessment", assessmentForm);

  assert.equal(assessmentRecord?.eventType, anesthesiaEventTypes.adequacyConfirmed);
  assert.equal(assessmentRecord?.options?.expiresAt, "2026-01-01T10:30");

  const adequacyEvent = {
    id: "evt_anesthesia_explicit_reassess_after",
    timestamp: "2026-01-01T10:00:00.000Z",
    type: assessmentRecord!.eventType,
    tooth: "36",
    scope: { kind: "tooth" as const, tooth: "36" },
    expiresAt: assessmentRecord!.options?.expiresAt,
    details: assessmentRecord!.details,
  };
  const capability = getAnesthesiaAdequateCapabilityOutput(adequacyEvent);
  const expiredCase = baseCase({
    tooth: "36",
    globalEvents: [
      {
        ...adequacyEvent,
        capabilitiesSatisfied: capability ? [capability] : [],
      },
    ],
  });
  const expiredStatus = getCapabilityStatus(expiredCase, "anesthesia.adequate", { kind: "tooth", tooth: "36" }, new Date("2026-01-01T10:31"));

  assert.equal(capability?.expiresAt, "2026-01-01T10:30");
  assert.equal(expiredStatus.satisfied, false);
  assert.equal(expiredStatus.needsReassessment, true);
  assert.match(eventFragment(adequacyEvent), /Reassess after: 2026-01-01T10:30/);

  const administrationForm = {
    ...defaultAnesthesiaFormState("36"),
    technique: getAnesthesiaCatalogOptions("injection", "techniques")[0],
    dose: "1.7",
    doseUnit: getAnesthesiaCatalogOptions("injection", "doseUnits")[0],
    administeredAt: "09:55",
    vasoconstrictor: getAnesthesiaCatalogOptions("injection", "vasoconstrictors")[0],
    vasoconstrictorDose: getAnesthesiaCatalogOptions("injection", "vasoconstrictorDoses")[0],
  };
  const administrationRecord = buildAnesthesiaEventFromForm("administration", administrationForm);
  const administrationEvent = {
    id: "evt_anesthesia_admin_no_expiry",
    timestamp: "2026-01-01T09:55:00.000Z",
    type: administrationRecord!.eventType,
    tooth: "36",
    scope: { kind: "tooth" as const, tooth: "36" },
    details: administrationRecord!.details,
  };
  const administrationCase = baseCase({ tooth: "36", globalEvents: [administrationEvent] });
  const administrationStatus = getCapabilityStatus(administrationCase, "anesthesia.adequate", { kind: "tooth", tooth: "36" }, new Date("2026-01-01T10:31"));

  assert.equal(administrationRecord?.options, undefined);
  assert.equal(administrationRecord?.details.technique, "Infiltration");
  assert.equal(administrationRecord?.details.doseUnit, "mL");
  assert.equal(administrationRecord?.details.vasoconstrictor, "With vasoconstrictor");
  assert.equal(administrationRecord?.details.vasoconstrictorDose, "1:100K epinephrine/adrenaline");
  assert.equal(getAnesthesiaAdequateCapabilityOutput(administrationEvent), undefined);
  assert.equal(administrationStatus.satisfied, false);
  assert.equal(administrationStatus.needsReassessment, false);
});

test("shared anesthesia workflow records explicit adequacy without inferring it from administration", () => {
  const administeredEvent = {
    id: "evt_anesthesia_admin",
    timestamp: "2026-01-01T09:55:00.000Z",
    type: anesthesiaEventTypes.administered,
    workflowId: sharedAnesthesiaWorkflow.workflowId,
    workflowVersion: sharedAnesthesiaWorkflow.version,
    tooth: "36",
    scope: { kind: "tooth" as const, tooth: "36" },
    details: {
      agentLabel: "documented anesthetic",
      technique: "documented technique",
      dose: "1",
      doseUnit: "unit",
      response: "assessment pending",
    },
  };
  const adequacyEvent = {
    ...administeredEvent,
    id: "evt_anesthesia_adequate",
    timestamp: "2026-01-01T10:00:00.000Z",
    type: anesthesiaEventTypes.adequacyConfirmed,
  };
  const administeredCase = baseCase({ tooth: "36", globalEvents: [administeredEvent] });
  const adequateCase = baseCase({
    tooth: "36",
    globalEvents: [
      {
        ...adequacyEvent,
        capabilitiesSatisfied: [buildAnesthesiaAdequateCapability(adequacyEvent)],
      },
    ],
  });

  assert.equal(sharedAnesthesiaWorkflow.entryNodeIds[0], "anesthesia-record");
  assert.equal(getAnesthesiaAdequateCapabilityOutput(administeredEvent), undefined);
  assert.equal(getAnesthesiaAdequateCapabilityOutput(adequacyEvent)?.name, "anesthesia.adequate");
  assert.equal(isCapabilitySatisfied(administeredCase, "anesthesia.adequate", { kind: "tooth", tooth: "36" }), false);
  assert.equal(isCapabilitySatisfied(adequateCase, "anesthesia.adequate", { kind: "tooth", tooth: "36" }), true);
  assert.match(eventFragment(administeredEvent), /Anesthesia administered/);
  assert.match(buildFullNote(adequateCase), /Anesthesia adequacy confirmed/);
});

test("shared anesthesia capability fallback requires explicit top-up adequacy and reassessment invalidates it", () => {
  const topUpWithoutAdequacyEvent = {
    id: "evt_anesthesia_topup_partial",
    timestamp: "2026-01-01T10:00:00.000Z",
    type: anesthesiaEventTypes.topUpGiven,
    tooth: "36",
    scope: { kind: "tooth" as const, tooth: "36" },
    details: { response: "partial" },
  };
  const topUpAdequateEvent = {
    id: "evt_anesthesia_topup_adequate",
    timestamp: "2026-01-01T10:05:00.000Z",
    type: anesthesiaEventTypes.topUpGiven,
    tooth: "36",
    scope: { kind: "tooth" as const, tooth: "36" },
    details: { response: "adequate" },
  };
  const reassessmentEvent = {
    id: "evt_anesthesia_reassess",
    timestamp: "2026-01-01T10:10:00.000Z",
    type: anesthesiaEventTypes.needsReassessment,
    tooth: "36",
    scope: { kind: "tooth" as const, tooth: "36" },
    details: { reason: "clinician reassessment requested" },
  };
  const topUpWithoutAdequacyCase = baseCase({
    tooth: "36",
    globalEvents: [topUpWithoutAdequacyEvent],
  });
  const topUpAdequateCase = baseCase({
    tooth: "36",
    globalEvents: [topUpAdequateEvent],
  });
  const reassessmentCase = baseCase({
    tooth: "36",
    globalEvents: [
      topUpAdequateEvent,
      reassessmentEvent,
    ],
  });
  const partialTopUpStatus = getCapabilityStatus(topUpWithoutAdequacyCase, "anesthesia.adequate", { kind: "tooth", tooth: "36" });
  const adequateTopUpStatus = getCapabilityStatus(topUpAdequateCase, "anesthesia.adequate", { kind: "tooth", tooth: "36" });
  const reassessmentStatus = getCapabilityStatus(reassessmentCase, "anesthesia.adequate", { kind: "tooth", tooth: "36" });

  assert.equal(getAnesthesiaAdequateCapabilityOutput(topUpWithoutAdequacyEvent), undefined);
  assert.equal(getAnesthesiaAdequateCapabilityOutput(topUpAdequateEvent)?.name, "anesthesia.adequate");
  assert.equal(partialTopUpStatus.satisfied, false);
  assert.equal(partialTopUpStatus.needsReassessment, false);
  assert.equal(adequateTopUpStatus.satisfied, true);
  assert.equal(adequateTopUpStatus.needsReassessment, false);
  assert.equal(reassessmentStatus.satisfied, false);
  assert.equal(reassessmentStatus.needsReassessment, true);
  assert.match(eventFragment(reassessmentEvent), /Anesthesia needs reassessment: clinician reassessment requested/);
});

test("clinical event schema accepts optional workflow context without requiring it", () => {
  assert.equal(ClinicalEventSchema.safeParse({
    id: "evt_legacy",
    timestamp: "2026-01-01T00:00:00.000Z",
    type: "preop.reviewCompleted",
  }).success, true);

  assert.equal(ClinicalEventSchema.safeParse({
    id: "evt_isolation",
    timestamp: "2026-01-01T00:00:00.000Z",
    type: "isolation.rubberDamPlaced",
    workflowId: "shared.isolation",
    workflowVersion: "1.0.0",
    workflowRunId: "run_isolation_1",
    parentWorkflowRunId: "run_endo_1",
    nodeId: "rubber-dam-placement",
    scope: {
      kind: "custom",
      teeth: ["34", "35", "36", "37"],
      regionLabel: "Q3",
    },
    capabilitiesSatisfied: [
      {
        name: "isolation.established",
        scope: {
          kind: "tooth",
          tooth: "36",
        },
        workflowId: "shared.isolation",
        workflowRunId: "run_isolation_1",
        satisfiedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  }).success, true);

  const embeddedAnesthesiaEvent = {
    id: "evt_anesthesia_embedded",
    timestamp: "2026-01-01T00:05:00.000Z",
    type: anesthesiaEventTypes.adequacyConfirmed,
    workflowId: sharedAnesthesiaWorkflowId,
    workflowVersion: sharedAnesthesiaWorkflow.version,
    workflowRunId: "run_anesthesia_1",
    parentWorkflowRunId: "run_endo_1",
    nodeId: "anesthesia-record",
    tooth: "36",
    scope: {
      kind: "tooth" as const,
      tooth: "36",
    },
    details: {
      response: "adequate",
      parentNodeId: "preop",
    },
  };
  const embeddedAnesthesiaCapability = buildAnesthesiaAdequateCapability(embeddedAnesthesiaEvent);

  assert.equal(embeddedAnesthesiaCapability.workflowRunId, "run_anesthesia_1");
  assert.equal(ClinicalEventSchema.safeParse({
    ...embeddedAnesthesiaEvent,
    capabilitiesSatisfied: [embeddedAnesthesiaCapability],
  }).success, true);
});

test("capability selectors derive diagnosis and radiograph status from case fields", () => {
  const caseData = baseCase({
    diagnosis: { pulpal: "Necrotic pulp", apical: "" },
    preOp: { radiographsReviewed: false, paReviewed: true, cbctReviewed: false, estimatedChamberDepth: "5" },
  });
  const summary = getCaseCapabilitySummary(caseData);

  assert.equal(summary.diagnosis.satisfied, true);
  assert.equal(summary.diagnosis.source, "caseField");
  assert.equal(summary.radiographs.satisfied, true);
  assert.equal(summary.radiographs.source, "caseField");
  assert.equal(summary.anesthesia.satisfied, false);
  assert.equal(summary.isolation.satisfied, false);
});

test("capability selectors match isolation events by exposed tooth and invalidate after compromise", () => {
  const rubberDamEvent = {
    id: "evt_rd",
    timestamp: "2026-01-01T10:00:00.000Z",
    type: isolationEventTypes.rubberDamPlaced,
    workflowId: sharedIsolationWorkflow.workflowId,
    workflowVersion: sharedIsolationWorkflow.version,
    scope: { kind: "custom" as const, teeth: ["34", "35", "36", "37"], regionLabel: "Q3" },
    details: {
      method: "rubberDam",
      regionKind: "quadrant",
      regionLabel: "Q3",
      exposedTeeth: ["34", "35", "36", "37"],
      supports: [{ type: "clamp", tooth: "37", clampCode: "W8A" }],
    },
  };
  const isolatedCase = baseCase({
    tooth: "36",
    globalEvents: [
      {
        ...rubberDamEvent,
        capabilitiesSatisfied: [buildIsolationEstablishedCapability(rubberDamEvent)],
      },
    ],
  });

  assert.equal(isCapabilitySatisfied(isolatedCase, "isolation.established", { kind: "tooth", tooth: "36" }), true);
  assert.equal(isCapabilitySatisfied(isolatedCase, "isolation.established", { kind: "tooth", tooth: "46" }), false);
  assert.deepEqual(getIsolationCoverageSummary(rubberDamEvent), {
    method: "Rubber dam",
    region: "Quadrant: Q3",
    exposedTeeth: "34, 35, 36, 37",
    clampCode: "W8A",
    clampTooth: "37",
  });
  assert.match(eventFragment(rubberDamEvent), /Rubber dam isolation placed/);
  assert.match(eventFragment(rubberDamEvent), /Clamp W8A on tooth 37/);
  assert.match(buildFullNote(isolatedCase), /Rubber dam isolation placed/);

  const compromisedCase: EndoCase = {
    ...isolatedCase,
    globalEvents: [
      ...isolatedCase.globalEvents,
      {
        id: "evt_rd_compromised",
        timestamp: "2026-01-01T10:05:00.000Z",
        type: isolationEventTypes.compromised,
        scope: { kind: "tooth", tooth: "36" },
        details: { reason: "saliva contamination" },
      },
    ],
  };
  const status = getCapabilityStatus(compromisedCase, "isolation.established", { kind: "tooth", tooth: "36" });

  assert.equal(status.satisfied, false);
  assert.equal(status.needsReassessment, true);
  assert.match(eventFragment(compromisedCase.globalEvents[1]), /Isolation compromised: saliva contamination/);
});

test("alternative isolation establishes capability and formats without optional clamp or exposed teeth", () => {
  const alternativeIsolationEvent = {
    id: "evt_alt_iso",
    timestamp: "2026-01-01T10:00:00.000Z",
    type: isolationEventTypes.alternativeIsolationUsed,
    workflowId: sharedIsolationWorkflow.workflowId,
    workflowVersion: sharedIsolationWorkflow.version,
    details: {
      method: "cottonRoll",
      regionKind: "quadrant",
      regionLabel: "Q3",
    },
  };
  const caseData = baseCase({
    tooth: "36",
    globalEvents: [alternativeIsolationEvent],
  });
  const status = getCapabilityStatus(caseData, "isolation.established", { kind: "quadrant", regionLabel: "Q3" });
  const fragment = eventFragment(alternativeIsolationEvent);

  assert.equal(status.satisfied, true);
  assert.equal(status.needsReassessment, false);
  assert.equal(isCapabilitySatisfied(caseData, "isolation.established", { kind: "quadrant", regionLabel: "Q3" }), true);
  assert.deepEqual(getIsolationCoverageSummary(alternativeIsolationEvent), {
    method: "Cotton roll",
    region: "Quadrant: Q3",
    exposedTeeth: "not recorded",
    clampCode: "not recorded",
    clampTooth: "not recorded",
  });
  assert.equal(fragment, "Alternative isolation used (cottonRoll) (Q3).");
  assert.doesNotMatch(fragment, /Clamp/);
  assert.doesNotMatch(fragment, /isolated teeth/);
});

test("shared isolation replacement re-establishes the isolation capability", () => {
  const caseData = baseCase({
    tooth: "36",
    globalEvents: [
      {
        id: "evt_rd",
        timestamp: "2026-01-01T10:00:00.000Z",
        type: isolationEventTypes.rubberDamPlaced,
        details: { exposedTeeth: ["36"], clampCode: "W8A", clampTooth: "37" },
      },
      {
        id: "evt_rd_removed",
        timestamp: "2026-01-01T10:10:00.000Z",
        type: isolationEventTypes.removed,
        scope: { kind: "tooth", tooth: "36" },
      },
      {
        id: "evt_rd_replaced",
        timestamp: "2026-01-01T10:15:00.000Z",
        type: isolationEventTypes.replaced,
        details: { exposedTeeth: ["36"], clampCode: "W14A", clampTooth: "36" },
      },
    ],
  });
  const removedCase = baseCase({
    tooth: "36",
    globalEvents: caseData.globalEvents.slice(0, 2),
  });
  const removedStatus = getCapabilityStatus(removedCase, "isolation.established", { kind: "tooth", tooth: "36" });
  const status = getCapabilityStatus(caseData, "isolation.established", { kind: "tooth", tooth: "36" });

  assert.equal(sharedIsolationWorkflow.workflowId, "shared.isolation");
  assert.equal(sharedIsolationWorkflow.completionNodeIds.includes("isolation-complete"), true);
  assert.equal(removedStatus.satisfied, false);
  assert.equal(removedStatus.needsReassessment, true);
  assert.match(eventFragment(removedCase.globalEvents[1]), /Isolation removed/);
  assert.equal(status.satisfied, true);
  assert.equal(status.needsReassessment, false);
  assert.match(eventFragment(caseData.globalEvents[2]), /Isolation replaced/);
  assert.match(eventFragment(caseData.globalEvents[2]), /Clamp W14A on tooth 36/);
});

test("shared isolation reassessment node exposes recordable actions", () => {
  const reassessmentNode = sharedIsolationWorkflow.nodes["isolation-needs-reassessment"];
  const eventTypes = reassessmentNode.options.map((option) => option.noteEvent?.type).filter(Boolean);

  assert.equal(sharedIsolationWorkflow.completionNodeIds.includes("isolation-needs-reassessment"), true);
  assert.deepEqual(eventTypes, [
    isolationEventTypes.compromised,
    isolationEventTypes.replaced,
    isolationEventTypes.removed,
  ]);
});

test("capability selectors use explicit capability expiry for reassessment", () => {
  const caseData = baseCase({
    globalEvents: [
      {
        id: "evt_anesthesia",
        timestamp: "2026-01-01T10:00:00.000Z",
        type: "anesthesia.localDelivered",
        capabilitiesSatisfied: [
          {
            name: "anesthesia.adequate",
            scope: { kind: "tooth", tooth: "36" },
            expiresAt: "2026-01-01T10:30:00.000Z",
          },
        ],
      },
    ],
  });
  const status = getCapabilityStatus(caseData, "anesthesia.adequate", { kind: "tooth", tooth: "36" }, new Date("2026-01-01T10:31:00.000Z"));

  assert.equal(status.satisfied, false);
  assert.equal(status.needsReassessment, true);
});

test("normalized JSON import preserves exported case data", () => {
  const caseData = baseCase({
    caseStatus: "Resume next visit",
    difficulty: "high",
    nextVisitPlan: "Continue obturation",
    priorVisit: {
      continuedFromPriorVisit: true,
      accessPreviouslyOpened: true,
      temporaryRestorationPresent: true,
      medicationPresent: "yes",
      sourceNote: "Prior opening before app use.",
    },
    currentCanal: "DB",
    canals: [
      { ...blankCanal("MB"), priorVisitStatus: "medicatedTemporized", priorVisitNote: "CaOH placed", estimatedWorkingLength: "20", wlRadiographStatus: "not taken", coneFitRadiograph: "acceptable" },
      { ...blankCanal("DB"), estimatedWorkingLength: "21", shapingLength: "20", wlRadiographStatus: "short", coneFitRadiograph: "not taken" },
    ],
    globalEvents: [
      { id: "evt_mb", timestamp: "2026-01-01T00:00:00.000Z", type: "scouting.estimatedWLSet", canal: "MB" },
      { id: "evt_db", timestamp: "2026-01-01T00:01:00.000Z", type: "workingLength.established", canal: "DB" },
    ],
  });
  const exported = buildJsonExport(caseData, "patency-10c");
  const imported = normalizeImportedEndoCase(exported, "2026-01-01T00:02:00.000Z");

  assert.equal(imported.canals.length, 2);
  assert.equal(imported.currentCanal, "DB");
  assert.equal(imported.canals[0].estimatedWorkingLength, "20");
  assert.equal(imported.canals[0].wlRadiographStatus, "not taken");
  assert.equal(imported.canals[0].coneFitRadiograph, "acceptable");
  assert.equal(imported.canals[0].priorVisitStatus, "medicatedTemporized");
  assert.equal(imported.canals[0].priorVisitNote, "CaOH placed");
  assert.equal(imported.canals[1].shapingLength, "20");
  assert.equal(imported.canals[1].events?.length, 1);
  assert.equal(imported.globalEvents.length, 2);
  assert.equal(imported.caseStatus, "Resume next visit");
  assert.equal(imported.difficulty, "high");
  assert.equal(imported.nextVisitPlan, "Continue obturation");
  assert.equal(imported.priorVisit?.continuedFromPriorVisit, true);
  assert.equal(imported.priorVisit?.sourceNote, "Prior opening before app use.");
});
