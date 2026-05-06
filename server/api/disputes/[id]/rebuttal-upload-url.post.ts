import { createClient } from "@supabase/supabase-js"
import { createError, getHeader, getRouterParam, readBody } from "h3"
import { z } from "zod"
import { createContext } from "../../../trpc/context"

const bodySchema = z.object({
  fileName: z.string().trim().min(1),
})

const getSafeFileName = (fileName: string) =>
  fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "rebuttal-image"

const getStorageDateSegment = () => new Date().toISOString().slice(0, 10)

export default defineEventHandler(async (event) => {
  const ctx = await createContext(event)
  if (!ctx.user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized." })
  }

  const disputeId = getRouterParam(event, "id")
  if (!disputeId) {
    throw createError({ statusCode: 400, statusMessage: "Missing dispute ID." })
  }

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid request.", data: parsed.error.flatten() })
  }

  const dispute = await ctx.prisma.transactionDispute.findUnique({
    where: { id: disputeId },
    select: {
      id: true,
      raisedById: true,
      rebuttalSubmittedAt: true,
      transaction: { select: { borrowerId: true, lenderId: true } },
    },
  })

  if (!dispute) {
    throw createError({ statusCode: 404, statusMessage: "Dispute not found." })
  }

  const isParticipant =
    dispute.transaction.borrowerId === ctx.user.id ||
    dispute.transaction.lenderId === ctx.user.id
  const isCounterparty = isParticipant && dispute.raisedById !== ctx.user.id

  if (!isCounterparty) {
    throw createError({ statusCode: 403, statusMessage: "Only the counterparty can upload a rebuttal image." })
  }

  if (dispute.rebuttalSubmittedAt) {
    throw createError({ statusCode: 409, statusMessage: "A rebuttal has already been submitted." })
  }

  const runtimeConfig = useRuntimeConfig(event)
  const supabaseUrl = runtimeConfig.public.supabase?.url
  const serviceRoleKey = runtimeConfig.supabaseServiceRoleKey
  const anonKey = runtimeConfig.public.supabase?.key
  const bucket = runtimeConfig.public.itemImageBucket

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

  const supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  })

  const storagePath = [
    "dispute-rebuttals",
    ctx.user.id,
    disputeId,
    getStorageDateSegment(),
    `${crypto.randomUUID()}-${getSafeFileName(parsed.data.fileName)}`,
  ].join("/")

  const { data, error } = await supabaseClient.storage.from(bucket).createSignedUploadUrl(storagePath)

  if (error || !data?.token) {
    throw createError({ statusCode: 500, statusMessage: error?.message || "Unable to create upload URL." })
  }

  const { data: publicUrlData } = supabaseClient.storage.from(bucket).getPublicUrl(storagePath)

  return {
    token: data.token,
    path: storagePath,
    publicUrl: publicUrlData.publicUrl,
    bucket,
  }
})
