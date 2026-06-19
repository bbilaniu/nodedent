import { z } from "zod";

export const WorkflowScopeKindSchema = z.union([
  z.literal("patient"),
  z.literal("visit"),
  z.literal("tooth"),
  z.literal("canal"),
  z.literal("surface"),
  z.literal("procedure"),
  z.literal("quadrant"),
  z.literal("sextant"),
  z.literal("archSegment"),
  z.literal("custom"),
]);

export const WorkflowScopeSchema = z.object({
  kind: WorkflowScopeKindSchema,
  patientId: z.string().optional(),
  visitId: z.string().optional(),
  procedureId: z.string().optional(),
  tooth: z.string().optional(),
  teeth: z.array(z.string()).optional(),
  canal: z.string().optional(),
  surface: z.string().optional(),
  surfaces: z.array(z.string()).optional(),
  regionLabel: z.string().optional(),
  label: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const CapabilitySatisfactionSchema = z.object({
  name: z.string(),
  scope: WorkflowScopeSchema,
  sourceEventId: z.string().optional(),
  workflowId: z.string().optional(),
  workflowRunId: z.string().optional(),
  satisfiedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const ClinicalEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  type: z.string(),
  workflowId: z.string().optional(),
  workflowVersion: z.string().optional(),
  workflowRunId: z.string().optional(),
  parentWorkflowRunId: z.string().nullable().optional(),
  nodeId: z.string().optional(),
  scope: WorkflowScopeSchema.optional(),
  capabilitiesSatisfied: z.array(CapabilitySatisfactionSchema).optional(),
  expiresAt: z.string().optional(),
  tooth: z.string().optional(),
  canal: z.string().optional(),
  details: z.record(z.string(), z.any()).optional(),
});

export const ClosureRecordSchema = z.object({
  type: z.string(),
});

export type ClinicalEventInput = z.infer<typeof ClinicalEventSchema>;
export type ClosureRecordInput = z.infer<typeof ClosureRecordSchema>;
