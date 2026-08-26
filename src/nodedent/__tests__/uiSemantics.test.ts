import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnesthesiaEventForm } from "../components/AnesthesiaEventForm";
import { AppFooter } from "../components/AppFooter";
import { ClinicalDataNotice } from "../components/ClinicalDataNotice";
import { DeploymentConfigurationError } from "../components/DeploymentConfigurationError";
import { DeploymentModeBanner } from "../components/DeploymentModeBanner";
import { DifficultyBanner } from "../components/DifficultyBanner";
import { RadiologyEventForm } from "../components/RadiologyEventForm";
import { SandboxDataWarning } from "../components/SandboxDataWarning";
import { SemanticStateGallery } from "../components/SemanticStateGallery";
import { WorkflowLauncher } from "../components/WorkflowLauncher";
import {
  semanticActionButton,
  semanticChoiceControl,
  semanticFormControl,
  semanticInteraction,
  semanticSelectionSurface,
  semanticSelectionTone,
  semanticStatusSurface,
  semanticStatusTone,
} from "../components/uiStyles";
import type { DeploymentIdentity } from "../deploymentMode";
import { initialCase } from "../state/persistence";

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
  assert.match(semanticInteraction.loading, /cursor-wait/);
});

test("selection and status contracts do not reuse primary-action meaning", () => {
  assert.match(semanticChoiceControl.selected, /bg-brand-blue-light\/20/);
  assert.match(semanticChoiceControl.selected, /border-brand-blue/);
  assert.doesNotMatch(semanticChoiceControl.selected, /bg-brand-navy/);
  assert.doesNotMatch(semanticChoiceControl.selected, /brand-mint/);
  assert.match(semanticChoiceControl.indicatorSelected, /bg-brand-blue/);
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
});

test("application chrome and notices keep status separate from action hierarchy", () => {
  const betaIdentity: DeploymentIdentity = {
    mode: "beta",
    branch: "beta",
    commitSha: "abcdef1",
    expectedOrigin: "https://beta.example",
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
  assert.match(markup, /semantic-selection-selected/);
  assert.match(markup, /aria-invalid="true"/);
  assert.match(markup, /Equivalent launcher actions/);
  assert.match(markup, /aria-busy="true"/);
  assert.match(markup, /disabled=""/);
  assert.match(markup, /Positive · Ready/);
  assert.match(markup, /Danger · Error/);
});
