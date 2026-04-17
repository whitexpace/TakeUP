import { z } from "zod"

export const MAX_MESSAGE_LENGTH = 2000

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  body: z
    .string()
    .min(1, "Message cannot be empty")
    .max(MAX_MESSAGE_LENGTH, `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`)
    .refine((val) => val.trim().length > 0, "Message cannot be whitespace only"),
})

export const getOrCreateConversationSchema = z.object({
  transactionId: z.string().min(1),
})

export const fetchMessagesSchema = z.object({
  conversationId: z.string().uuid(),
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(50),
})

export const markAsReadSchema = z.object({
  conversationId: z.string().uuid(),
})

export type SendMessageInput = z.infer<typeof sendMessageSchema>
export type GetOrCreateConversationInput = z.infer<typeof getOrCreateConversationSchema>
export type FetchMessagesInput = z.infer<typeof fetchMessagesSchema>
export type MarkAsReadInput = z.infer<typeof markAsReadSchema>
