import { describe, expect, it } from "vitest"
import { containsModeratedContent, sanitizeChatMessage } from "#shared/chat-moderation"

describe("sanitizeChatMessage", () => {
  it("censors phone numbers and email addresses", () => {
    expect(sanitizeChatMessage("Reach me at 09171234567 or sample@up.edu.ph")).toBe(
      "Reach me at [censored] or [censored]",
    )
  })

  it("censors profanity case-insensitively", () => {
    expect(sanitizeChatMessage("That was SHIT and gago behavior")).toBe(
      "That was [censored] and [censored] behavior",
    )
  })

  it("censors repeated matches without touching clean text", () => {
    expect(sanitizeChatMessage("fuck this and fuck that")).toBe(
      "[censored] this and [censored] that",
    )
  })

  it("censors links", () => {
    expect(sanitizeChatMessage("Check https://example.com and www.test.ph/item")).toBe(
      "Check [censored] and [censored]",
    )
  })

  it("censors expanded Filipino and Cebuano profanity", () => {
    expect(sanitizeChatMessage("yawa ka, punyeta, bogo")).toBe(
      "[censored] ka, [censored], [censored]",
    )
  })
})

describe("containsModeratedContent", () => {
  it("detects mixed personal-contact, links, and profanity content", () => {
    expect(containsModeratedContent("Email me then, bitch: sample@up.edu.ph")).toBe(true)
    expect(containsModeratedContent("Open example.com later")).toBe(true)
  })

  it("returns false for clean content", () => {
    expect(containsModeratedContent("See you at the library tomorrow.")).toBe(false)
  })
})
