import { TRPCError } from "@trpc/server"
import { createRequestSchema } from "../../../shared/schemas/request"
import { router } from "../init"
import { protectedProcedure, publicProcedure } from "../procedures"

type RequestPostRow = {
  id: string
  itemNeeded: string
  description: string
  requestedFrom: Date
  requestedTo: Date
  minTargetPrice: number
  maxTargetPrice: number
  createdAt: Date
  requesterId: string
  requesterUsername: string
}

const mapRequestPost = (post: RequestPostRow, showRequesterIdentity: boolean) => ({
  id: post.id,
  itemNeeded: post.itemNeeded,
  description: post.description,
  requestedFrom: post.requestedFrom,
  requestedTo: post.requestedTo,
  minTargetPrice: post.minTargetPrice,
  maxTargetPrice: post.maxTargetPrice,
  createdAt: post.createdAt,
  requester: {
    id: showRequesterIdentity ? post.requesterId : null,
    username: showRequesterIdentity ? post.requesterUsername : null,
  },
})

export const requestRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const posts = await ctx.prisma.$queryRaw<RequestPostRow[]>`
      SELECT
        rp.id,
        rp."itemNeeded",
        rp.description,
        rp."requestedFrom",
        rp."requestedTo",
        rp."minTargetPrice",
        rp."maxTargetPrice",
        rp."createdAt",
        u.id AS "requesterId",
        u.username AS "requesterUsername"
      FROM "RequestPost" rp
      INNER JOIN "User" u ON u.id = rp."requesterId"
      WHERE rp."requestedTo" >= NOW()
      ORDER BY rp."createdAt" DESC, rp.id DESC
    `

    return {
      posts: posts.map((post) => mapRequestPost(post, Boolean(ctx.user))),
    }
  }),

  create: protectedProcedure.input(createRequestSchema).mutation(async ({ ctx, input }) => {
    const existingUser = await ctx.prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        id: true,
        username: true,
        accountType: true,
      },
    })

    if (!existingUser) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Your account is missing from the database. Sign out and sign in again before posting a request.",
      })
    }

    if (existingUser.accountType !== "BORROWER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only borrower accounts can post requests.",
      })
    }

    const post = await ctx.prisma.requestPost.create({
      data: {
        requesterId: ctx.user.id,
        itemNeeded: input.itemNeeded,
        description: input.description,
        requestedFrom: input.requestedFrom,
        requestedTo: input.requestedTo,
        minTargetPrice: input.minTargetPrice,
        maxTargetPrice: input.maxTargetPrice,
      },
      select: {
        id: true,
        itemNeeded: true,
        description: true,
        requestedFrom: true,
        requestedTo: true,
        minTargetPrice: true,
        maxTargetPrice: true,
        createdAt: true,
      },
    })

    return mapRequestPost(
      {
        ...post,
        requesterId: existingUser.id,
        requesterUsername: existingUser.username,
      },
      true,
    )
  }),
})
