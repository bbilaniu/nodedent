import { z } from "zod";
import { CanalRecordSchema } from "./CanalRecord.schema";
import { ClinicalEventSchema, ClosureRecordSchema } from "./ClinicalEvent.schema";

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

export const DecisionOptionSchema = z.object({
  id: z.string().optional(),
  label: z.string(),
  nextNodeId: z.string(),
  difficultyFlag: z.union([z.literal("none"), z.literal("caution"), z.literal("high"), z.literal("refer")]).optional(),
  noteEvent: z.object({ type: z.string() }).optional(),
  guards: z.array(DecisionGuardSchema).optional(),
});

export const ProtocolNodeSchema = z.object({
  id: z.string(),
  phase: z.string(),
  title: z.string(),
  chairsideInstruction: z.string(),
  instruments: z.array(z.string()).optional(),
  materials: z.array(z.string()).optional(),
  requiredInputs: z.array(z.string()).optional(),
  safetyNotes: z.array(z.string()).optional(),
  options: z.array(DecisionOptionSchema),
});

export const EndoCaseSchema = z.object({
  patientNumber: z.string(),
  autosavedAt: z.string().optional(),
  tooth: z.string(),
  procedureType: z.string(),
  caseStatus: z.string().optional(),
  nextVisitPlan: z.string().optional(),
  diagnosis: z.object({ pulpal: z.string().optional(), apical: z.string().optional() }).optional(),
  difficulty: z.union([z.literal("none"), z.literal("caution"), z.literal("high"), z.literal("refer")]),
  preOp: z.object({
    radiographsReviewed: z.boolean().optional(),
    cbctReviewed: z.boolean().optional(),
    estimatedChamberDepth: z.string().optional(),
  }),
  currentCanal: z.string(),
  canals: z.array(CanalRecordSchema),
  globalEvents: z.array(ClinicalEventSchema),
  events: z.array(ClinicalEventSchema).optional(),
  closure: ClosureRecordSchema.nullable(),
  currentNodeId: z.string().optional(),
});

export type DecisionOptionInput = z.infer<typeof DecisionOptionSchema>;
export type ProtocolNodeInput = z.infer<typeof ProtocolNodeSchema>;
export type EndoCaseInput = z.infer<typeof EndoCaseSchema>;
