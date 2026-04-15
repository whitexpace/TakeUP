import { createClient } from "@supabase/supabase-js"
import { createError, deleteCookie, getHeader, readBody } from "h3"
import { deleteAccountRequestSchema } from "../../../shared/schemas/account"
import { createContext } from "../../trpc/context"
import {
  deleteAccountAndAnonymizeData,
  getAccountDeletionEligibility,
} from "../../utils/account-deletion"
import { sessionCookieName } from "../../utils/auth-session"

export default defineEventHandler(async (event) => {
  const ctx = await createContext(event)

  if (!ctx.user) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized.",
    })
  }

  const sessionUser = ctx.user

  const body = await readBody(event)
  const parsedBody = deleteAccountRequestSchema.safeParse(body)
  if (!parsedBody.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Type "DELETE" to confirm account deletion.',
      data: parsedBody.error.flatten(),
    })
  }

  const runtimeConfig = useRuntimeConfig(event)
  const supabaseUrl = runtimeConfig.public.supabase?.url
  const supabaseAnonKey = runtimeConfig.public.supabase?.key
  const serviceRoleKey = runtimeConfig.supabaseServiceRoleKey

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "Account deletion is not available because Supabase admin access is missing.",
    })
  }

  const authHeader = getHeader(event, "authorization") ?? ""
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : ""

  if (!accessToken) {
    throw createError({
      statusCode: 401,
      statusMessage: "Missing Supabase access token.",
    })
  }

  let supabaseUser: { id?: string; email?: string }
  try {
    supabaseUser = await $fetch<{ id?: string; email?: string }>(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
      },
    })
  } catch {
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid Supabase access token.",
    })
  }

  if (!supabaseUser.id) {
    throw createError({
      statusCode: 500,
      statusMessage: "Unable to identify the Supabase account for deletion.",
    })
  }

  const eligibility = await getAccountDeletionEligibility(ctx.prisma, sessionUser.id)
  if (!eligibility.eligible) {
    throw createError({
      statusCode: 409,
      statusMessage: "Account deletion is blocked until all outstanding issues are resolved.",
      data: eligibility,
    })
  }

  const deletionResult = await deleteAccountAndAnonymizeData(ctx.prisma, sessionUser.id).catch(
    async (error: unknown) => {
      if (process.env.NODE_ENV !== "production") {
        console.error("[account/deletion] failed", error)
      }

      if (error instanceof Error && error.message === "ACCOUNT_DELETION_BLOCKED") {
        const latestEligibility = await getAccountDeletionEligibility(ctx.prisma, sessionUser.id)

        throw createError({
          statusCode: 409,
          statusMessage: "Account deletion is blocked until all outstanding issues are resolved.",
          data: latestEligibility,
        })
      }

      if (error instanceof Error && error.message === "ACCOUNT_NOT_FOUND") {
        throw createError({
          statusCode: 404,
          statusMessage: "User account not found.",
        })
      }

      if (error instanceof Error && error.message === "ACCOUNT_DELETION_AUDIT_LOG_MISSING") {
        throw createError({
          statusCode: 500,
          statusMessage:
            "Account deletion is blocked because the audit log table is missing. Run the latest Prisma migration first.",
        })
      }

      throw createError({
        statusCode: 500,
        statusMessage:
          error instanceof Error && error.message
            ? `We could not delete your account right now: ${error.message}`
            : "We could not delete your account right now. No changes were finalized.",
      })
    },
  )

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  deleteCookie(event, sessionCookieName, { path: "/" })

  const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(supabaseUser.id)

  if (deleteAuthError) {
    throw createError({
      statusCode: 502,
      statusMessage:
        "Your data was removed, but we could not revoke your login access automatically.",
      data: { message: deleteAuthError.message },
    })
  }

  return {
    ok: true,
    result: deletionResult,
  }
})
