import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { adminProcedure } from "../procedures"
import { t } from "../init"
import { Prisma } from "@prisma/client"
import {
  listAdminActionLogsSchema,
  listAdminListingsSchema,
  moderateAdminListingSchema,
} from "../../../shared/schemas/admin"
import {
  ADMIN_ACTION_TARGET_TYPES,
  ADMIN_ACTION_TYPES,
  createAdminActionLog,
} from "../../utils/admin-action-log"
import {
  getAdminListingStatusLabel,
  getAdminListingViewStatus,
  NON_TERMINAL_TRANSACTION_STATUSES,
  NON_TERMINAL_TRANSACTION_STATUS_DB_VALUES,
} from "../../utils/admin-listings"

const ADMIN_LISTING_ACTIVE_STATUSES = ["AVAILABLE", "UNAVAILABLE", "RENTED"] as const

const ADMIN_LISTING_BASE_SQL = Prisma.sql`(i."status" <> 'DELETED' OR i."adminModerationState" = 'REMOVED')`

const buildAdminListingStatusSql = (
  statuses?: Array<"ACTIVE" | "INACTIVE" | "DEACTIVATED_BY_ADMIN" | "REMOVED_BY_ADMIN">,
) => {
  if (!statuses?.length) return Prisma.sql`TRUE`

  const clauses = statuses.map((status) => {
    switch (status) {
      case "ACTIVE":
        return Prisma.sql`(i."adminModerationState" IS NULL AND i."status" IN ('AVAILABLE', 'UNAVAILABLE', 'RENTED'))`
      case "INACTIVE":
        return Prisma.sql`(i."adminModerationState" IS NULL AND i."status" = 'DEACTIVATED')`
      case "DEACTIVATED_BY_ADMIN":
        return Prisma.sql`i."adminModerationState" = 'DEACTIVATED'`
      case "REMOVED_BY_ADMIN":
        return Prisma.sql`i."adminModerationState" = 'REMOVED'`
    }
  })

  return Prisma.sql`(${Prisma.join(clauses, " OR ")})`
}

const buildAdminListingCategorySql = (categories?: string[]) => {
  if (!categories?.length) return Prisma.sql`TRUE`

  return Prisma.sql`
    EXISTS (
      SELECT 1
      FROM "ItemCategoryOnItem" cat
      WHERE cat."itemId" = i."id"
        AND cat."category" IN (${Prisma.join(categories)})
    )
  `
}

const buildAdminListingSearchSql = (search?: string) => {
  const trimmed = search?.trim()
  if (!trimmed) return Prisma.sql`TRUE`

  const like = `%${trimmed}%`
  const numericId = Number(trimmed)

  return Prisma.sql`
    (
      i."id"::text ILIKE ${like}
      OR CAST(i."numericId" AS TEXT) ILIKE ${like}
      OR i."name" ILIKE ${like}
      OR i."lenderId"::text ILIKE ${like}
      OR u."username" ILIKE ${like}
      OR u."email" ILIKE ${like}
      OR u."firstName" ILIKE ${like}
      OR u."lastName" ILIKE ${like}
      OR CONCAT_WS(' ', u."firstName", u."lastName") ILIKE ${like}
      ${Number.isInteger(numericId) ? Prisma.sql`OR i."numericId" = ${numericId}` : Prisma.empty}
    )
  `
}

const buildAdminListingsSummary = async (prisma: {
  $queryRaw: <T = unknown>(query: Prisma.Sql) => Promise<T>
}) => {
  const rows = await prisma.$queryRaw<
    Array<{ totalListings: bigint; activeListings: bigint; inactiveListings: bigint }>
  >(Prisma.sql`
    SELECT
      COUNT(*)::bigint AS "totalListings",
      COUNT(*) FILTER (
        WHERE i."adminModerationState" IS NULL
          AND i."status" IN ('AVAILABLE', 'UNAVAILABLE', 'RENTED')
      )::bigint AS "activeListings",
      COUNT(*) FILTER (
        WHERE i."status" = 'DEACTIVATED'
          OR i."adminModerationState" IN ('DEACTIVATED', 'REMOVED')
      )::bigint AS "inactiveListings"
    FROM "Item" i
    WHERE ${ADMIN_LISTING_BASE_SQL}
  `)

  const summary = rows[0]
  return {
    totalListings: Number(summary?.totalListings ?? 0),
    activeListings: Number(summary?.activeListings ?? 0),
    inactiveListings: Number(summary?.inactiveListings ?? 0),
  }
}

const getActiveListingTransactionWhere = () =>
  Prisma.sql`status::text IN (${Prisma.join(NON_TERMINAL_TRANSACTION_STATUS_DB_VALUES)})`

export const adminRouter = t.router({
  users: t.router({
    /**
     * Fetch all users with filters and pagination
     */
    list: adminProcedure
      .input(
        z.object({
          skip: z.number().int().nonnegative().default(0),
          take: z.number().int().positive().max(100).default(20),
          search: z.string().optional(),
          role: z.enum(["LENDER", "BORROWER", "ADMIN"]).optional(),
          status: z.enum(["ACTIVE", "SUSPENDED", "BANNED", "PENDING", "DEACTIVATED"]).optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        const where: Prisma.UserWhereInput = {}

        if (input.search) {
          where.OR = [
            { firstName: { contains: input.search, mode: "insensitive" } },
            { lastName: { contains: input.search, mode: "insensitive" } },
            { email: { contains: input.search, mode: "insensitive" } },
            { username: { contains: input.search, mode: "insensitive" } },
          ]
        }

        if (input.role) {
          where.accountType = input.role
        }

        if (input.status) {
          where.status = input.status
        }

        const [users, totalCount] = await Promise.all([
          ctx.prisma.user.findMany({
            where,
            select: {
              id: true,
              username: true,
              email: true,
              firstName: true,
              lastName: true,
              createdAt: true,
              accountType: true,
              status: true,
              lender: {
                select: {
                  lenderRating: true,
                },
              },
              borrower: {
                select: {
                  borrowerRating: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
            skip: input.skip,
            take: input.take,
          }),
          ctx.prisma.user.count({ where }),
        ])

        return {
          users: users.map((user) => ({
            id: user.id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            createdAt: user.createdAt,
            accountType: user.accountType,
            status: user.status,
            lenderRating: user.lender?.lenderRating ?? 0,
            borrowerRating: user.borrower?.borrowerRating ?? 0,
          })),
          totalCount,
          pageInfo: {
            skip: input.skip,
            take: input.take,
            hasMore: input.skip + input.take < totalCount,
          },
        }
      }),

    /**
     * Fetch detailed profile for a specific user
     */
    detail: adminProcedure
      .input(z.object({ userId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const user = await ctx.prisma.user.findUnique({
          where: { id: input.userId },
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
            middleName: true,
            avatarUrl: true,
            bio: true,
            pronouns: true,
            location: true,
            createdAt: true,
            accountType: true,
            status: true,
            points: true,
            admin: {
              select: {
                role: true,
                accessLevel: true,
              },
            },
            lender: {
              select: {
                lenderRating: true,
              },
            },
            borrower: {
              select: {
                borrowerRating: true,
              },
            },
          },
        })

        if (!user) {
          throw new Error("User not found")
        }

        return user
      }),

    /**
     * Fetch user's listings (items)
     */
    listings: adminProcedure
      .input(
        z.object({
          userId: z.string().uuid(),
          skip: z.number().int().nonnegative().default(0),
          take: z.number().int().positive().max(50).default(10),
        }),
      )
      .query(async ({ ctx, input }) => {
        const [items, totalCount] = await Promise.all([
          ctx.prisma.item.findMany({
            where: { lenderId: input.userId },
            select: {
              id: true,
              name: true,
              status: true,
              condition: true,
              rentalFee: true,
              rating: true,
              bookingCount: true,
              viewCount: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            skip: input.skip,
            take: input.take,
          }),
          ctx.prisma.item.count({ where: { lenderId: input.userId } }),
        ])

        return { items, totalCount }
      }),

    /**
     * Fetch user's transactions
     */
    transactions: adminProcedure
      .input(
        z.object({
          userId: z.string().uuid(),
          skip: z.number().int().nonnegative().default(0),
          take: z.number().int().positive().max(50).default(10),
        }),
      )
      .query(async ({ ctx, input }) => {
        const [transactions, totalCount] = await Promise.all([
          ctx.prisma.rentalTransaction.findMany({
            where: {
              OR: [{ borrowerId: input.userId }, { lenderId: input.userId }],
            },
            select: {
              id: true,
              createdAt: true,
              status: true,
              borrowerId: true,
              lenderId: true,
              totalAmount: true,
              item: {
                select: {
                  name: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
            skip: input.skip,
            take: input.take,
          }),
          ctx.prisma.rentalTransaction.count({
            where: {
              OR: [{ borrowerId: input.userId }, { lenderId: input.userId }],
            },
          }),
        ])

        return { transactions, totalCount }
      }),

    /**
     * Fetch user's disputes
     */
    disputes: adminProcedure
      .input(
        z.object({
          userId: z.string().uuid(),
          skip: z.number().int().nonnegative().default(0),
          take: z.number().int().positive().max(50).default(10),
        }),
      )
      .query(async ({ ctx, input }) => {
        const [disputes, totalCount] = await Promise.all([
          ctx.prisma.transactionDispute.findMany({
            where: {
              OR: [
                { raisedById: input.userId },
                { transaction: { borrowerId: input.userId } },
                { transaction: { lenderId: input.userId } },
              ],
            },
            select: {
              id: true,
              createdAt: true,
              status: true,
              reason: true,
              claimedAmount: true,
              raisedBy: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
              transaction: {
                select: {
                  id: true,
                  borrowerId: true,
                  lenderId: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
            skip: input.skip,
            take: input.take,
          }),
          ctx.prisma.transactionDispute.count({
            where: {
              OR: [
                { raisedById: input.userId },
                { transaction: { borrowerId: input.userId } },
                { transaction: { lenderId: input.userId } },
              ],
            },
          }),
        ])

        return { disputes, totalCount }
      }),
  }),

  listings: t.router({
    list: adminProcedure.input(listAdminListingsSchema).query(async ({ ctx, input }) => {
      const { statuses, categories, search, limit, cursor } = input
      const cursorSql = cursor
        ? Prisma.sql`
            AND (
              i."createdAt" < ${cursor.createdAt}
              OR (i."createdAt" = ${cursor.createdAt} AND i."id" < ${cursor.id})
            )
          `
        : Prisma.empty

      const [summary, records] = await Promise.all([
        buildAdminListingsSummary(ctx.prisma),
        ctx.prisma.$queryRaw<
          Array<{
            id: string
            numericId: number
            name: string
            status: string
            adminModerationState: "DEACTIVATED" | "REMOVED" | null
            adminModeratedAt: Date | null
            createdAt: Date
            rating: number
            lenderId: string
            ownerId: string
            ownerUsername: string
            ownerEmail: string
            ownerFirstName: string
            ownerLastName: string
            category: string | null
            hasActiveTransactions: boolean
          }>
        >(Prisma.sql`
          SELECT
            i."id" AS "id",
            i."numericId" AS "numericId",
            i."name" AS "name",
            i."status"::text AS "status",
            i."adminModerationState"::text AS "adminModerationState",
            i."adminModeratedAt" AS "adminModeratedAt",
            i."createdAt" AS "createdAt",
            i."rating" AS "rating",
            i."lenderId" AS "lenderId",
            u."id" AS "ownerId",
            u."username" AS "ownerUsername",
            u."email" AS "ownerEmail",
            u."firstName" AS "ownerFirstName",
            u."lastName" AS "ownerLastName",
            (
              SELECT cat."category"::text
              FROM "ItemCategoryOnItem" cat
              WHERE cat."itemId" = i."id"
              ORDER BY cat."createdAt" ASC
              LIMIT 1
            ) AS "category",
            EXISTS (
              SELECT 1
              FROM "transactions" tx
              WHERE tx."item_id" = i."id"
                AND ${getActiveListingTransactionWhere()}
            ) AS "hasActiveTransactions"
          FROM "Item" i
          INNER JOIN "Lender" lender ON lender."userId" = i."lenderId"
          INNER JOIN "User" u ON u."id" = lender."userId"
          WHERE ${ADMIN_LISTING_BASE_SQL}
            AND ${buildAdminListingStatusSql(statuses)}
            AND ${buildAdminListingCategorySql(categories)}
            AND ${buildAdminListingSearchSql(search)}
            ${cursorSql}
          ORDER BY i."createdAt" DESC, i."id" DESC
          LIMIT ${limit + 1}
        `),
      ])

      const hasMore = records.length > limit
      const pageRecords = hasMore ? records.slice(0, limit) : records
      const lastRecord = pageRecords.at(-1)

      return {
        summary,
        listings: pageRecords.map((item) => {
          const ownerName = [item.ownerFirstName, item.ownerLastName]
            .filter(Boolean)
            .join(" ")
            .trim()
          const viewStatus = getAdminListingViewStatus({
            status: item.status,
            adminModerationState: item.adminModerationState,
          })

          return {
            id: item.id,
            numericId: item.numericId,
            name: item.name,
            category: item.category ?? "OTHER",
            owner: {
              id: item.ownerId,
              name: ownerName || item.ownerUsername,
              username: item.ownerUsername,
              email: item.ownerEmail,
            },
            status: viewStatus,
            statusLabel: getAdminListingStatusLabel(viewStatus),
            rating: item.rating,
            createdAt: item.createdAt,
            hasActiveTransactions: item.hasActiveTransactions,
            rawStatus: item.status,
            adminModeratedAt: item.adminModeratedAt,
          }
        }),
        nextCursor:
          hasMore && lastRecord ? { id: lastRecord.id, createdAt: lastRecord.createdAt } : null,
      }
    }),

    deactivate: adminProcedure
      .input(moderateAdminListingSchema)
      .mutation(async ({ ctx, input }) => {
        const itemRows = await ctx.prisma.$queryRaw<
          Array<{
            id: string
            numericId: number
            name: string
            lenderId: string
            adminModerationState: "DEACTIVATED" | "REMOVED" | null
            hasActiveTransactions: boolean
          }>
        >(Prisma.sql`
        SELECT
          i."id" AS "id",
          i."numericId" AS "numericId",
          i."name" AS "name",
          i."lenderId" AS "lenderId",
          i."adminModerationState"::text AS "adminModerationState",
          EXISTS (
            SELECT 1
            FROM "transactions" tx
            WHERE tx."item_id" = i."id"
              AND ${getActiveListingTransactionWhere()}
          ) AS "hasActiveTransactions"
        FROM "Item" i
        WHERE i."id" = ${input.id}
        LIMIT 1
      `)
        const item = itemRows[0]

        if (!item) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found." })
        }

        if (item.adminModerationState === "REMOVED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Removed listings cannot be deactivated.",
          })
        }

        await ctx.prisma.$executeRaw(Prisma.sql`
        UPDATE "Item"
        SET
          "status" = 'DEACTIVATED',
          "adminModerationState" = 'DEACTIVATED',
          "adminModeratedById" = ${ctx.user.id},
          "adminModeratedAt" = NOW()
        WHERE "id" = ${item.id}
      `)

        await createAdminActionLog(ctx.prisma, {
          adminId: ctx.user.id,
          actionType: ADMIN_ACTION_TYPES.DEACTIVATE_LISTING,
          targetType: ADMIN_ACTION_TARGET_TYPES.LISTING,
          targetId: item.id,
          targetLabel: item.name,
          itemId: item.id,
          description: `Deactivated listing #${item.numericId}`,
          metadata: {
            listingId: item.id,
            listingNumericId: item.numericId,
            ownerUserId: item.lenderId,
            hadActiveTransactions: item.hasActiveTransactions,
          },
        })

        return {
          id: item.id,
          status: "DEACTIVATED",
          adminModerationState: "DEACTIVATED",
          adminModeratedAt: new Date(),
        }
      }),

    activate: adminProcedure.input(moderateAdminListingSchema).mutation(async ({ ctx, input }) => {
      const itemRows = await ctx.prisma.$queryRaw<
        Array<{
          id: string
          numericId: number
          name: string
          lenderId: string
          adminModerationState: "DEACTIVATED" | "REMOVED" | null
        }>
      >(Prisma.sql`
        SELECT
          i."id" AS "id",
          i."numericId" AS "numericId",
          i."name" AS "name",
          i."lenderId" AS "lenderId",
          i."adminModerationState"::text AS "adminModerationState"
        FROM "Item" i
        WHERE i."id" = ${input.id}
        LIMIT 1
      `)
      const item = itemRows[0]

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found." })
      }

      if (item.adminModerationState === "REMOVED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Removed listings cannot be reactivated.",
        })
      }

      await ctx.prisma.$executeRaw(Prisma.sql`
        UPDATE "Item"
        SET
          "status" = 'AVAILABLE',
          "adminModerationState" = NULL,
          "adminModeratedById" = NULL,
          "adminModeratedAt" = NULL
        WHERE "id" = ${item.id}
      `)

      await createAdminActionLog(ctx.prisma, {
        adminId: ctx.user.id,
        actionType: ADMIN_ACTION_TYPES.ACTIVATE_LISTING,
        targetType: ADMIN_ACTION_TARGET_TYPES.LISTING,
        targetId: item.id,
        targetLabel: item.name,
        itemId: item.id,
        description: `Reactivated listing #${item.numericId}`,
        metadata: {
          listingId: item.id,
          listingNumericId: item.numericId,
          ownerUserId: item.lenderId,
        },
      })

      return {
        id: item.id,
        status: "AVAILABLE",
        adminModerationState: null,
        adminModeratedAt: null,
      }
    }),

    remove: adminProcedure.input(moderateAdminListingSchema).mutation(async ({ ctx, input }) => {
      const itemRows = await ctx.prisma.$queryRaw<
        Array<{
          id: string
          numericId: number
          name: string
          lenderId: string
          hasActiveTransactions: boolean
        }>
      >(Prisma.sql`
        SELECT
          i."id" AS "id",
          i."numericId" AS "numericId",
          i."name" AS "name",
          i."lenderId" AS "lenderId",
          EXISTS (
            SELECT 1
            FROM "transactions" tx
            WHERE tx."item_id" = i."id"
              AND ${getActiveListingTransactionWhere()}
          ) AS "hasActiveTransactions"
        FROM "Item" i
        WHERE i."id" = ${input.id}
        LIMIT 1
      `)
      const item = itemRows[0]

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found." })
      }

      if (item.hasActiveTransactions) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This listing cannot be removed because it has active or upcoming transactions.",
        })
      }

      await ctx.prisma.$executeRaw(Prisma.sql`
        UPDATE "Item"
        SET
          "status" = 'DELETED',
          "adminModerationState" = 'REMOVED',
          "adminModeratedById" = ${ctx.user.id},
          "adminModeratedAt" = NOW()
        WHERE "id" = ${item.id}
      `)

      await createAdminActionLog(ctx.prisma, {
        adminId: ctx.user.id,
        actionType: ADMIN_ACTION_TYPES.REMOVE_LISTING,
        targetType: ADMIN_ACTION_TARGET_TYPES.LISTING,
        targetId: item.id,
        targetLabel: item.name,
        itemId: item.id,
        description: `Removed listing #${item.numericId}`,
        metadata: {
          listingId: item.id,
          listingNumericId: item.numericId,
          ownerUserId: item.lenderId,
        },
      })

      return {
        id: item.id,
        status: "DELETED",
        adminModerationState: "REMOVED",
        adminModeratedAt: new Date(),
      }
    }),
  }),

  logs: t.router({
    list: adminProcedure.input(listAdminActionLogsSchema).query(async ({ ctx, input }) => {
      const { targetType, search, limit, cursor } = input
      const trimmedSearch = search?.trim()
      const like = trimmedSearch ? `%${trimmedSearch}%` : null
      const cursorSql = cursor
        ? Prisma.sql`
            AND (
              l."created_at" < ${cursor.createdAt}
              OR (l."created_at" = ${cursor.createdAt} AND l."id" < ${cursor.id})
            )
          `
        : Prisma.empty

      const records = await ctx.prisma.$queryRaw<
        Array<{
          id: string
          actionType: string
          targetType: string
          targetId: string
          targetLabel: string | null
          description: string | null
          metadata: Record<string, unknown>
          createdAt: Date
          adminId: string
          adminUsername: string
          adminEmail: string
          adminFirstName: string
          adminLastName: string
        }>
      >(Prisma.sql`
        SELECT
          l."id" AS "id",
          l."action_type" AS "actionType",
          l."target_type" AS "targetType",
          l."target_id" AS "targetId",
          l."target_label" AS "targetLabel",
          l."description" AS "description",
          l."metadata" AS "metadata",
          l."created_at" AS "createdAt",
          u."id" AS "adminId",
          u."username" AS "adminUsername",
          u."email" AS "adminEmail",
          u."firstName" AS "adminFirstName",
          u."lastName" AS "adminLastName"
        FROM "admin_action_logs" l
        INNER JOIN "User" u ON u."id" = l."admin_user_id"
        WHERE (${targetType ? Prisma.sql`l."target_type" = ${targetType}` : Prisma.sql`TRUE`})
          AND (${
            like
              ? Prisma.sql`
                  l."action_type" ILIKE ${like}
                  OR l."target_id" ILIKE ${like}
                  OR COALESCE(l."target_label", '') ILIKE ${like}
                  OR u."firstName" ILIKE ${like}
                  OR u."lastName" ILIKE ${like}
                  OR u."username" ILIKE ${like}
                  OR u."email" ILIKE ${like}
                `
              : Prisma.sql`TRUE`
          })
          ${cursorSql}
        ORDER BY l."created_at" DESC, l."id" DESC
        LIMIT ${limit + 1}
      `)

      const hasMore = records.length > limit
      const pageRecords = hasMore ? records.slice(0, limit) : records
      const lastRecord = pageRecords.at(-1)

      return {
        logs: pageRecords.map((record) => ({
          id: record.id,
          actionType: record.actionType,
          targetType: record.targetType,
          targetId: record.targetId,
          targetLabel: record.targetLabel,
          description: record.description,
          metadata: record.metadata,
          createdAt: record.createdAt,
          admin: {
            id: record.adminId,
            name: [record.adminFirstName, record.adminLastName].filter(Boolean).join(" "),
            username: record.adminUsername,
            email: record.adminEmail,
          },
        })),
        nextCursor:
          hasMore && lastRecord ? { id: lastRecord.id, createdAt: lastRecord.createdAt } : null,
      }
    }),
  }),

  actions: t.router({
    /**
     * Ban a user (prevent login and transactions)
     */
    banUser: adminProcedure
      .input(
        z.object({
          userId: z.string().uuid(),
          reason: z.string().min(1, "Reason is required"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const currentUser = ctx.user
        if (!currentUser) throw new Error("Not authenticated")

        // Prevent self-demotion/ban
        if (currentUser.id === input.userId) {
          throw new Error("You cannot ban yourself")
        }

        // Update user status
        const updated = await ctx.prisma.user.update({
          where: { id: input.userId },
          data: { status: "BANNED" },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        })

        // Log the action
        await createAdminActionLog(ctx.prisma, {
          adminId: currentUser.id,
          actionType: ADMIN_ACTION_TYPES.BAN_USER,
          targetType: ADMIN_ACTION_TARGET_TYPES.USER,
          targetId: input.userId,
          targetLabel: `${updated.firstName} ${updated.lastName}`,
          description: input.reason,
          metadata: { email: updated.email, name: `${updated.firstName} ${updated.lastName}` },
        })

        return updated
      }),

    /**
     * Unban a user
     */
    unbanUser: adminProcedure
      .input(z.object({ userId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const currentUser = ctx.user
        if (!currentUser) throw new Error("Not authenticated")

        const updated = await ctx.prisma.user.update({
          where: { id: input.userId },
          data: { status: "ACTIVE" },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        })

        // Log the action
        await createAdminActionLog(ctx.prisma, {
          adminId: currentUser.id,
          actionType: ADMIN_ACTION_TYPES.UNBAN_USER,
          targetType: ADMIN_ACTION_TARGET_TYPES.USER,
          targetId: input.userId,
          targetLabel: `${updated.firstName} ${updated.lastName}`,
          description: "User unbanned by admin",
          metadata: { email: updated.email, name: `${updated.firstName} ${updated.lastName}` },
        })

        return updated
      }),

    /**
     * Delete a user (with safeguards)
     */
    deleteUser: adminProcedure
      .input(
        z.object({
          userId: z.string().uuid(),
          reason: z.string().min(1, "Reason is required"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const currentUser = ctx.user
        if (!currentUser) throw new Error("Not authenticated")

        // Prevent self-deletion
        if (currentUser.id === input.userId) {
          throw new Error("You cannot delete yourself")
        }

        // Check for active transactions
        const activeTransactions = await ctx.prisma.rentalTransaction.count({
          where: {
            OR: [
              {
                AND: [
                  { borrowerId: input.userId },
                  {
                    status: {
                      in: [...NON_TERMINAL_TRANSACTION_STATUSES],
                    },
                  },
                ],
              },
              {
                AND: [
                  { lenderId: input.userId },
                  {
                    status: {
                      in: [...NON_TERMINAL_TRANSACTION_STATUSES],
                    },
                  },
                ],
              },
            ],
          },
        })

        if (activeTransactions > 0) {
          throw new Error(
            `Cannot delete user with ${activeTransactions} active transaction(s). Resolve all disputes and transactions first.`,
          )
        }

        // Check for open disputes
        const openDisputes = await ctx.prisma.transactionDispute.count({
          where: {
            OR: [
              { raisedById: input.userId },
              { transaction: { borrowerId: input.userId } },
              { transaction: { lenderId: input.userId } },
            ],
            status: {
              in: ["SUBMITTED", "OPEN", "APPEALED"],
            },
          },
        })

        if (openDisputes > 0) {
          throw new Error(
            `Cannot delete user with ${openDisputes} open dispute(s). Resolve all disputes first.`,
          )
        }

        const userDetails = await ctx.prisma.user.findUnique({
          where: { id: input.userId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        })

        // Delete user and related data (cascading)
        await ctx.prisma.user.delete({
          where: { id: input.userId },
        })

        // Log the action
        await createAdminActionLog(ctx.prisma, {
          adminId: currentUser.id,
          actionType: ADMIN_ACTION_TYPES.DELETE_USER,
          targetType: ADMIN_ACTION_TARGET_TYPES.USER,
          targetId: input.userId,
          targetLabel: userDetails ? `${userDetails.firstName} ${userDetails.lastName}` : "Unknown",
          description: input.reason,
          metadata: {
            email: userDetails?.email ?? "unknown",
            name: userDetails ? `${userDetails.firstName} ${userDetails.lastName}` : "Unknown",
          },
        })

        return { success: true, userId: input.userId }
      }),

    /**
     * Assign admin role to user
     */
    assignAdminRole: adminProcedure
      .input(
        z.object({
          userId: z.string().uuid(),
          role: z.string().default("MODERATOR"),
          accessLevel: z.number().int().min(1).max(10).default(5),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const currentUser = ctx.user
        if (!currentUser) throw new Error("Not authenticated")

        // Update account type
        const userUpdated = await ctx.prisma.user.update({
          where: { id: input.userId },
          data: { accountType: "ADMIN" },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        })

        // Create or update admin record
        await ctx.prisma.admin.upsert({
          where: { userId: input.userId },
          update: {
            role: input.role,
            accessLevel: input.accessLevel,
          },
          create: {
            userId: input.userId,
            role: input.role,
            accessLevel: input.accessLevel,
          },
        })

        // Log the action
        await createAdminActionLog(ctx.prisma, {
          adminId: currentUser.id,
          actionType: ADMIN_ACTION_TYPES.ASSIGN_ADMIN_ROLE,
          targetType: ADMIN_ACTION_TARGET_TYPES.USER,
          targetId: input.userId,
          targetLabel: `${userUpdated.firstName} ${userUpdated.lastName}`,
          description: `Assigned admin role: ${input.role}`,
          metadata: {
            email: userUpdated.email,
            name: `${userUpdated.firstName} ${userUpdated.lastName}`,
            role: input.role,
            accessLevel: input.accessLevel,
          },
        })

        return userUpdated
      }),

    /**
     * Revoke admin role from user
     */
    revokeAdminRole: adminProcedure
      .input(z.object({ userId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const currentUser = ctx.user
        if (!currentUser) throw new Error("Not authenticated")

        // Prevent self-demotion
        if (currentUser.id === input.userId) {
          throw new Error("You cannot revoke your own admin access")
        }

        const userDetails = await ctx.prisma.user.findUnique({
          where: { id: input.userId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            borrower: {
              select: { id: true },
            },
            lender: {
              select: { id: true },
            },
          },
        })

        if (!userDetails) {
          throw new Error("User not found")
        }

        // Determine default role
        let defaultAccountType: "LENDER" | "BORROWER" = "BORROWER"
        if (userDetails.lender) {
          defaultAccountType = "LENDER"
        }

        // Update account type back to default
        const userUpdated = await ctx.prisma.user.update({
          where: { id: input.userId },
          data: { accountType: defaultAccountType },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        })

        // Delete admin record
        await ctx.prisma.admin.delete({
          where: { userId: input.userId },
        })

        // Log the action
        await createAdminActionLog(ctx.prisma, {
          adminId: currentUser.id,
          actionType: ADMIN_ACTION_TYPES.REVOKE_ADMIN_ROLE,
          targetType: ADMIN_ACTION_TARGET_TYPES.USER,
          targetId: input.userId,
          targetLabel: `${userUpdated.firstName} ${userUpdated.lastName}`,
          description: "Admin role revoked",
          metadata: {
            email: userUpdated.email,
            name: `${userUpdated.firstName} ${userUpdated.lastName}`,
          },
        })

        return userUpdated
      }),
  }),
})
