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

export const OptionalMeasurementStringSchema = z.union([
  z.literal(""),
  z.string().refine((value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0;
  }, "Measurement must be a positive number"),
  z.undefined(),
]);

export const CanalRecordSchema = z.object({
  name: z.string().trim().min(1),
  estimatedWorkingLength: OptionalMeasurementStringSchema.optional(),
  fileTerminalLength: OptionalMeasurementStringSchema.optional(),
  availableTreatmentSpace: OptionalMeasurementStringSchema.optional(),
  referencePoint: z.string().optional(),
  eal0: OptionalMeasurementStringSchema.optional(),
  patencyLength: OptionalMeasurementStringSchema.optional(),
  shapingLength: OptionalMeasurementStringSchema.optional(),
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
