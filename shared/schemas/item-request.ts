import { z } from "zod"
import { itemConditionSchema } from "./item"

export const itemRequestIdSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const itemRequestStatusSchema = z.enum(["OPEN", "FULFILLED", "CANCELLED"])
export const requestOfferStatusSchema = z.enum(["PENDING", "ACCEPTED", "DECLINED", "CANCELLED"])
export const requestOfferConditionSchema = itemConditionSchema

const requiredTextField = (label: string, maxLength: number) =>
  z
    .string({ required_error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(maxLength)

const nonNegativeInt = z.coerce.number().int().min(0)

const normalizeRequestedDates = (dates: Date[]) => {
  const uniqueByDay = new Map<number, Date>()

  for (const date of dates) {
    const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    uniqueByDay.set(normalized.getTime(), normalized)
  }

  return [...uniqueByDay.values()].sort((left, right) => left.getTime() - right.getTime())
}

export const requestedDatesSchema = z
  .array(z.coerce.date())
  .min(1, "At least one requested date is required.")
  .max(31, "Requested dates cannot exceed 31 entries.")
  .transform(normalizeRequestedDates)

export const priceRangeSchema = z
  .array(nonNegativeInt)
  .length(2, "Price range must contain a minimum and maximum value.")
  .superRefine((value, ctx) => {
    const [minimum, maximum] = value
    if (minimum === undefined || maximum === undefined) return

    if (minimum > maximum) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Maximum price must be greater than or equal to minimum price.",
        path: [1],
      })
    }
  })
  .transform((value) => {
    const [minimum = 0, maximum = 0] = value
    return [minimum, maximum] as [number, number]
  })

export const createItemRequestSchema = z.object({
  itemNeeded: requiredTextField("Item needed", 160),
  requestedDates: requestedDatesSchema,
  priceRange: priceRangeSchema,
  description: requiredTextField("Description", 2000),
  status: itemRequestStatusSchema.default("OPEN"),
})

export const updateItemRequestSchema = z
  .object({
    id: z.coerce.number().int().positive(),
    itemNeeded: requiredTextField("Item needed", 160).optional(),
    requestedDates: requestedDatesSchema.optional(),
    priceRange: priceRangeSchema.optional(),
    description: requiredTextField("Description", 2000).optional(),
    status: itemRequestStatusSchema.optional(),
  })
  .refine(
    (payload) =>
      payload.itemNeeded !== undefined ||
      payload.requestedDates !== undefined ||
      payload.priceRange !== undefined ||
      payload.description !== undefined ||
      payload.status !== undefined,
    { message: "At least one field is required for update." },
  )

export const deleteItemRequestSchema = itemRequestIdSchema

export const listItemRequestsSchema = z
  .object({
    status: itemRequestStatusSchema.optional(),
    borrowerOnly: z.coerce.boolean().optional(),
    includeCancelledOffers: z.coerce.boolean().optional(),
  })
  .default({})

export const requestOfferIdSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const createRequestOfferSchema = z.object({
  requestID: z.coerce.number().int().positive(),
  itemID: z.coerce.number().int().positive(),
  rentalFee: nonNegativeInt,
  availability: z.boolean(),
  condition: requestOfferConditionSchema,
  rentalTerms: requiredTextField("Rental terms", 2000),
  status: requestOfferStatusSchema.default("PENDING"),
})

export const updateRequestOfferSchema = z
  .object({
    id: z.coerce.number().int().positive(),
    itemID: z.coerce.number().int().positive().optional(),
    rentalFee: nonNegativeInt.optional(),
    availability: z.boolean().optional(),
    condition: requestOfferConditionSchema.optional(),
    rentalTerms: requiredTextField("Rental terms", 2000).optional(),
    status: requestOfferStatusSchema.optional(),
  })
  .refine(
    (payload) =>
      payload.itemID !== undefined ||
      payload.rentalFee !== undefined ||
      payload.availability !== undefined ||
      payload.condition !== undefined ||
      payload.rentalTerms !== undefined ||
      payload.status !== undefined,
    { message: "At least one field is required for update." },
  )

export const deleteRequestOfferSchema = requestOfferIdSchema

export const listRequestOffersSchema = z
  .object({
    requestID: z.coerce.number().int().positive().optional(),
    sentOnly: z.coerce.boolean().optional(),
    receivedOnly: z.coerce.boolean().optional(),
    status: requestOfferStatusSchema.optional(),
  })
  .default({})

export const markRequestOfferNotificationReadSchema = requestOfferIdSchema

export type ItemRequestStatus = z.infer<typeof itemRequestStatusSchema>
export type RequestOfferStatus = z.infer<typeof requestOfferStatusSchema>
export type CreateItemRequestInput = z.infer<typeof createItemRequestSchema>
export type UpdateItemRequestInput = z.infer<typeof updateItemRequestSchema>
export type ListItemRequestsInput = z.infer<typeof listItemRequestsSchema>
export type CreateRequestOfferInput = z.infer<typeof createRequestOfferSchema>
export type UpdateRequestOfferInput = z.infer<typeof updateRequestOfferSchema>
export type ListRequestOffersInput = z.infer<typeof listRequestOffersSchema>
