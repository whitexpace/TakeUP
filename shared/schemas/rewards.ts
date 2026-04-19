import { z } from "zod"

export const rewardsBoostTypeSchema = z.enum(["STANDARD_24_HOUR"])

export const redeemBoostSchema = z.object({
  itemId: z.string().uuid(),
  boostType: rewardsBoostTypeSchema.default("STANDARD_24_HOUR"),
})

export const rewardsLeaderboardRoleSchema = z.enum(["BORROWER", "LENDER"])

export type RedeemBoostInput = z.infer<typeof redeemBoostSchema>
export type RewardsBoostType = z.infer<typeof rewardsBoostTypeSchema>
