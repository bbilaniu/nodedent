import { z } from "zod";
import { CanalRecordSchema } from "./CanalRecord.schema";
import { ClinicalEventSchema, ClosureRecordSchema, WorkflowScopeKindSchema, WorkflowScopeSchema } from "./ClinicalEvent.schema";
import { noTreatmentSelectedProcedure } from "../workflow/procedures";

export const ProcedureTypeSchema = z.union([
  z.literal(noTreatmentSelectedProcedure),
  z.literal("RCT"),
  z.literal("Retreatment"),
  z.literal("Emergency pulpectomy"),
  z.literal("Direct restoration"),
]);

export const DecisionGuardSchema = z.union([
  z.object({
    type: z.literal("numericComparison"),
    scope: z.union([z.literal("activeCanal"), z.literal("case")]),
    field: z.string(),
    operator: z.union([z.literal(">"), z.literal(">="), z.literal("<"), z.literal("<="), z.literal("=")]),
    value: z.number(),
    message: z.string(),
  }),
  z.object({
    type: z.literal("required"),
    scope: z.union([z.literal("activeCanal"), z.literal("case")]),
    field: z.string(),
    message: z.string(),
  }),
  z.object({
    type: z.literal("custom"),
    id: z.string(),
    message: z.string(),
  }),
]);

export const CapabilityRequirementSchema = z.object({
  name: z.string(),
  scopeKind: WorkflowScopeKindSchema.optional(),
  message: z.string().optional(),
  allowReassessment: z.boolean().optional(),
});

export const WorkflowModuleCallSchema = z.object({
  workflowId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  reason: z.string().optional(),
  scope: WorkflowScopeSchema.optional(),
  requiredCapabilities: z.array(CapabilityRequirementSchema).optional(),
  returnedCapabilities: z.array(z.string()).optional(),
});

export const DecisionOptionSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1),
  nextNodeId: z.string().trim().min(1),
  difficultyFlag: z.union([z.literal("none"), z.literal("caution"), z.literal("high"), z.literal("refer")]).optional(),
  noteEvent: z.object({ type: z.string() }).optional(),
  guards: z.array(DecisionGuardSchema).optional(),
  moduleCalls: z.array(WorkflowModuleCallSchema).optional(),
});

export const ProtocolNodeSchema = z.object({
  id: z.string().trim().min(1),
  phase: z.string().trim().min(1),
  title: z.string().trim().min(1),
  chairsideInstruction: z.string().trim().min(1),
  instruments: z.array(z.string()).optional(),
  materials: z.array(z.string()).optional(),
  requiredInputs: z.array(z.string()).optional(),
  safetyNotes: z.array(z.string()).optional(),
  options: z.array(DecisionOptionSchema),
  workflowId: z.string().optional(),
  capabilityRequirements: z.array(CapabilityRequirementSchema).optional(),
  moduleCalls: z.array(WorkflowModuleCallSchema).optional(),
});

export const EndoCaseSchema = z.object({
  encounterId: z.string().trim().min(1),
  createdAt: z.string().optional(),
  revision: z.number().int().nonnegative().optional(),
  patientNumber: z.string(),
  autosavedAt: z.string().optional(),
  tooth: z.string().trim().min(1),
  procedureType: ProcedureTypeSchema,
  caseStatus: z.string().optional(),
  nextVisitPlan: z.string().optional(),
  priorVisit: z.object({
    continuedFromPriorVisit: z.boolean().optional(),
    priorVisitDate: z.string().optional(),
    accessPreviouslyOpened: z.boolean().optional(),
    temporaryRestorationPresent: z.boolean().optional(),
    medicationPresent: z.union([z.literal(""), z.literal("yes"), z.literal("no"), z.literal("unknown")]).optional(),
    priorRadiographsAvailable: z.boolean().optional(),
    sourceNote: z.string().optional(),
  }).optional(),
  diagnosis: z.object({ pulpal: z.string().optional(), apical: z.string().optional() }).optional(),
  difficulty: z.union([z.literal("none"), z.literal("caution"), z.literal("high"), z.literal("refer")]),
  preOp: z.object({
    radiographsReviewed: z.boolean().optional(),
    paReviewed: z.boolean().optional(),
    bwReviewed: z.boolean().optional(),
    cbctReviewed: z.boolean().optional(),
    estimatedChamberDepth: z.string().optional(),
  }),
  currentCanal: z.string().trim().min(1),
  canals: z.array(CanalRecordSchema).min(1),
  globalEvents: z.array(ClinicalEventSchema),
  events: z.array(ClinicalEventSchema).optional(),
  closure: ClosureRecordSchema.nullable(),
  currentNodeId: z.string().optional(),
});

export type DecisionOptionInput = z.infer<typeof DecisionOptionSchema>;
export type ProtocolNodeInput = z.infer<typeof ProtocolNodeSchema>;
export type EndoCaseInput = z.infer<typeof EndoCaseSchema>;
