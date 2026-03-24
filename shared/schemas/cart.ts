import { z } from "zod"

export const cartEntryIdSchema = z.object({
  id: z.string().uuid(),
})

export const addToCartSchema = z
  .object({
    itemId: z.string().uuid(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
  })
  .superRefine((value, ctx) => {
    if (value.endAt <= value.startAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endAt"],
        message: "End date and time must be later than the start date and time.",
      })
    }
  })

export type AddToCartInput = z.infer<typeof addToCartSchema>
