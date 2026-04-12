import { createClient } from "@supabase/supabase-js"
import { createError, getHeader, readBody } from "h3"
import { createContext } from "../../trpc/context"

type AvatarUploadUrlBody = {
  fileName?: string
}

const getSafeFileName = (fileName: string) => {
  return (
    fileName
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "avatar"
  )
}

export default defineEventHandler(async (event) => {
  const ctx = await createContext(event)
  if (!ctx.user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized." })
  }

  const body = await readBody<AvatarUploadUrlBody>(event)
  const rawFileName = typeof body?.fileName === "string" ? body.fileName.trim() : ""
  if (!rawFileName) {
    throw createError({ statusCode: 400, statusMessage: "Missing file name." })
  }

  const runtimeConfig = useRuntimeConfig(event)
  const supabaseUrl = runtimeConfig.public.supabase?.url
  const serviceRoleKey = runtimeConfig.supabaseServiceRoleKey
  const anonKey = runtimeConfig.public.supabase?.key
  const avatarBucket = runtimeConfig.public.userAvatarBucket

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
      statusMessage: "Missing Supabase access token for avatar upload.",
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
          statusMessage: "Invalid Supabase access token for avatar upload.",
        })
      }
    }
  }

  const supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  })

  const storagePath = `${storageOwnerId}/${crypto.randomUUID()}-${getSafeFileName(rawFileName)}`
  const { data, error } = await supabaseClient.storage
    .from(avatarBucket)
    .createSignedUploadUrl(storagePath)

  if (error || !data?.token) {
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || "Unable to create avatar upload URL.",
    })
  }

  const { data: publicUrlData } = supabaseClient.storage
    .from(avatarBucket)
    .getPublicUrl(storagePath)

  return {
    token: data.token,
    path: storagePath,
    publicUrl: publicUrlData.publicUrl,
  }
})
