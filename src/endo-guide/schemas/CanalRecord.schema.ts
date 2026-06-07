import { z } from "zod";
import { ClinicalEventSchema } from "./ClinicalEvent.schema";

export const RadiographStatusSchema = z.union([
  z.literal("acceptable"),
  z.literal("short"),
  z.literal("long"),
  z.literal("not taken"),
  z.literal(""),
  z.undefined(),
]);

export const CanalRecordSchema = z.object({
  name: z.string(),
  estimatedWorkingLength: z.string().optional(),
  fileTerminalLength: z.string().optional(),
  availableTreatmentSpace: z.string().optional(),
  referencePoint: z.string().optional(),
  eal0: z.string().optional(),
  patencyLength: z.string().optional(),
  shapingLength: z.string().optional(),
  wlRadiographStatus: RadiographStatusSchema.optional(),
  finalShape: z.string().optional(),
  obturationGauge: z.string().optional(),
  masterCone: z.string().optional(),
  coneFitRadiograph: RadiographStatusSchema.optional(),
  dryingStatus: z.union([z.literal(""), z.literal("dry"), z.literal("slightly damp"), z.literal("wet"), z.literal("persistent wet")]).optional(),
  events: z.array(ClinicalEventSchema).optional(),
  status: z.string().optional(),
});

export type CanalRecordInput = z.infer<typeof CanalRecordSchema>;
