export type MergeableChatMessage = {
  id: string
  senderUserId: string
  createdAt: string
}

export const mergeChatMessages = <T extends MergeableChatMessage>(existing: T[], incoming: T[]) => {
  const byId = new Map(existing.map((message) => [message.id, message]))

  for (const message of incoming) {
    byId.set(message.id, message)
  }

  return [...byId.values()].sort((left, right) => {
    const timestampDiff = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    return timestampDiff !== 0 ? timestampDiff : left.id.localeCompare(right.id)
  })
}

export const getLastOutgoingMessageId = <T extends { id: string; senderUserId: string }>(
  messages: T[],
  otherParticipantId: string | null | undefined,
) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message && message.senderUserId !== otherParticipantId) {
      return message.id
    }
  }

  return null
}
