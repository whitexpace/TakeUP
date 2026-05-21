import { Buffer } from "node:buffer"
import { createError, getHeader, readBody } from "h3"
import type { H3Event } from "h3"
import { z } from "zod"
import { itemCategorySchema, itemConditionSchema, rateOptionSchema } from "#shared/schemas/item"
import { extractStoragePathFromPublicUrl } from "../../utils/item-image-storage"

const MAX_PREFILL_IMAGE_BYTES = 10 * 1024 * 1024

const prefillRequestSchema = z.object({
  imageUrl: z.string().url(),
})

const aiPrefillSchema = z
  .object({
    name: z.string().trim().max(120).optional().default(""),
    description: z.string().trim().max(2000).optional().default(""),
    condition: itemConditionSchema.optional().nullable(),
    categories: z.array(itemCategorySchema).max(3).optional().default([]),
    tags: z.array(z.string().trim().min(1).max(50)).max(8).optional().default([]),
    rentalFee: z.number().int().min(0).max(999_999).optional().nullable(),
    replacementCost: z.number().int().min(0).max(9_999_999).optional().nullable(),
    freeToBorrow: z.boolean().optional().nullable(),
    rateOption: rateOptionSchema.optional().nullable(),
    whatItemOffers: z.array(z.string().trim().min(1).max(100)).max(6).optional().default([]),
    whatIsIncluded: z.array(z.string().trim().min(1).max(100)).max(6).optional().default([]),
    knownIssues: z.string().trim().max(2000).optional().default(""),
    usageLimitations: z.string().trim().max(2000).optional().default(""),
  })
  .transform((prefill) => ({
    ...prefill,
    name: prefill.name || undefined,
    description: prefill.description || undefined,
    condition: prefill.condition ?? undefined,
    categories: [...new Set(prefill.categories)],
    tags: [...new Set(prefill.tags.map((tag) => tag.toLowerCase()))],
    rentalFee: prefill.rentalFee ?? undefined,
    replacementCost: prefill.replacementCost ?? undefined,
    freeToBorrow: prefill.freeToBorrow ?? undefined,
    rateOption: prefill.rateOption ?? undefined,
    whatItemOffers: [...new Set(prefill.whatItemOffers)],
    whatIsIncluded: [...new Set(prefill.whatIsIncluded)],
    knownIssues: prefill.knownIssues || undefined,
    usageLimitations: prefill.usageLimitations || undefined,
  }))

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
}

const getFetchErrorStatus = (err: unknown) =>
  (err as { statusCode?: number; status?: number; response?: { status?: number } })?.statusCode ??
  (err as { status?: number; response?: { status?: number } })?.status ??
  (err as { response?: { status?: number } })?.response?.status

const getFetchErrorMessage = (err: unknown) => {
  const data = (err as { data?: unknown })?.data
  if (typeof data === "object" && data !== null) {
    const error = (data as { error?: unknown }).error
    if (typeof error === "object" && error !== null) {
      const message = (error as { message?: unknown }).message
      if (typeof message === "string" && message.trim()) return message.trim()
    }

    const message = (data as { message?: unknown }).message
    if (typeof message === "string" && message.trim()) return message.trim()
  }

  const message = (err as { message?: unknown })?.message
  return typeof message === "string" && message.trim() ? message.trim() : null
}

const extractGeminiText = (response: GeminiGenerateContentResponse) =>
  response.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .find((part) => part.text)?.text

const parseJsonText = (text: string) => {
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (!match?.[1]) throw new Error("Gemini returned invalid JSON.")
    return JSON.parse(match[1])
  }
}

const assertOwnedItemImage = (
  imageUrl: string,
  bucket: string,
  ownerIds: string[],
  supabaseUrl: string,
) => {
  try {
    const parsedImageUrl = new URL(imageUrl)
    const parsedSupabaseUrl = new URL(supabaseUrl)
    if (parsedImageUrl.origin !== parsedSupabaseUrl.origin) {
      throw new Error("Image is not from the configured Supabase project.")
    }
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Invalid item image URL." })
  }

  const storagePath = extractStoragePathFromPublicUrl(imageUrl, bucket)
  if (!storagePath || !ownerIds.some((ownerId) => storagePath.startsWith(`items/${ownerId}/`))) {
    throw createError({ statusCode: 400, statusMessage: "Invalid item image URL." })
  }

  return storagePath
}

const getSupabaseUserIdFromAccessToken = async (
  event: H3Event,
  supabaseUrl: string,
  supabaseAnonKey: string,
) => {
  const authHeader = getHeader(event, "authorization") ?? ""
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : ""

  if (!accessToken) return null

  try {
    const supabaseUser = await $fetch<{ id?: string }>(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
      },
    })

    return typeof supabaseUser.id === "string" && supabaseUser.id.trim()
      ? supabaseUser.id.trim()
      : null
  } catch {
    return null
  }
}

const fetchImageForGemini = async (imageUrl: string) => {
  let response
  try {
    response = await $fetch.raw<ArrayBuffer>(imageUrl, {
      responseType: "arrayBuffer",
    })
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: "Unable to read the uploaded photo for AI prefill.",
    })
  }

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim()
  if (!contentType?.startsWith("image/")) {
    throw createError({ statusCode: 400, statusMessage: "The uploaded file is not an image." })
  }

  const byteLength = Number(response.headers.get("content-length") ?? 0)
  if (byteLength > MAX_PREFILL_IMAGE_BYTES) {
    throw createError({ statusCode: 400, statusMessage: "Image is too large for AI prefill." })
  }

  const buffer = Buffer.from(response._data ?? new ArrayBuffer(0))
  if (buffer.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "Unable to read uploaded image." })
  }

  if (buffer.length > MAX_PREFILL_IMAGE_BYTES) {
    throw createError({ statusCode: 400, statusMessage: "Image is too large for AI prefill." })
  }

  return {
    mimeType: contentType,
    data: buffer.toString("base64"),
  }
}

const buildPrompt = () => `
Analyze this uploaded rental listing photo for TakeUP, a student borrowing and rental marketplace.
Return only JSON that matches the schema. Use Philippine peso integers for price estimates.

Rules:
- Identify the visible item, not the background.
- If uncertain, choose conservative values and leave unknown optional text empty.
- Use categories only from: ELECTRONICS, BOOKS, CLOTHING, TOOLS, HOME_APPLIANCES, SPORTS_OUTDOORS, MUSIC_AUDIO, TOYS_GAMES, FURNITURE, VEHICLES_ACCESSORIES, HEALTH_BEAUTY, SCHOOL_SUPPLIES, PET_SUPPLIES, OTHER.
- Use condition only from: NEW, LIKE_NEW, GOOD, FAIR, POOR.
- Write concise listing copy a lender can edit.
- whatItemOffers and whatIsIncluded must be short chip labels.
- Do not claim accessories are included unless they are visible or very likely from the image.
`

const shouldShowAiPrefillErrors = (user: { accountType?: string | null }) =>
  user.accountType === "ADMIN"

const skippedPrefillResponse = { skipped: true as const }

export default defineEventHandler(async (event) => {
  const user = event.context.authUser
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized." })
  }

  const body = await readBody(event)
  const parsedBody = prefillRequestSchema.safeParse(body)
  if (!parsedBody.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid prefill request." })
  }

  const runtimeConfig = useRuntimeConfig(event)
  const apiKey = runtimeConfig.geminiApiKey
  const model = runtimeConfig.geminiModel
  const supabaseUrl = runtimeConfig.public.supabase.url
  const supabaseAnonKey = runtimeConfig.public.supabase.key
  const showAiPrefillErrors = shouldShowAiPrefillErrors(user)

  if (!apiKey) {
    if (!showAiPrefillErrors) return skippedPrefillResponse

    throw createError({ statusCode: 503, statusMessage: "Gemini API key is not configured." })
  }
  if (!supabaseUrl) {
    throw createError({ statusCode: 500, statusMessage: "Supabase URL is missing." })
  }
  if (!supabaseAnonKey) {
    throw createError({ statusCode: 500, statusMessage: "Supabase key is missing." })
  }

  const supabaseUserId = await getSupabaseUserIdFromAccessToken(event, supabaseUrl, supabaseAnonKey)

  assertOwnedItemImage(
    parsedBody.data.imageUrl,
    runtimeConfig.public.itemImageBucket,
    [user.id, supabaseUserId].filter((ownerId): ownerId is string => Boolean(ownerId)),
    supabaseUrl,
  )
  const image = await fetchImageForGemini(parsedBody.data.imageUrl)

  let response: GeminiGenerateContentResponse
  try {
    response = await $fetch<GeminiGenerateContentResponse>(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: {
          contents: [
            {
              role: "user",
              parts: [
                {
                  inline_data: {
                    mime_type: image.mimeType,
                    data: image.data,
                  },
                },
                { text: buildPrompt() },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            response_mime_type: "application/json",
            response_schema: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                description: { type: "STRING" },
                condition: { type: "STRING", enum: ["NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR"] },
                categories: {
                  type: "ARRAY",
                  items: {
                    type: "STRING",
                    enum: [
                      "ELECTRONICS",
                      "BOOKS",
                      "CLOTHING",
                      "TOOLS",
                      "HOME_APPLIANCES",
                      "SPORTS_OUTDOORS",
                      "MUSIC_AUDIO",
                      "TOYS_GAMES",
                      "FURNITURE",
                      "VEHICLES_ACCESSORIES",
                      "HEALTH_BEAUTY",
                      "SCHOOL_SUPPLIES",
                      "PET_SUPPLIES",
                      "OTHER",
                    ],
                  },
                },
                tags: { type: "ARRAY", items: { type: "STRING" } },
                rentalFee: { type: "INTEGER" },
                replacementCost: { type: "INTEGER" },
                freeToBorrow: { type: "BOOLEAN" },
                rateOption: { type: "STRING", enum: ["PER_HOUR", "PER_DAY"] },
                whatItemOffers: { type: "ARRAY", items: { type: "STRING" } },
                whatIsIncluded: { type: "ARRAY", items: { type: "STRING" } },
                knownIssues: { type: "STRING" },
                usageLimitations: { type: "STRING" },
              },
            },
          },
        },
      },
    )
  } catch (err) {
    const status = getFetchErrorStatus(err)
    const geminiMessage = getFetchErrorMessage(err)

    if (process.env.NODE_ENV !== "production") {
      console.error("[items/prefill] Gemini request failed", {
        status,
        model,
        message: geminiMessage,
      })
    }

    if (status === 400 || status === 403) {
      throw createError({
        statusCode: 502,
        statusMessage: geminiMessage
          ? `Gemini rejected the AI prefill request: ${geminiMessage}`
          : "Gemini rejected the AI prefill request. Check the API key and model.",
      })
    }

    if (status === 429) {
      if (!showAiPrefillErrors) return skippedPrefillResponse

      throw createError({
        statusCode: 503,
        statusMessage: "Gemini quota was exceeded. Try again later.",
      })
    }

    throw createError({
      statusCode: 502,
      statusMessage: geminiMessage
        ? `Gemini prefill failed: ${geminiMessage}`
        : "Gemini is unavailable for AI prefill right now.",
    })
  }

  const text = extractGeminiText(response)
  if (!text) {
    throw createError({ statusCode: 502, statusMessage: "Gemini did not return suggestions." })
  }

  const parsedPrefill = aiPrefillSchema.safeParse(parseJsonText(text))
  if (!parsedPrefill.success) {
    throw createError({ statusCode: 502, statusMessage: "Gemini returned invalid suggestions." })
  }

  return parsedPrefill.data
})
