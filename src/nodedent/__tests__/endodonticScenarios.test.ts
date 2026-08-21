import test from "node:test";
import assert from "node:assert/strict";
import type { EndoCase } from "../types";
import { endVisitActionConfig } from "../components/EndodonticEndVisitDialog";
import { applyDecision } from "../engine/applyDecision";
import { getCanalStatus } from "../engine/deriveCanalStatus";
import { getCaseStatus } from "../engine/deriveCaseStatus";
import { makeEvent } from "../engine/events";
import { getManualResumeNodeForCanal } from "../engine/resume";
import { getCanalsBlockingClosure } from "../engine/validateDecision";
import { buildCompactNote } from "../notes/buildCompactNote";
import { buildFullNote } from "../notes/buildFullNote";
import { buildJsonExport } from "../notes/buildJsonExport";
import { protocolNodes } from "../protocol/nodes";
import { EndoCaseSchema } from "../schemas/EndoCase.schema";
import { blankCanal, initialCase, normalizeImportedEndoCase } from "../state/persistence";

type ScenarioStep = {
  nodeId: string;
  eventType: string;
};

type ScenarioResult = {
  caseData: EndoCase;
  nextNodeId: string;
  visitedNodeIds: string[];
  generatedEventTypes: string[];
};

const scenarioTimestamp = "2026-08-19T10:00:00.000Z";

function singleCanalScenarioCase(dryingStatus: "dry" | "persistent wet" = "dry"): EndoCase {
  return {
    ...initialCase,
    encounterId: "20260819-0000-4000-8000-000000000020",
    createdAt: scenarioTimestamp,
    patientNumber: "SYNTHETIC-20",
    tooth: "36",
    procedureType: "RCT",
    diagnosis: { pulpal: "synthetic pulpal diagnosis", apical: "synthetic apical diagnosis" },
    preOp: { ...initialCase.preOp, radiographsReviewed: true, paReviewed: true, estimatedChamberDepth: "5" },
    currentCanal: "MB",
    canals: [{
      ...blankCanal("MB"),
      estimatedWorkingLength: "20",
      referencePoint: "MB cusp",
      eal0: "20",
      patencyLength: "21",
      shapingLength: "19",
      wlRadiographStatus: "acceptable",
      finalShape: "30/.04",
      obturationGauge: "30",
      masterCone: "30/.04",
      coneFitRadiograph: "acceptable",
      dryingStatus,
    }],
    globalEvents: [],
  };
}

function runScenario(caseData: EndoCase, startingNodeId: string, steps: ScenarioStep[]): ScenarioResult {
  let nextNodeId = startingNodeId;
  const visitedNodeIds: string[] = [];
  const generatedEventTypes: string[] = [];

  steps.forEach((step, index) => {
    assert.equal(nextNodeId, step.nodeId, `scenario should reach ${step.nodeId} without skipping a node`);
    const node = protocolNodes[nextNodeId];
    assert.ok(node, `protocol node ${nextNodeId} should exist`);
    const option = node.options.find((candidate) => candidate.noteEvent?.type === step.eventType);
    assert.ok(option, `${nextNodeId} should expose an option that records ${step.eventType}`);

    visitedNodeIds.push(nextNodeId);
    const result = applyDecision({
      currentNodeId: nextNodeId,
      selectedOptionLabel: option.label,
      caseData,
      activeCanalName: caseData.currentCanal,
      eventId: `evt_scenario_${index + 1}`,
      timestamp: scenarioTimestamp,
    });

    assert.deepEqual(result.errors, [], `${nextNodeId} should accept the prepared scenario data`);
    assert.equal(result.generatedEvent?.type, step.eventType);
    caseData = result.updatedCaseData;
    nextNodeId = result.nextNodeId;
    if (result.generatedEvent) generatedEventTypes.push(result.generatedEvent.type);
  });

  return { caseData, nextNodeId, visitedNodeIds, generatedEventTypes };
}

const routeToDrying: ScenarioStep[] = [
  { nodeId: "create-final-shape", eventType: "shaping.finalShapeAchieved" },
  { nodeId: "irrigate-recapitulate", eventType: "shaping.completed" },
  { nodeId: "remove-smear-layer", eventType: "smearLayer.edtaPlaced" },
  { nodeId: "agitate-edta", eventType: "smearLayer.edtaAgitated" },
  { nodeId: "final-naocl", eventType: "disinfection.finalNaOClCompleted" },
  { nodeId: "ready-for-obturation", eventType: "disinfection.readyForObturation" },
  { nodeId: "gauge-obturation-30", eventType: "obturationGauge.size30Stop" },
  { nodeId: "record-obturation-gauge", eventType: "obturationGauge.recorded" },
  { nodeId: "fit-master-cone", eventType: "coneFit.masterConeFits" },
  { nodeId: "cone-fit-radiograph", eventType: "coneFit.radiographAcceptable" },
  { nodeId: "ready-for-sealer-cone-seating", eventType: "coneFit.readyForSealerConeSeating" },
];

test("issue 20 straightforward post-shaping RCT cannot skip recapitulation or drying", () => {
  const result = runScenario(singleCanalScenarioCase(), "create-final-shape", [
    ...routeToDrying,
    { nodeId: "dry-for-obturation", eventType: "drying.readyForSealer" },
    { nodeId: "patency-before-sealer", eventType: "sealer.patencyConfirmed" },
  ]);

  assert.equal(result.nextNodeId, "apply-sealer");
  assert.deepEqual(result.visitedNodeIds.slice(0, 6), [
    "create-final-shape",
    "irrigate-recapitulate",
    "remove-smear-layer",
    "agitate-edta",
    "final-naocl",
    "ready-for-obturation",
  ]);
  assert.ok(result.visitedNodeIds.indexOf("irrigate-recapitulate") < result.visitedNodeIds.indexOf("dry-for-obturation"));
  assert.ok(result.generatedEventTypes.includes("shaping.completed"));
  assert.ok(result.generatedEventTypes.includes("drying.readyForSealer"));

  const fullNote = buildFullNote(result.caseData);
  assert.match(fullNote, /Canal shaped, irrigated, and recapitulated/);
  assert.match(fullNote, /Canal dried to dry\/slightly damp paper point/);
});

test("issue 20 pause after shaping survives export and resumes at the exact next step", () => {
  const shaped = runScenario(singleCanalScenarioCase(), "create-final-shape", [
    { nodeId: "create-final-shape", eventType: "shaping.finalShapeAchieved" },
  ]);
  assert.equal(shaped.nextNodeId, "irrigate-recapitulate");

  const pauseAction = endVisitActionConfig.pause;
  assert.equal(pauseAction.nextNodeId, null);
  const activeCanal = shaped.caseData.canals[0];
  const pauseEvent = makeEvent({
    type: pauseAction.eventType,
    tooth: shaped.caseData.tooth,
    canal: activeCanal.name,
    nodeId: shaped.nextNodeId,
    label: `Pause ${activeCanal.name} at ${protocolNodes[shaped.nextNodeId].title}`,
    activeCanal,
    id: "evt_scenario_pause",
    timestamp: scenarioTimestamp,
  });
  const pausedCase: EndoCase = {
    ...shaped.caseData,
    nextVisitPlan: "Resume with irrigation and recapitulation",
    canals: shaped.caseData.canals.map((canal) => canal.name === activeCanal.name
      ? { ...canal, events: [...(canal.events || []), pauseEvent] }
      : canal),
    globalEvents: [...shaped.caseData.globalEvents, pauseEvent],
  };

  const exported = buildJsonExport(pausedCase, shaped.nextNodeId);
  assert.equal(exported.currentNodeId, "irrigate-recapitulate");
  assert.equal(exported.nextVisitPlan, "Resume with irrigation and recapitulation");

  const imported = normalizeImportedEndoCase(exported, scenarioTimestamp);
  assert.equal(EndoCaseSchema.safeParse(imported).success, true);
  assert.equal(getCanalStatus(imported.canals[0]), "paused");
  assert.equal(getCaseStatus(imported), "Resume next visit");
  assert.equal(getManualResumeNodeForCanal(imported.canals[0]), "irrigate-recapitulate");
  assert.match(buildCompactNote(imported), /Next visit\/plan: Resume with irrigation and recapitulation/);
  assert.match(buildFullNote(imported), /Paused for later continuation/);

  const resumeEvent = makeEvent({
    type: "workflow.resumedCanal",
    tooth: imported.tooth,
    canal: imported.canals[0].name,
    nodeId: shaped.nextNodeId,
    label: `Resume ${imported.canals[0].name}`,
    activeCanal: imported.canals[0],
    id: "evt_scenario_resume",
    timestamp: scenarioTimestamp,
  });
  const resumedCase = {
    ...imported,
    caseStatus: "",
    canals: imported.canals.map((canal) => ({ ...canal, events: [...(canal.events || []), resumeEvent] })),
    globalEvents: [...imported.globalEvents, resumeEvent],
  };
  assert.equal(getCanalStatus(resumedCase.canals[0]), "shaped");
  assert.equal(getCaseStatus(resumedCase), "RCT initiated");
  assert.deepEqual(getCanalsBlockingClosure(resumedCase), ["MB (Shaped)"]);
});

test("issue 20 persistent-wet route records medication and temporary closure", () => {
  const result = runScenario(singleCanalScenarioCase("persistent wet"), "create-final-shape", [
    ...routeToDrying,
    { nodeId: "dry-for-obturation", eventType: "drying.persistentWetBeforeObturation" },
    { nodeId: "calcium-hydroxide", eventType: "medication.calciumHydroxidePlaced" },
    { nodeId: "temporary-closure", eventType: "closure.temporary" },
  ]);

  assert.equal(result.nextNodeId, "endodontic-pathway-complete");
  assert.equal(getCanalStatus(result.caseData.canals[0]), "medicated");
  assert.equal(getCaseStatus(result.caseData), "Medicated and temporized");
  assert.deepEqual(result.generatedEventTypes.slice(-3), [
    "drying.persistentWetBeforeObturation",
    "medication.calciumHydroxidePlaced",
    "closure.temporary",
  ]);

  const fullNote = buildFullNote(result.caseData);
  assert.match(fullNote, /Calcium hydroxide placed/);
  assert.match(fullNote, /Access closed with sponge and temporary restorative material/);
});
