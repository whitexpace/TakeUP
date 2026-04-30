import { z } from "zod"
import { adminProcedure } from "../procedures"
import { t } from "../init"
import type { Prisma } from "@prisma/client"

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
        await logAdminAction(ctx.prisma, {
          adminId: currentUser.id,
          action: "BAN_USER",
          targetUserId: input.userId,
          reason: input.reason,
          details: { email: updated.email, name: `${updated.firstName} ${updated.lastName}` },
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
        await logAdminAction(ctx.prisma, {
          adminId: currentUser.id,
          action: "UNBAN_USER",
          targetUserId: input.userId,
          reason: "User unbanned by admin",
          details: { email: updated.email, name: `${updated.firstName} ${updated.lastName}` },
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
                      in: ["PENDING", "CONFIRMED", "PAID", "ONGOING", "IN_DISPUTE", "APPEALED"],
                    },
                  },
                ],
              },
              {
                AND: [
                  { lenderId: input.userId },
                  {
                    status: {
                      in: ["PENDING", "CONFIRMED", "PAID", "ONGOING", "IN_DISPUTE", "APPEALED"],
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
        await logAdminAction(ctx.prisma, {
          adminId: currentUser.id,
          action: "DELETE_USER",
          targetUserId: input.userId,
          reason: input.reason,
          details: {
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
        await logAdminAction(ctx.prisma, {
          adminId: currentUser.id,
          action: "ASSIGN_ADMIN_ROLE",
          targetUserId: input.userId,
          reason: `Assigned admin role: ${input.role}`,
          details: {
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
        await logAdminAction(ctx.prisma, {
          adminId: currentUser.id,
          action: "REVOKE_ADMIN_ROLE",
          targetUserId: input.userId,
          reason: "Admin role revoked",
          details: {
            email: userUpdated.email,
            name: `${userUpdated.firstName} ${userUpdated.lastName}`,
          },
        })

        return userUpdated
      }),
  }),
})

/**
 * Helper function to log admin actions
 */
function logAdminAction(
  _prismaClient: unknown,
  {
    adminId,
    action,
    targetUserId,
    reason,
    details,
  }: {
    adminId: string
    action: string
    targetUserId: string
    reason: string
    details: Record<string, string | number | boolean>
  },
) {
  // For now, we'll just log to console
  // In a real app, you might want to store this in a separate AdminLog table
  console.warn(`[ADMIN ACTION] ${action}`, {
    adminId,
    targetUserId,
    reason,
    details,
    timestamp: new Date().toISOString(),
  })
}
