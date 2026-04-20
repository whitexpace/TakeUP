import { z } from "zod"

export const MAX_MESSAGE_LENGTH = 2000
export const MAX_CHAT_REPORT_DESCRIPTION_LENGTH = 1000

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  body: z
    .string()
    .min(1, "Message cannot be empty")
    .max(MAX_MESSAGE_LENGTH, `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`)
    .refine((val) => val.trim().length > 0, "Message cannot be whitespace only"),
  imageUrl: z.string().url().nullable().optional(),
})

export const conversationIdSchema = z.object({
  conversationId: z.string().uuid(),
})

export const transactionConversationSchema = z.object({
  transactionId: z.string().uuid(),
})

export const reportConversationSchema = z.object({
  conversationId: z.string().uuid(),
  description: z
    .string()
    .max(
      MAX_CHAT_REPORT_DESCRIPTION_LENGTH,
      `Report description cannot exceed ${MAX_CHAT_REPORT_DESCRIPTION_LENGTH} characters`,
    )
    .optional()
    .transform((value) => value?.trim() ?? ""),
})

export const getOrCreateConversationSchema = transactionConversationSchema

export const fetchMessagesSchema = z.object({
  conversationId: z.string().uuid(),
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(50),
})

export const markAsReadSchema = z.object({
  conversationId: z.string().uuid(),
})

export type SendMessageInput = z.infer<typeof sendMessageSchema>
export type ConversationIdInput = z.infer<typeof conversationIdSchema>
export type TransactionConversationInput = z.infer<typeof transactionConversationSchema>
export type ReportConversationInput = z.infer<typeof reportConversationSchema>
export type GetOrCreateConversationInput = z.infer<typeof getOrCreateConversationSchema>
export type FetchMessagesInput = z.infer<typeof fetchMessagesSchema>
export type MarkAsReadInput = z.infer<typeof markAsReadSchema>
