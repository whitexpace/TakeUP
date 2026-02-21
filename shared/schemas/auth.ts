import { z } from "zod"

export const googleAuthRequestSchema = z.object({
  idToken: z.string().min(1, "Missing idToken"),
})

export const authErrorCodeSchema = z.enum([
  "AUTH_DOMAIN_NOT_ALLOWED",
  "AUTH_INVALID_TOKEN",
  "AUTH_TOKEN_EXPIRED",
  "AUTH_PROVIDER_MISCONFIG",
  "AUTH_UNAUTHORIZED",
  "AUTH_SESSION_INVALID",
  "AUTH_INTERNAL",
])

export const authErrorResponseSchema = z.object({
  error: z.object({
    code: authErrorCodeSchema,
    message: z.string(),
  }),
})

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
})

export const googleAuthResponseSchema = z.object({
  user: authUserSchema,
  session: z.object({
    expiresAt: z.string(),
    strategy: z.literal("httpOnlyCookie"),
  }),
})

export type AuthErrorCode = z.infer<typeof authErrorCodeSchema>
export type GoogleAuthRequest = z.infer<typeof googleAuthRequestSchema>
export type GoogleAuthResponse = z.infer<typeof googleAuthResponseSchema>
