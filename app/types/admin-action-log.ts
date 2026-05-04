export type AdminActionLogCursor = {
  id: string
  createdAt: string | Date
} | null

export type AdminActionLogRecord = {
  id: string
  actionType: string
  targetType: string
  targetId: string
  targetLabel: string | null
  description: string | null
  metadata: Record<string, unknown>
  createdAt: string | Date
  admin: {
    id: string
    name: string
    username: string
    email: string
  }
}

export type AdminActionLogsResponse = {
  logs: AdminActionLogRecord[]
  nextCursor: AdminActionLogCursor
}
