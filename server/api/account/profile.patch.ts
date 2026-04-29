import { Prisma } from "@prisma/client"
import { createError, readBody } from "h3"
import { updateProfileSchema } from "../../../shared/schemas/profile"
import { createContext } from "../../trpc/context"

const splitFullName = (
  fullName: string,
  currentLastName: string,
  currentMiddleName: string | null,
) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  const [firstPart] = parts

  if (!firstPart) {
    return {
      firstName: "",
      middleName: currentMiddleName,
      lastName: currentLastName,
    }
  }

  if (parts.length === 1) {
    return {
      firstName: firstPart,
      middleName: null,
      lastName: currentLastName,
    }
  }

  const firstName = parts.shift() ?? firstPart
  const lastName = parts.pop() ?? currentLastName
  const middleName = parts.length > 0 ? parts.join(" ") : null

  return { firstName, middleName, lastName }
}

export default defineEventHandler(async (event) => {
  const ctx = await createContext(event)

  if (!ctx.user) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized.",
    })
  }

  const body = await readBody(event)
  const result = updateProfileSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid input.",
      data: result.error.flatten(),
    })
  }

  const profileRows = await ctx.prisma.$queryRaw<
    Array<{
      id: string
      username: string
      firstName: string
      middleName: string | null
      lastName: string
    }>
  >(Prisma.sql`
    SELECT "id", "username", "firstName", "middleName", "lastName"
    FROM "User"
    WHERE "id" = ${ctx.user.id}
    LIMIT 1
  `)

  const currentProfile = profileRows[0]
  if (!currentProfile) {
    throw createError({
      statusCode: 404,
      statusMessage: "User profile not found.",
    })
  }

  const usernameConflictRows = await ctx.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "User"
    WHERE LOWER("username") = LOWER(${result.data.username})
      AND "id" <> ${ctx.user.id}
    LIMIT 1
  `)

  if (usernameConflictRows.length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: "Username is already taken.",
    })
  }

  const { firstName, middleName, lastName } = splitFullName(
    result.data.name,
    currentProfile.lastName,
    currentProfile.middleName,
  )

  await ctx.prisma.$executeRaw(Prisma.sql`
    UPDATE "User"
    SET
      "username" = ${result.data.username},
      "firstName" = ${firstName},
      "middleName" = ${middleName},
      "lastName" = ${lastName},
      "location" = ${result.data.location},
      "pronouns" = ${result.data.pronouns},
      "bio" = ${result.data.bio},
      "avatarUrl" = ${result.data.avatarUrl}
    WHERE "id" = ${ctx.user.id}
  `)

  const updatedRows = await ctx.prisma.$queryRaw<
    Array<{
      username: string
      firstName: string
      middleName: string | null
      lastName: string
      location: string | null
      pronouns: string | null
      bio: string | null
      avatarUrl: string | null
    }>
  >(Prisma.sql`
    SELECT
      "username",
      "firstName",
      "middleName",
      "lastName",
      "location",
      "pronouns",
      "bio",
      "avatarUrl"
    FROM "User"
    WHERE "id" = ${ctx.user.id}
    LIMIT 1
  `)

  const updatedProfile = updatedRows[0]

  return {
    user: {
      id: ctx.user.id,
      username: updatedProfile?.username ?? result.data.username,
      firstName: updatedProfile?.firstName ?? firstName,
      middleName: updatedProfile?.middleName ?? middleName,
      lastName: updatedProfile?.lastName ?? lastName,
      location: updatedProfile?.location ?? result.data.location,
      pronouns: updatedProfile?.pronouns ?? result.data.pronouns,
      bio: updatedProfile?.bio ?? result.data.bio,
      avatarUrl: updatedProfile?.avatarUrl ?? result.data.avatarUrl,
    },
  }
})
