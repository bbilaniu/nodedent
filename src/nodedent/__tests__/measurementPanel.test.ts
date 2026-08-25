import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EndodonticTargetPanel } from "../components/EndodonticTargetPanel";
import { MeasurementPanel } from "../components/MeasurementPanel";
import { initialCase } from "../state/persistence";

test("measurement fields are available at the first endodontic workflow step", () => {
  const caseData = { ...initialCase, tooth: "36" };
  const markup = renderToStaticMarkup(React.createElement(MeasurementPanel, {
    caseData,
    activeCanal: initialCase.canals[0],
    currentNodeId: "preop",
    onUpdatePreOp: () => {},
    onUpdateActiveCanal: () => {},
    onApplyEalDerivedLengths: () => {},
  }));

  assert.match(markup, />Measurements</);
  assert.match(markup, /Measurement target/);
  assert.match(markup, /Tooth 36 · Main canal/);
  assert.match(markup, />Chamber depth</);
  assert.match(markup, />Estimated WL</);
  assert.match(markup, />Reference point</);
  assert.match(markup, />EAL 0</);
  assert.match(markup, />Final shaping file</);
  assert.doesNotMatch(markup, /before beginning access/);
});

test("measurement context explicitly reports a missing tooth", () => {
  const markup = renderToStaticMarkup(React.createElement(MeasurementPanel, {
    caseData: initialCase,
    activeCanal: initialCase.canals[0],
    currentNodeId: "preop",
    onUpdatePreOp: () => {},
    onUpdateActiveCanal: () => {},
    onApplyEalDerivedLengths: () => {},
  }));

  assert.match(markup, /Tooth not set · Main canal/);
});

test("endodontic progress owns tooth context and routes a missing tooth to Case Setup", () => {
  const noop = () => {};
  const renderPanel = (tooth: string) => renderToStaticMarkup(React.createElement(EndodonticTargetPanel, {
    caseData: { ...initialCase, tooth },
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

  assert.match(renderPanel("36"), /Endodontic progress · Tooth 36/);
  const missingToothMarkup = renderPanel("");
  assert.match(missingToothMarkup, /Endodontic progress · Tooth not set/);
  assert.match(missingToothMarkup, />Open Case Setup<\/button>/);
});
