import type { RequestCreateInput, RequestFormFields } from "../types/request-feed"

export type RequestFormErrors = Partial<Record<keyof RequestFormFields, string>>

const isValidDateValue = (value: string) => {
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime())
}

export const createInitialRequestForm = (): RequestFormFields => ({
  itemNeeded: "",
  description: "",
  requestedFrom: "",
  requestedTo: "",
  minTargetPrice: "",
  maxTargetPrice: "",
})

export const validateRequestForm = (fields: RequestFormFields) => {
  const errors: RequestFormErrors = {}

  const itemNeeded = fields.itemNeeded.trim()
  const description = fields.description.trim()
  const requestedFrom = fields.requestedFrom.trim()
  const requestedTo = fields.requestedTo.trim()
  const minTargetPrice = Number(fields.minTargetPrice)
  const maxTargetPrice = Number(fields.maxTargetPrice)

  if (!itemNeeded) {
    errors.itemNeeded = "Item name is required."
  }

  if (!description) {
    errors.description = "Description is required."
  }

  if (!requestedFrom) {
    errors.requestedFrom = "Required start date is required."
  } else if (!isValidDateValue(requestedFrom)) {
    errors.requestedFrom = "Required start date is invalid."
  }

  if (!requestedTo) {
    errors.requestedTo = "Required end date is required."
  } else if (!isValidDateValue(requestedTo)) {
    errors.requestedTo = "Required end date is invalid."
  }

  if (fields.minTargetPrice === "") {
    errors.minTargetPrice = "Minimum target price is required."
  } else if (!Number.isFinite(minTargetPrice) || minTargetPrice < 0) {
    errors.minTargetPrice = "Minimum target price must be 0 or greater."
  }

  if (fields.maxTargetPrice === "") {
    errors.maxTargetPrice = "Maximum target price is required."
  } else if (!Number.isFinite(maxTargetPrice) || maxTargetPrice < 0) {
    errors.maxTargetPrice = "Maximum target price must be 0 or greater."
  }

  if (
    !errors.requestedFrom &&
    !errors.requestedTo &&
    new Date(requestedTo).getTime() < new Date(requestedFrom).getTime()
  ) {
    errors.requestedTo = "Required end date must be on or after the start date."
  }

  if (!errors.minTargetPrice && !errors.maxTargetPrice && maxTargetPrice < minTargetPrice) {
    errors.maxTargetPrice =
      "Maximum target price must be greater than or equal to the minimum target price."
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false as const,
      errors,
    }
  }

  return {
    success: true as const,
    payload: {
      itemNeeded,
      description,
      requestedFrom,
      requestedTo,
      minTargetPrice,
      maxTargetPrice,
    } satisfies RequestCreateInput,
  }
}
