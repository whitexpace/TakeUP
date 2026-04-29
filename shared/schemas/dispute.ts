import { z } from "zod"

export const disputeStatusSchema = z.enum(["SUBMITTED", "OPEN", "REJECTED", "APPEALED", "CLOSED"])

export const disputeDecisionSchema = z.enum(["APPROVE", "REJECT"])
export const disputeFinalDecisionSchema = z.enum(["APPROVED", "REJECTED"])
export const disputeActionTypeSchema = z.enum(["WARNING", "POINT_DEDUCTION", "SUSPENSION", "BAN"])

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

export const disputeActionInputSchema = z
  .object({
    type: disputeActionTypeSchema,
    targetUserId: z.string().uuid(),
    points: z.number().int().min(1).max(10_000).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "POINT_DEDUCTION" && typeof value.points !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Point deductions require a points value.",
        path: ["points"],
      })
    }

    if (value.type !== "POINT_DEDUCTION" && typeof value.points !== "undefined") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only point deductions accept a points value.",
        path: ["points"],
      })
    }
  })

export const finalJudgmentSchema = z.object({
  id: z.string().uuid(),
  decision: disputeFinalDecisionSchema,
  decisionNotes: z.string().trim().min(1, "Decision notes are required.").max(2000),
  actions: z.array(disputeActionInputSchema).max(8).default([]),
})

export const closeDisputeSchema = z.object({
  id: z.string().uuid(),
})

export const appealDisputeSchema = z.object({
  id: z.string().uuid(),
  appealReason: z.string().trim().min(1, "An appeal reason is required.").max(2000),
  evidenceFileNames: z.array(z.string().trim().min(1).max(255)).max(5).optional(),
})

export const submitRebuttalSchema = z.object({
  id: z.string().uuid(),
  rebuttalText: z.string().trim().min(1, "A rebuttal statement is required.").max(2000),
  rebuttalNotes: z.string().trim().max(2000).optional(),
})

export type DisputeStatus = z.infer<typeof disputeStatusSchema>
export type DisputeDecision = z.infer<typeof disputeDecisionSchema>
export type DisputeFinalDecision = z.infer<typeof disputeFinalDecisionSchema>
export type DisputeActionType = z.infer<typeof disputeActionTypeSchema>
export type SubmitDisputeInput = z.infer<typeof submitDisputeSchema>
export type ReviewDisputeInput = z.infer<typeof reviewDisputeSchema>
export type FinalJudgmentInput = z.infer<typeof finalJudgmentSchema>
export type DisputeActionInput = z.infer<typeof disputeActionInputSchema>
export type CloseDisputeInput = z.infer<typeof closeDisputeSchema>
export type AppealDisputeInput = z.infer<typeof appealDisputeSchema>
export type SubmitRebuttalInput = z.infer<typeof submitRebuttalSchema>
