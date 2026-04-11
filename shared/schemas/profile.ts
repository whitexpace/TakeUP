import { z } from "zod"

const usernameRegex = /^(?=.{3,30}$)[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/

export const usernameAvailabilityQuerySchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      usernameRegex,
      "Username must be 3-30 characters using lowercase letters, numbers, periods, or underscores.",
    ),
})

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80, "Name is too long."),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      usernameRegex,
      "Username must be 3-30 characters using lowercase letters, numbers, periods, or underscores.",
    ),
  location: z
    .string()
    .trim()
    .max(120, "Location is too long.")
    .transform((value) => value || null),
  pronouns: z
    .string()
    .trim()
    .max(40, "Pronouns are too long.")
    .transform((value) => value || null),
  bio: z
    .string()
    .trim()
    .max(200, "Bio is too long.")
    .transform((value) => value || null),
  avatarUrl: z
    .string()
    .trim()
    .url("Avatar URL must be a valid URL.")
    .max(500, "Avatar URL is too long.")
    .nullable(),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
