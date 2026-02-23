import type { AuthErrorCode } from "../../shared/schemas/auth"

const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  AUTH_DOMAIN_NOT_ALLOWED: "Only up.edu.ph email addresses are allowed.",
  AUTH_INVALID_TOKEN: "The Google ID token is invalid.",
  AUTH_TOKEN_EXPIRED: "The Google ID token has expired.",
  AUTH_PROVIDER_MISCONFIG: "Auth provider is misconfigured.",
  AUTH_UNAUTHORIZED: "You must be authenticated to access this resource.",
  AUTH_SESSION_INVALID: "Session is invalid or expired.",
  AUTH_INTERNAL: "Authentication failed due to an internal error.",
}

const AUTH_ERROR_STATUS: Record<AuthErrorCode, number> = {
  AUTH_DOMAIN_NOT_ALLOWED: 403,
  AUTH_INVALID_TOKEN: 401,
  AUTH_TOKEN_EXPIRED: 401,
  AUTH_PROVIDER_MISCONFIG: 500,
  AUTH_UNAUTHORIZED: 401,
  AUTH_SESSION_INVALID: 401,
  AUTH_INTERNAL: 500,
}

export class AuthApiError extends Error {
  code: AuthErrorCode
  statusCode: number

  constructor(code: AuthErrorCode, message?: string) {
    super(message ?? AUTH_ERROR_MESSAGES[code])
    this.name = "AuthApiError"
    this.code = code
    this.statusCode = AUTH_ERROR_STATUS[code]
  }
}

export function getAuthErrorMessage(code: AuthErrorCode): string {
  return AUTH_ERROR_MESSAGES[code]
}
