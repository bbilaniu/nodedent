import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { EndoCase } from "../types";
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

  assert.ok(getMissingRequirements("gauge-obturation-30", protocolNodes["gauge-obturation-30"].options[1], blank, blank.canals[0]).includes("Shaping length in mm"));
  assert.ok(getMissingRequirements("gauge-obturation-25", protocolNodes["gauge-obturation-25"].options[0], blank, blank.canals[0]).includes("Shaping length in mm"));
  assert.ok(getMissingRequirements("gauge-obturation-larger", protocolNodes["gauge-obturation-larger"].options[0], blank, blank.canals[0]).includes("Obturation gauge size, e.g. 30"));
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
