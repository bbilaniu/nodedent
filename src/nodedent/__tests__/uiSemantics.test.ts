import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnesthesiaEventForm } from "../components/AnesthesiaEventForm";
import { AccessibleDialog } from "../components/AccessibleDialog";
import { AppFooter } from "../components/AppFooter";
import { CataloguePage } from "../components/CataloguePage";
import { PriorVisitModal, SavedCasesModal } from "../components/CaseManagementModal";
import { ClinicalDataNotice } from "../components/ClinicalDataNotice";
import { DeploymentConfigurationError } from "../components/DeploymentConfigurationError";
import { DeploymentModeBanner } from "../components/DeploymentModeBanner";
import { DifficultyBanner } from "../components/DifficultyBanner";
import { EndodonticEndVisitDialog } from "../components/EndodonticEndVisitDialog";
import { EndodonticTargetPanel } from "../components/EndodonticTargetPanel";
import { EventLog } from "../components/EventLog";
import { SelectInput, TextInput } from "../components/FormControls";
import { NotePreview } from "../components/NotePreview";
import { PhaseCanalMapModal } from "../components/PhaseCanalMapModal";
import { RadiologyEventForm } from "../components/RadiologyEventForm";
import { SandboxDataWarning } from "../components/SandboxDataWarning";
import { SemanticStateGallery } from "../components/SemanticStateGallery";
import { WorkflowLauncher } from "../components/WorkflowLauncher";
import {
  semanticActionButton,
  semanticChoiceControl,
  semanticChoiceSurfaceControl,
  semanticDialogSurface,
  semanticFormControl,
  semanticInteraction,
  semanticSelectionSurface,
  semanticSelectionTone,
  semanticReadOnlyOutput,
  semanticStatusSurface,
  semanticStatusTone,
} from "../components/uiStyles";
import type { DeploymentIdentity } from "../deploymentMode";
import { blankCanal, initialCase } from "../state/persistence";

test("semantic action roles own focus, pressed, disabled, and consequence treatments", () => {
  for (const className of [
    semanticActionButton.primary,
    semanticActionButton.secondary,
    semanticActionButton.warning,
    semanticActionButton.destructive,
  ]) {
    assert.match(className, /focus-visible:outline-2/);
    assert.match(className, /active:/);
    assert.match(className, /disabled:cursor-not-allowed/);
  }

  assert.match(semanticActionButton.primary, /bg-brand-navy/);
  assert.doesNotMatch(semanticActionButton.primary, /brand-mint/);
  assert.match(semanticActionButton.secondary, /bg-white/);
  assert.match(semanticActionButton.warning, /amber/);
  assert.match(semanticActionButton.destructive, /red/);
  assert.match(semanticActionButton.warningDecision, /semantic-action-warning/);
  assert.match(semanticActionButton.warningDecision, /min-h-14/);
  assert.match(semanticActionButton.destructiveDecision, /semantic-action-destructive/);
  assert.match(semanticInteraction.loading, /cursor-wait/);
});

test("dialog contracts separate dismissal, decisions, selection, and status", () => {
  assert.match(semanticDialogSurface.overlay, /fixed inset-0/);
  assert.match(semanticDialogSurface.panel, /shadow-2xl/);

  const endVisitMarkup = renderToStaticMarkup(React.createElement(EndodonticEndVisitDialog, {
    activeCanalName: "Main",
    currentNodeTitle: "Synthetic shaping step",
    currentPhase: "Shaping",
    initialNextVisitPlan: "Continue shaping",
    onSelectAction: () => {},
    onClose: () => {},
  }));
  assert.match(endVisitMarkup, /role="dialog" aria-modal="true"/);
  assert.match(endVisitMarkup, /semantic-action-secondary[^"]*[^>]*>Cancel/);
  assert.match(endVisitMarkup, /min-h-14[^"]*semantic-action-primary[^"]*[^>]*><span class="block">Pause here/);
  assert.equal((endVisitMarkup.match(/semantic-action-warning/g) || []).length, 2);
  assert.doesNotMatch(endVisitMarkup, /semantic-action-destructive/);
  assert.match(endVisitMarkup, /focus:border-brand-blue/);
  assert.doesNotMatch(endVisitMarkup, /focus:border-brand-mint/);

  const phaseMarkup = renderToStaticMarkup(React.createElement(PhaseCanalMapModal, {
    caseData: { ...initialCase, currentCanal: "Main", canals: [blankCanal("Main"), blankCanal("DB")] },
    currentPhase: "Pre-op",
    progressPhase: "Pre-op",
    onSelectProgressPhase: () => {},
    onSelectCanal: () => {},
    onClose: () => {},
  }));
  assert.match(phaseMarkup, /role="dialog" aria-modal="true"/);
  assert.match(phaseMarkup, /aria-pressed="true"/);
  assert.match(phaseMarkup, /aria-pressed="false"/);
  assert.match(phaseMarkup, /semantic-selection-selected/);
  assert.match(phaseMarkup, /data-phase-status=/);
  assert.doesNotMatch(phaseMarkup, /semantic-selection-selected[^"]*bg-brand-navy/);

  const savedCasesMarkup = renderToStaticMarkup(React.createElement(SavedCasesModal, {
    savedCases: [],
    importText: "",
    showImportBox: true,
    onClose: () => {},
    onToggleImportBox: () => {},
    onImportTextChange: () => {},
    onImportCaseJson: () => {},
    onClearSavedCurrentCase: () => {},
    onResetAllSavedCases: () => {},
    onLoadSavedCase: () => {},
    onDeleteSavedCase: () => {},
    onDownloadEncryptedVaultBackup: () => {},
    onPreviewEncryptedBackupImport: async () => { throw new Error("not called"); },
    onResolveEncryptedBackupImport: async () => { throw new Error("not called"); },
    recoveryHistory: [],
    activeEncounterId: initialCase.encounterId,
    onRestoreRecoveryHistoryEntry: async () => {},
    onLockForRestore: () => {},
  }));
  assert.match(savedCasesMarkup, /aria-labelledby="saved-cases-dialog-title"/);
  assert.match(savedCasesMarkup, /semantic-action-warning[^"]*[^>]*>Import case JSON/);
  assert.equal((savedCasesMarkup.match(/semantic-action-destructive/g) || []).length, 2);
  assert.match(savedCasesMarkup, /semantic-status-attention[^"]*[^>]*>Case JSON is plaintext clinical data/);
  assert.match(savedCasesMarkup, /aria-label="Recent case autosaves"/);

  const priorVisitMarkup = renderToStaticMarkup(React.createElement(PriorVisitModal, {
    caseData: {
      ...initialCase,
      priorVisit: { ...initialCase.priorVisit, accessPreviouslyOpened: true },
    },
    onClose: () => {},
    onUpdateCase: () => {},
    onContinueFromPriorVisit: () => {},
    onResumeActiveCanalFromPriorVisit: () => {},
    canResumeActiveCanalFromPriorVisit: true,
  }));
  assert.match(priorVisitMarkup, /aria-labelledby="prior-visit-dialog-title"/);
  assert.match(priorVisitMarkup, /semantic-action-primary[^"]*[^>]*>Mark as continued/);
  assert.match(priorVisitMarkup, /semantic-selection-selected/);
  assert.match(priorVisitMarkup, /semantic-selection-unselected/);
  assert.match(priorVisitMarkup, /semantic-action-destructive/);
  assert.doesNotMatch(priorVisitMarkup, /focus:border-brand-mint/);
});

test("accessible dialog primitive exposes the runtime behavior hooks", () => {
  const markup = renderToStaticMarkup(React.createElement(AccessibleDialog, {
    labelledBy: "synthetic-dialog-title",
    describedBy: "synthetic-dialog-description",
    role: "alertdialog",
    closeOnBackdrop: true,
    onRequestClose: () => {},
    children: React.createElement(React.Fragment, null,
      React.createElement("h2", { id: "synthetic-dialog-title" }, "Synthetic confirmation"),
      React.createElement("p", { id: "synthetic-dialog-description" }, "Synthetic description"),
      React.createElement("button", { type: "button", "data-dialog-initial-focus": true }, "Cancel"),
    ),
  }));

  assert.match(markup, /data-accessible-dialog-overlay="true"/);
  assert.match(markup, /role="alertdialog" aria-modal="true"/);
  assert.match(markup, /aria-labelledby="synthetic-dialog-title"/);
  assert.match(markup, /aria-describedby="synthetic-dialog-description"/);
  assert.match(markup, /tabindex="-1"/);
  assert.match(markup, /data-dialog-initial-focus="true"/);
});

test("selection and status contracts do not reuse primary-action meaning", () => {
  assert.match(semanticChoiceControl.selected, /bg-brand-blue-light\/20/);
  assert.match(semanticChoiceControl.selected, /border-brand-blue/);
  assert.doesNotMatch(semanticChoiceControl.selected, /bg-brand-navy/);
  assert.doesNotMatch(semanticChoiceControl.selected, /brand-mint/);
  assert.match(semanticChoiceControl.indicatorSelected, /bg-brand-blue/);
  assert.match(semanticChoiceSurfaceControl.selected, /semantic-selection-selected/);
  assert.doesNotMatch(semanticChoiceSurfaceControl.selected, /bg-brand-navy/);
  assert.match(semanticSelectionSurface.selected, /semantic-selection-selected/);
  assert.match(semanticSelectionSurface.selected, /bg-brand-blue-light\/20/);
  assert.doesNotMatch(semanticSelectionSurface.selected, /brand-mint/);
  assert.match(semanticSelectionTone.unselected, /semantic-selection-unselected/);

  assert.match(semanticStatusTone.positive, /brand-mint/);
  assert.match(semanticStatusTone.attention, /amber/);
  assert.match(semanticStatusTone.neutral, /brand-light-node/);
  assert.match(semanticStatusTone.difficulty, /orange/);
  assert.match(semanticStatusTone.danger, /red/);
  assert.match(semanticStatusSurface.attention, /semantic-status-surface/);
  assert.match(semanticStatusSurface.danger, /semantic-status-danger/);

  assert.match(semanticFormControl.default, /focus:border-brand-blue/);
  assert.doesNotMatch(semanticFormControl.default, /focus:border-brand-mint/);
  assert.match(semanticFormControl.invalid, /focus:border-red-400/);
  assert.match(semanticReadOnlyOutput, /focus-visible:outline-brand-blue/);
});

test("shared form controls connect invalid state to field-specific help", () => {
  const textMarkup = renderToStaticMarkup(React.createElement(TextInput, {
    id: "synthetic-text-field",
    label: "Synthetic text field",
    value: "",
    invalid: true,
    helperText: "Enter a synthetic value.",
    onChange: () => {},
  }));
  const selectMarkup = renderToStaticMarkup(React.createElement(SelectInput, {
    id: "synthetic-select-field",
    label: "Synthetic select field",
    value: "",
    options: ["", "Recorded"],
    invalid: true,
    helperText: "Select a synthetic value.",
    onChange: () => {},
  }));

  assert.match(textMarkup, /id="synthetic-text-field"[^>]*aria-invalid="true"[^>]*aria-describedby="synthetic-text-field-helper"/);
  assert.match(textMarkup, /id="synthetic-text-field-helper"[^>]*>Enter a synthetic value/);
  assert.match(selectMarkup, /id="synthetic-select-field"[^>]*aria-invalid="true"[^>]*aria-describedby="synthetic-select-field-helper"/);
  assert.match(selectMarkup, /id="synthetic-select-field-helper"[^>]*>Select a synthetic value/);
});

test("application chrome and notices keep status separate from action hierarchy", () => {
  const betaIdentity: DeploymentIdentity = {
    mode: "beta",
    branch: "beta",
    commitSha: "abcdef1",
    expectedOrigin: "beta.example",
  };
  const sandboxIdentity: DeploymentIdentity = {
    mode: "sandbox",
    branch: "feature/semantic-ui",
    commitSha: "abcdef1",
    sandboxKind: "development",
  };

  const deploymentBanner = renderToStaticMarkup(React.createElement(DeploymentModeBanner, { identity: betaIdentity }));
  assert.match(deploymentBanner, /semantic-status-attention/);
  assert.doesNotMatch(deploymentBanner, /bg-brand-navy/);

  const clinicalNotice = renderToStaticMarkup(React.createElement(ClinicalDataNotice, { compact: true }));
  assert.match(clinicalNotice, /semantic-status-attention/);
  const sandboxNotice = renderToStaticMarkup(React.createElement(SandboxDataWarning, { identity: sandboxIdentity }));
  assert.match(sandboxNotice, /semantic-status-attention/);

  const difficultyBanner = renderToStaticMarkup(React.createElement(DifficultyBanner, {
    caseData: { ...initialCase, difficulty: "high" },
    currentPhase: "Synthetic phase",
    activeCanal: null,
    onOpenPhaseMap: () => {},
  }));
  assert.match(difficultyBanner, /semantic-status-difficulty/);
  assert.match(difficultyBanner, /semantic-action-secondary/);
  assert.doesNotMatch(difficultyBanner, /semantic-action-primary/);

  assert.match(renderToStaticMarkup(React.createElement(DeploymentConfigurationError)), /semantic-status-danger/);
  const footer = renderToStaticMarkup(React.createElement(AppFooter, { identity: betaIdentity }));
  assert.match(footer, /focus-visible:outline-brand-blue/);
  assert.doesNotMatch(footer, /focus-visible:ring-brand-mint/);
});

test("primary-workflow and shared-module launchers render the same primary contract", () => {
  const noop = () => {};
  const markup = renderToStaticMarkup(React.createElement(WorkflowLauncher, {
    caseData: initialCase,
    currentNodeTitle: "Pre-op setup",
    currentNodePhase: "Pre-op",
    savedCaseCount: 0,
    presentation: "page",
    onClose: noop,
    onContinueEndodonticWorkflow: noop,
    onOpenCaseSetupStatus: noop,
    onOpenSavedCases: noop,
    onOpenPriorVisit: noop,
    onOpenNewCaseConfirm: noop,
    onOpenPrimaryWorkflowSetup: noop,
    onOpenAnesthesiaWorkflow: noop,
    onOpenIsolationWorkflow: noop,
    onOpenRadiologyWorkflow: noop,
  }));
  const launcherClass = `class="${semanticActionButton.primary} mt-3"`;

  assert.equal(markup.split(launcherClass).length - 1, 5);
  assert.match(markup, /Primary workflows[\s\S]*Start workflow/);
  assert.match(markup, /Shared modules[\s\S]*Open anesthesia workflow/);

  const modalMarkup = renderToStaticMarkup(React.createElement(WorkflowLauncher, {
    caseData: initialCase,
    currentNodeTitle: "Pre-op setup",
    currentNodePhase: "Pre-op",
    savedCaseCount: 0,
    presentation: "modal",
    onClose: noop,
    onContinueEndodonticWorkflow: noop,
    onOpenCaseSetupStatus: noop,
    onOpenSavedCases: noop,
    onOpenPriorVisit: noop,
    onOpenNewCaseConfirm: noop,
    onOpenPrimaryWorkflowSetup: noop,
    onOpenAnesthesiaWorkflow: noop,
    onOpenIsolationWorkflow: noop,
    onOpenRadiologyWorkflow: noop,
  }));
  assert.match(modalMarkup, /role="dialog" aria-modal="true" aria-labelledby="workflow-launcher-dialog-title"/);
  assert.match(modalMarkup, /semantic-action-secondary[^"]*[^>]*>Close/);
});

test("target selection stays separate from canal status", () => {
  const noop = () => {};
  const markup = renderToStaticMarkup(React.createElement(EndodonticTargetPanel, {
    caseData: { ...initialCase, tooth: "36", canals: [blankCanal("Main"), blankCanal("DB")] },
    newCanalName: "",
    renameCanalName: "Main",
    onNewCanalNameChange: noop,
    onRenameCanalNameChange: noop,
    onSelectCanal: noop,
    onAddCanal: noop,
    onRenameActiveCanal: noop,
    onDeleteActiveCanal: noop,
    onManualEvent: noop,
    onResetManualStatus: noop,
    onOpenPhaseMap: noop,
    onOpenCaseSetupStatus: noop,
  }));

  assert.match(markup, /aria-pressed="true"/);
  assert.match(markup, /aria-pressed="false"/);
  assert.match(markup, /semantic-selection-selected/);
  assert.match(markup, /data-clinical-status="notStarted"/);
  assert.doesNotMatch(markup, /semantic-selection-selected[^\"]*bg-brand-navy/);
});

test("history and output surfaces expose list, tab, focus, and plaintext consequence semantics", () => {
  const eventMarkup = renderToStaticMarkup(React.createElement(EventLog, {
    events: [{ id: "evt-1", timestamp: "2026-08-25T12:00:00.000Z", type: "canal.completed", canal: "Main" }],
  }));
  assert.match(eventMarkup, /<ol aria-label="Recent clinical events"/);
  assert.match(eventMarkup, /<time dateTime="2026-08-25T12:00:00.000Z"/);

  const outputMarkup = renderToStaticMarkup(React.createElement(NotePreview, {
    noteMode: "compact",
    displayedNote: "Synthetic note output",
    copied: false,
    onNoteModeChange: () => {},
    onCopyDisplayedNote: () => {},
    onDownloadDisplayedText: () => {},
  }));
  assert.match(outputMarkup, /role="tablist" aria-label="Note output format"/);
  assert.match(outputMarkup, /role="tab" aria-selected="true"/);
  assert.match(outputMarkup, /semantic-selection-selected/);
  assert.match(outputMarkup, /note-preview-output/);
  assert.match(outputMarkup, /focus-visible:outline-brand-blue/);
  assert.match(outputMarkup, /semantic-action-warning[^\"]*[^>]*>Download plaintext/);
  assert.match(outputMarkup, /semantic-action-warning[^\"]*[^>]*><span aria-live="polite">Copy current output/);
});

test("catalogue administration uses selection, list, status, and destructive contracts", () => {
  const markup = renderToStaticMarkup(React.createElement(CataloguePage, {
    items: [],
    onChange: () => {},
    onClose: () => {},
  }));

  assert.match(markup, /role="tab" aria-selected="true"/);
  assert.match(markup, /semantic-selection-selected/);
  assert.match(markup, /aria-label="Agents catalogue items"/);
  assert.match(markup, /semantic-status-neutral/);
  assert.match(markup, /semantic-action-primary[^\"]*[^>]*>Add item/);
  assert.match(markup, /semantic-action-destructive[^\"]*[^>]*>Reset local catalogue/);
});

test("anesthesia renders selected-choice semantics and a primary record action", () => {
  const markup = renderToStaticMarkup(React.createElement(AnesthesiaEventForm, {
    tooth: "36",
    onRecordEvent: () => {},
  }));

  assert.match(markup, /aria-pressed="true"/);
  assert.match(markup, /aria-pressed="false"/);
  assert.match(markup, /bg-brand-blue-light\/20/);
  assert.match(markup, /<span aria-hidden="true"[^>]*>✓<\/span>/);
  assert.match(markup, /data-clinical-record-action="anesthesia"[^>]*bg-brand-navy/);
  assert.doesNotMatch(markup, /data-clinical-record-action="anesthesia"[^>]*bg-brand-mint/);
});

test("radiology exposes programmatic multi-selection and a primary record action", () => {
  const markup = renderToStaticMarkup(React.createElement(RadiologyEventForm, {
    tooth: "36",
    onRecordEvent: () => {},
  }));

  assert.match(markup, /aria-label="Radiology modalities reviewed"/);
  assert.match(markup, /aria-pressed="false"/);
  assert.match(markup, /data-clinical-record-action="radiology"[^>]*bg-brand-navy/);
});

test("development gallery is a stable synthetic state fixture", () => {
  const markup = renderToStaticMarkup(React.createElement(SemanticStateGallery));

  assert.match(markup, /Development-only fixture/);
  assert.match(markup, /Action roles and interaction states/);
  assert.match(markup, /Application chrome and notices/);
  assert.match(markup, /Choice controls/);
  assert.match(markup, /Setup selection and form controls/);
  assert.match(markup, /Targets, history, and output/);
  assert.match(markup, /Dialogs and high-consequence decisions/);
  assert.match(markup, /Open interactive dialog fixture/);
  assert.match(markup, /semantic-selection-selected/);
  assert.match(markup, /aria-invalid="true"/);
  assert.match(markup, /Equivalent launcher actions/);
  assert.match(markup, /aria-busy="true"/);
  assert.match(markup, /disabled=""/);
  assert.match(markup, /Positive · Ready/);
  assert.match(markup, /Danger · Error/);
  assert.match(markup, /min-h-14[^"]*semantic-action-destructive/);
});
