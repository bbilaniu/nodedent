import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MeasurementPanel } from "../components/MeasurementPanel";
import { initialCase } from "../state/persistence";

test("measurement fields are available at the first endodontic workflow step", () => {
  const markup = renderToStaticMarkup(React.createElement(MeasurementPanel, {
    caseData: initialCase,
    activeCanal: initialCase.canals[0],
    currentNodeId: "preop",
    onUpdatePreOp: () => {},
    onUpdateActiveCanal: () => {},
    onApplyEalDerivedLengths: () => {},
  }));

  assert.match(markup, />Measurements</);
  assert.match(markup, />Chamber depth</);
  assert.match(markup, />Estimated WL</);
  assert.match(markup, />Reference point</);
  assert.match(markup, />EAL 0</);
  assert.match(markup, />Final shaping file</);
  assert.doesNotMatch(markup, /before beginning access/);
});
