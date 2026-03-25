import { createContext } from "../../trpc/context"

export default defineEventHandler(async (event) => {
  const ctx = await createContext(event)

  if (!ctx.user) {
    return []
  }

  const categories = await ctx.prisma.itemCategoryOnItem.findMany({
    where: {
      item: {
        status: { not: "DELETED" },
        likes: {
          some: {
            userId: ctx.user.id,
          },
        },
      },
    },
    distinct: ["category"],
    select: {
      category: true,
    },
    orderBy: {
      category: "asc",
    },
  })

  return categories.map((entry) => entry.category)
})
