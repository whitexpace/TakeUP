import { z } from "zod"

export const disputeStatusSchema = z.enum(["SUBMITTED", "OPEN", "REJECTED", "APPEALED", "RESOLVED"])

export const disputeDecisionSchema = z.enum(["APPROVE", "REJECT"])

export const disputeIdSchema = z.object({
  id: z.string().uuid(),
})

export const submitDisputeSchema = z.object({
  transactionId: z.string().uuid(),
  reason: z.string().trim().min(1, "A reason is required.").max(160),
  description: z.string().trim().max(2000).optional(),
})

export const listDisputesSchema = z
  .object({
    status: disputeStatusSchema.optional().default("SUBMITTED"),
  })
  .default({})

export const reviewDisputeSchema = z.object({
  id: z.string().uuid(),
  decision: disputeDecisionSchema,
})

export const appealDisputeSchema = z.object({
  id: z.string().uuid(),
  appealReason: z.string().trim().min(1, "An appeal reason is required.").max(2000),
  evidenceFileNames: z.array(z.string().trim().min(1).max(255)).max(5).optional(),
})

export type DisputeStatus = z.infer<typeof disputeStatusSchema>
export type DisputeDecision = z.infer<typeof disputeDecisionSchema>
export type SubmitDisputeInput = z.infer<typeof submitDisputeSchema>
export type ReviewDisputeInput = z.infer<typeof reviewDisputeSchema>
export type AppealDisputeInput = z.infer<typeof appealDisputeSchema>
