import { Prisma } from "@prisma/client"

export const ADMIN_ACTION_TARGET_TYPES = {
  LISTING: "LISTING",
  USER: "USER",
} as const

export const ADMIN_ACTION_TYPES = {
  BAN_USER: "BAN_USER",
  UNBAN_USER: "UNBAN_USER",
  SUSPEND_USER: "SUSPEND_USER",
  UNSUSPEND_USER: "UNSUSPEND_USER",
  DELETE_USER: "DELETE_USER",
  ASSIGN_ADMIN_ROLE: "ASSIGN_ADMIN_ROLE",
  REVOKE_ADMIN_ROLE: "REVOKE_ADMIN_ROLE",
  DEACTIVATE_LISTING: "DEACTIVATE_LISTING",
  ACTIVATE_LISTING: "ACTIVATE_LISTING",
  REMOVE_LISTING: "REMOVE_LISTING",
} as const

type AdminActionLogPayload = {
  adminId: string
  actionType: string
  targetType: string
  targetId: string
  targetLabel?: string | null
  description?: string | null
  itemId?: string | null
  metadata?: Record<string, unknown>
}

export async function createAdminActionLog(
  prisma: {
    $executeRaw: (
      query: TemplateStringsArray | Prisma.Sql,
      ...values: unknown[]
    ) => Promise<unknown>
  },
  payload: AdminActionLogPayload,
) {
  return prisma.$executeRaw(Prisma.sql`
    INSERT INTO "admin_action_logs" (
      "admin_user_id",
      "action_type",
      "target_type",
      "target_id",
      "target_label",
      "description",
      "metadata",
      "item_id"
    )
    VALUES (
      ${payload.adminId},
      ${payload.actionType},
      ${payload.targetType},
      ${payload.targetId},
      ${payload.targetLabel ?? null},
      ${payload.description ?? null},
      ${JSON.stringify(payload.metadata ?? {})}::jsonb,
      ${payload.itemId ?? null}
    )
  `)
}
