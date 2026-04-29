import { describe, expect, it } from "vitest"
import { getLastOutgoingMessageId, mergeChatMessages } from "../chat-message-utils"
import { insertTextAtSelection } from "../chat-composer"

const makeMessage = (overrides: Record<string, unknown> = {}) => ({
  id: "message-1",
  senderUserId: "user-1",
  createdAt: "2026-04-20T00:00:00.000Z",
  body: "Hello",
  isRead: false,
  readAt: null,
  ...overrides,
})

describe("mergeChatMessages", () => {
  it("merges receipt updates into existing messages without duplicating them", () => {
    const result = mergeChatMessages(
      [makeMessage({ id: "message-1", isRead: false })],
      [makeMessage({ id: "message-1", isRead: true, readAt: "2026-04-20T01:00:00.000Z" })],
    )

    expect(result).toHaveLength(1)
    expect(result[0]?.isRead).toBe(true)
    expect(result[0]?.readAt).toBe("2026-04-20T01:00:00.000Z")
  })

  it("keeps messages ordered chronologically after merging new items", () => {
    const result = mergeChatMessages(
      [makeMessage({ id: "message-2", createdAt: "2026-04-20T02:00:00.000Z" })],
      [makeMessage({ id: "message-1", createdAt: "2026-04-20T01:00:00.000Z" })],
    )

    expect(result.map((message) => message.id)).toEqual(["message-1", "message-2"])
  })
})

describe("getLastOutgoingMessageId", () => {
  it("returns the latest outgoing message id for read receipts", () => {
    const result = getLastOutgoingMessageId(
      [
        makeMessage({ id: "incoming-1", senderUserId: "user-2" }),
        makeMessage({ id: "outgoing-1", senderUserId: "user-1" }),
        makeMessage({ id: "outgoing-2", senderUserId: "user-1" }),
      ],
      "user-2",
    )

    expect(result).toBe("outgoing-2")
  })
})

describe("insertTextAtSelection", () => {
  it("inserts emoji text at the current caret position", () => {
    const result = insertTextAtSelection("Hello world", "😊", 5, 5)

    expect(result.value).toBe("Hello😊 world")
    expect(result.selectionStart).toBe(7)
    expect(result.selectionEnd).toBe(7)
  })
})
