import { sessionCookieName } from "./auth-session"

export function hasAuthorizationHeader(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().toLowerCase().startsWith("bearer ")
}

export function hasSessionCookie(cookieHeader: string | null | undefined): boolean {
  if (typeof cookieHeader !== "string" || cookieHeader.trim().length === 0) {
    return false
  }

  return cookieHeader.split(";").some((part) => part.trim().startsWith(`${sessionCookieName}=`))
}

export function mergeVaryHeader(
  currentValue: string | null | undefined,
  additions: string[],
): string {
  const values = new Set(
    (currentValue ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  )

  for (const value of additions) {
    values.add(value)
  }

  return [...values].join(", ")
}
