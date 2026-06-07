import test from "node:test";
import assert from "node:assert/strict";
import type { EndoCase } from "../types";
import { applyDecision } from "../engine/applyDecision";
import { getCanalStatus } from "../engine/deriveCanalStatus";
import { getMissingRequirements } from "../engine/validateDecision";
import { buildCompactNote } from "../notes/buildCompactNote";
import { buildFullNote } from "../notes/buildFullNote";
import { buildJsonExport } from "../notes/buildJsonExport";
import { eventFragment } from "../notes/fragments";
import { getNextRecommendedNodeForCanal } from "../protocol/continuation";
import { protocolNodes } from "../protocol/nodes";
import { blankCanal, hydrateCanalEventsFromGlobalEvents, initialCase } from "../state/persistence";

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
  const ats17 = baseCase({ canals: [{ ...blankCanal("MB"), availableTreatmentSpace: "17", referencePoint: "MB cusp" }] });
  const ats16 = baseCase({ canals: [{ ...blankCanal("MB"), availableTreatmentSpace: "16", referencePoint: "MB cusp" }] });

  assert.ok(getMissingRequirements("measure-available-space", option, ats17, ats17.canals[0]).includes("Available treatment space must be ≤16 mm for this option"));
  assert.deepEqual(getMissingRequirements("measure-available-space", option, ats16, ats16.canals[0]), []);
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

test("final shape validation accepts 30/.04", () => {
  const option = protocolNodes["create-final-shape"].options[0];
  const caseData = baseCase({ canals: [{ ...blankCanal("MB"), finalShape: "30/.04" }] });
  assert.deepEqual(getMissingRequirements("create-final-shape", option, caseData, caseData.canals[0]), []);
});

test("canal continuation maps key statuses", () => {
  assert.equal(getNextRecommendedNodeForCanal(blankCanal("MB")).nextNodeId, "estimate-wl");
  assert.equal(getNextRecommendedNodeForCanal({ ...blankCanal("MB"), eal0: "20" }).nextNodeId, "patency-10c");
  assert.equal(getNextRecommendedNodeForCanal({ ...blankCanal("MB"), finalShape: "30/.04" }).nextNodeId, "ready-for-obturation");
  const referred = { ...blankCanal("MB"), events: [{ id: "evt", timestamp: "t", type: "canal.referred", canal: "MB" }] };
  assert.equal(getNextRecommendedNodeForCanal(referred).disabled, true);
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
  assert.equal(caseData.canals.find((canal) => canal.name === "ML")?.estimatedWorkingLength, "21");
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

  assert.match(buildCompactNote(caseData), /MB: est WL 20 mm/);
  assert.match(buildFullNote(caseData), /WL PA not taken/);
});

test("JSON export preserves canal status and radiograph statuses", () => {
  const caseData = baseCase({
    canals: [{ ...blankCanal("MB"), eal0: "20", wlRadiographStatus: "not taken", coneFitRadiograph: "acceptable" }],
  });
  const exported = buildJsonExport(caseData, "patency-10c");
  assert.equal(exported.canals[0].status, "WL established");
  assert.equal(exported.canals[0].wlRadiographStatus, "not taken");
  assert.equal(exported.canals[0].coneFitRadiograph, "acceptable");
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
