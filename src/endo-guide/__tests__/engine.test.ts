import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { EndoCase } from "../types";
import { applyDecision } from "../engine/applyDecision";
import { getCanalStatus } from "../engine/deriveCanalStatus";
import { getMissingRequirements } from "../engine/validateDecision";
import { buildCompactNote } from "../notes/buildCompactNote";
import { buildFullNote } from "../notes/buildFullNote";
import { buildJsonExport } from "../notes/buildJsonExport";
import { buildPatientSummary } from "../notes/buildPatientSummary";
import { eventFragment } from "../notes/fragments";
import { getNextRecommendedNodeForCanal } from "../protocol/continuation";
import { protocolNodes } from "../protocol/nodes";
import { CanalRecordSchema, RadiographStatusSchema } from "../schemas/CanalRecord.schema";
import { EndoCaseSchema } from "../schemas/EndoCase.schema";
import { blankCanal, hydrateCanalEventsFromGlobalEvents, initialCase, normalizeImportedEndoCase } from "../state/persistence";

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

test("engine and notes modules stay free of React, DOM, and browser storage dependencies", () => {
  const moduleRoots = [join(process.cwd(), "src/endo-guide/engine"), join(process.cwd(), "src/endo-guide/notes")];
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

test("final shape validation accepts 30/.04", () => {
  const option = protocolNodes["create-final-shape"].options[0];
  const caseData = baseCase({ canals: [{ ...blankCanal("MB"), finalShape: "30/.04" }] });
  assert.deepEqual(getMissingRequirements("create-final-shape", option, caseData, caseData.canals[0]), []);
});

test("final shape validation rejects clearly invalid values", () => {
  const option = protocolNodes["create-final-shape"].options[0];
  const caseData = baseCase({ canals: [{ ...blankCanal("MB"), finalShape: "large file" }] });
  assert.ok(getMissingRequirements("create-final-shape", option, caseData, caseData.canals[0]).includes("Final shape/size, e.g. 30/.04"));
});

test("canal continuation maps key statuses", () => {
  assert.equal(getNextRecommendedNodeForCanal(blankCanal("MB")).nextNodeId, "estimate-wl");
  assert.equal(getNextRecommendedNodeForCanal({ ...blankCanal("MB"), estimatedWorkingLength: "20" }).nextNodeId, "open-orifice");
  assert.equal(getNextRecommendedNodeForCanal({ ...blankCanal("MB"), eal0: "20" }).nextNodeId, "patency-10c");
  assert.equal(getNextRecommendedNodeForCanal({ ...blankCanal("MB"), events: [{ id: "evt", timestamp: "t", type: "glidePath.created", canal: "MB" }] }).nextNodeId, "gauge-final-shape");
  assert.equal(getNextRecommendedNodeForCanal({ ...blankCanal("MB"), finalShape: "30/.04" }).nextNodeId, "ready-for-obturation");
  assert.equal(getNextRecommendedNodeForCanal({ ...blankCanal("MB"), events: [{ id: "evt", timestamp: "t", type: "canal.medicated", canal: "MB" }] }).nextNodeId, "endodontic-pathway-complete");
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
  assert.equal(event.type, "workflow.switchedCanal");
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

test("normalized JSON import preserves exported case data", () => {
  const caseData = baseCase({
    caseStatus: "Resume next visit",
    difficulty: "high",
    nextVisitPlan: "Continue obturation",
    currentCanal: "DB",
    canals: [
      { ...blankCanal("MB"), estimatedWorkingLength: "20", wlRadiographStatus: "not taken", coneFitRadiograph: "acceptable" },
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
  assert.equal(imported.canals[1].shapingLength, "20");
  assert.equal(imported.canals[1].events?.length, 1);
  assert.equal(imported.globalEvents.length, 2);
  assert.equal(imported.caseStatus, "Resume next visit");
  assert.equal(imported.difficulty, "high");
  assert.equal(imported.nextVisitPlan, "Continue obturation");
});
