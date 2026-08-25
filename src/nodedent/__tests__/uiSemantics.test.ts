import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnesthesiaEventForm } from "../components/AnesthesiaEventForm";
import { RadiologyEventForm } from "../components/RadiologyEventForm";
import { SemanticStateGallery } from "../components/SemanticStateGallery";
import { WorkflowLauncher } from "../components/WorkflowLauncher";
import {
  semanticActionButton,
  semanticChoiceControl,
  semanticInteraction,
  semanticStatusTone,
} from "../components/uiStyles";
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

  assert.match(semanticStatusTone.positive, /brand-mint/);
  assert.match(semanticStatusTone.attention, /amber/);
  assert.match(semanticStatusTone.neutral, /brand-light-node/);
  assert.match(semanticStatusTone.difficulty, /orange/);
  assert.match(semanticStatusTone.danger, /red/);
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
  assert.match(markup, /Choice controls/);
  assert.match(markup, /Equivalent launcher actions/);
  assert.match(markup, /aria-busy="true"/);
  assert.match(markup, /disabled=""/);
  assert.match(markup, /Positive · Ready/);
  assert.match(markup, /Danger · Error/);
});
