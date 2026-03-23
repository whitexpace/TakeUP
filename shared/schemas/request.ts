import { z } from "zod"

const requiredTextField = (label: string, maxLength: number) =>
  z
    .string({ required_error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(maxLength)

export const createRequestSchema = z
  .object({
    itemNeeded: requiredTextField("Item name", 120),
    description: requiredTextField("Description", 2000),
    requestedFrom: z.coerce.date(),
    requestedTo: z.coerce.date(),
    minTargetPrice: z.number().int().min(0, "Minimum target price must be 0 or greater."),
    maxTargetPrice: z.number().int().min(0, "Maximum target price must be 0 or greater."),
  })
  .superRefine((input, ctx) => {
    if (input.requestedTo < input.requestedFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["requestedTo"],
        message: "Requested end date must be on or after the start date.",
      })
    }

    if (input.maxTargetPrice < input.minTargetPrice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxTargetPrice"],
        message: "Maximum target price must be greater than or equal to the minimum target price.",
      })
    }
  })

export type CreateRequestInput = z.infer<typeof createRequestSchema>
