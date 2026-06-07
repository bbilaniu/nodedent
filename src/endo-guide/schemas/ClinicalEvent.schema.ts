import { z } from "zod";

export const ClinicalEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  type: z.string(),
  tooth: z.string().optional(),
  canal: z.string().optional(),
  details: z.record(z.string(), z.any()).optional(),
});

export const ClosureRecordSchema = z.object({
  type: z.string(),
});

export type ClinicalEventInput = z.infer<typeof ClinicalEventSchema>;
export type ClosureRecordInput = z.infer<typeof ClosureRecordSchema>;
