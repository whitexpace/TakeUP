import { createError, readBody } from "h3"
import { z } from "zod"
import { removeItemImagesFromStorage, extractStoragePathFromPublicUrl } from "../../utils/item-image-storage"

const cleanupItemImagesSchema = z.object({
  urls: z.array(z.string().url()).max(20),
})

export default defineEventHandler(async (event) => {
  const user = event.context.authUser
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized." })
  }

  const body = await readBody(event)
  const result = cleanupItemImagesSchema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid cleanup request." })
  }

  const runtimeConfig = useRuntimeConfig(event)
  const bucket = runtimeConfig.public.itemImageBucket
  const allowedPrefix = `items/${user.id}/`
  const ownedUrls = result.data.urls.filter((imageUrl) => {
    const path = extractStoragePathFromPublicUrl(imageUrl, bucket)
    return path?.startsWith(allowedPrefix)
  })

  const deletedResult = await removeItemImagesFromStorage(ownedUrls, {
    bucket,
    supabaseUrl: runtimeConfig.public.supabase.url,
    serviceRoleKey: runtimeConfig.supabaseServiceRoleKey,
  })

  return {
    deleted: deletedResult.deleted,
    skipped: result.data.urls.filter((imageUrl) => !ownedUrls.includes(imageUrl)),
  }
})
