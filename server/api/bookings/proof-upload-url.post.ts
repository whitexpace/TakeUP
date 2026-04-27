import { createClient } from "@supabase/supabase-js"
import { createError, getHeader, readBody } from "h3"
import { z } from "zod"
import { createContext } from "../../trpc/context"

const proofUploadBodySchema = z.object({
  bookingId: z.string().uuid(),
  proofType: z.enum(["HANDOFF", "RETURN"]),
  fileName: z.string().trim().min(1),
})

const getSafeFileName = (fileName: string) =>
  fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "proof-image"

const getStorageDateSegment = () => new Date().toISOString().slice(0, 10)

export default defineEventHandler(async (event) => {
  const ctx = await createContext(event)
  if (!ctx.user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized." })
  }

  const parsed = proofUploadBodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid proof upload request.",
      data: parsed.error.flatten(),
    })
  }

  const booking = await ctx.prisma.booking.findUnique({
    where: { id: parsed.data.bookingId },
    select: {
      id: true,
      borrowerId: true,
      lenderId: true,
    },
  })

  if (!booking) {
    throw createError({ statusCode: 404, statusMessage: "Booking not found." })
  }

  const isAllowed =
    parsed.data.proofType === "HANDOFF"
      ? booking.lenderId === ctx.user.id
      : booking.borrowerId === ctx.user.id

  if (!isAllowed) {
    throw createError({
      statusCode: 403,
      statusMessage: "You are not allowed to upload this proof.",
    })
  }

  const runtimeConfig = useRuntimeConfig(event)
  const supabaseUrl = runtimeConfig.public.supabase?.url
  const serviceRoleKey = runtimeConfig.supabaseServiceRoleKey
  const anonKey = runtimeConfig.public.supabase?.key
  const proofBucket = runtimeConfig.public.itemImageBucket

  if (!supabaseUrl) {
    throw createError({ statusCode: 500, statusMessage: "Supabase URL is missing." })
  }

  const authHeader = getHeader(event, "authorization") ?? ""
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : ""

  const supabaseKey = serviceRoleKey || anonKey
  if (!supabaseKey) {
    throw createError({ statusCode: 500, statusMessage: "Supabase key is missing." })
  }

  const usingUserTokenFallback = !serviceRoleKey
  if (usingUserTokenFallback && !accessToken) {
    throw createError({
      statusCode: 401,
      statusMessage: "Missing Supabase access token for proof upload.",
    })
  }

  let storageOwnerId = ctx.user.id
  if (accessToken) {
    try {
      const supabaseUser = await $fetch<{ id?: string }>(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          authorization: `Bearer ${accessToken}`,
          apikey: anonKey || supabaseKey,
        },
      })

      if (typeof supabaseUser?.id === "string" && supabaseUser.id.trim().length > 0) {
        storageOwnerId = supabaseUser.id
      }
    } catch {
      if (usingUserTokenFallback) {
        throw createError({
          statusCode: 401,
          statusMessage: "Invalid Supabase access token for proof upload.",
        })
      }
    }
  }

  const supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  })

  const storagePath = [
    "transaction-proofs",
    storageOwnerId,
    booking.id,
    parsed.data.proofType.toLowerCase(),
    getStorageDateSegment(),
    `${crypto.randomUUID()}-${getSafeFileName(parsed.data.fileName)}`,
  ].join("/")

  const { data, error } = await supabaseClient.storage
    .from(proofBucket)
    .createSignedUploadUrl(storagePath)

  if (error || !data?.token) {
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || "Unable to create proof upload URL.",
    })
  }

  const { data: publicUrlData } = supabaseClient.storage
    .from(proofBucket)
    .getPublicUrl(storagePath)

  return {
    token: data.token,
    path: storagePath,
    publicUrl: publicUrlData.publicUrl,
    bucket: proofBucket,
  }
})
