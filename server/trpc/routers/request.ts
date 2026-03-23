import { router } from "../init"
import { publicProcedure } from "../procedures"

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

const mapRequestPost = (post: RequestPostRow) => ({
  id: post.id,
  itemNeeded: post.itemNeeded,
  description: post.description,
  requestedFrom: post.requestedFrom,
  requestedTo: post.requestedTo,
  minTargetPrice: post.minTargetPrice,
  maxTargetPrice: post.maxTargetPrice,
  createdAt: post.createdAt,
  requester: {
    id: post.requesterId,
    username: post.requesterUsername,
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
      posts: posts.map(mapRequestPost),
    }
  }),
})
