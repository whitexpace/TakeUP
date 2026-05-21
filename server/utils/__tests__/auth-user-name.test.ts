import { describe, expect, it } from "vitest"
import {
  buildAuthNameSyncData,
  extractSupabaseProviderName,
  isEmailDerivedPlaceholderName,
  parseProviderName,
} from "../auth-user-name"

describe("auth user name helpers", () => {
  it("uses Google given/family names and infers middle names from full name", () => {
    const name = parseProviderName({
      fullName: "Juan Miguel Dela Cruz",
      givenName: "Juan",
      familyName: "Dela Cruz",
    })

    expect(name).toEqual({
      firstName: "Juan",
      middleName: "Miguel",
      lastName: "Dela Cruz",
      fullName: "Juan Miguel Dela Cruz",
    })
  })

  it("splits a provider full name when only full_name is available", () => {
    expect(parseProviderName({ fullName: "Maria Clara Santos" })).toEqual({
      firstName: "Maria",
      middleName: "Clara",
      lastName: "Santos",
      fullName: "Maria Clara Santos",
    })
  })

  it("extracts Supabase Google metadata from user_metadata", () => {
    const name = extractSupabaseProviderName({
      user_metadata: {
        full_name: "Jose Rizal Mercado",
        given_name: "Jose",
        family_name: "Mercado",
      },
    })

    expect(name).toMatchObject({
      firstName: "Jose",
      middleName: "Rizal",
      lastName: "Mercado",
    })
  })

  it("detects and replaces email-derived placeholder names", () => {
    const current = { firstName: "jslegaspo", middleName: null, lastName: "User" }
    const providerName = parseProviderName({ fullName: "Juan Santos Legaspo" })

    expect(isEmailDerivedPlaceholderName(current, "jslegaspo@up.edu.ph")).toBe(true)
    expect(buildAuthNameSyncData(providerName, current, "jslegaspo@up.edu.ph")).toEqual({
      firstName: "Juan",
      middleName: "Santos",
      lastName: "Legaspo",
    })
  })

  it("does not overwrite an existing non-placeholder profile name", () => {
    const current = { firstName: "Custom", middleName: null, lastName: "Name" }
    const providerName = parseProviderName({ fullName: "Juan Santos Legaspo" })

    expect(buildAuthNameSyncData(providerName, current, "jslegaspo@up.edu.ph")).toBeNull()
  })
})
