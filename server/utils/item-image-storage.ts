type RemoveItemImagesOptions = {
  bucket: string
  supabaseUrl: string
  serviceRoleKey?: string
}

const STORAGE_PUBLIC_SEGMENT = "/storage/v1/object/public/"
const STORAGE_UPLOAD_PREFIXES = ["items/", "reviews/", "request-references/"] as const

const encodeStoragePath = (path: string) => path.split("/").map(encodeURIComponent).join("/")

export const extractStoragePathFromPublicUrl = (
  imageUrl: string,
  bucket: string,
): string | null => {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(imageUrl)
  } catch {
    return null
  }

  const publicPrefix = `${STORAGE_PUBLIC_SEGMENT}${bucket}/`
  const publicIndex = parsedUrl.pathname.indexOf(publicPrefix)
  if (publicIndex === -1) {
    return null
  }

  const encodedPath = parsedUrl.pathname.slice(publicIndex + publicPrefix.length)
  if (!encodedPath) {
    return null
  }

  try {
    const path = encodedPath
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/")

    return STORAGE_UPLOAD_PREFIXES.some((prefix) => path.startsWith(prefix)) ? path : null
  } catch {
    return null
  }
}

export const removeItemImagesFromStorage = async (
  imageUrls: string[],
  options: RemoveItemImagesOptions,
) => {
  const { bucket, supabaseUrl, serviceRoleKey } = options
  if (!serviceRoleKey || imageUrls.length === 0) {
    return { deleted: [] as string[], skipped: [...imageUrls] }
  }

  const uniqueImageUrls = [...new Set(imageUrls)]
  const pathsToDelete = uniqueImageUrls
    .map((imageUrl) => ({
      imageUrl,
      path: extractStoragePathFromPublicUrl(imageUrl, bucket),
    }))
    .filter((entry): entry is { imageUrl: string; path: string } => entry.path !== null)

  const deleted: string[] = []
  const skipped = uniqueImageUrls.filter(
    (imageUrl) => !pathsToDelete.some((entry) => entry.imageUrl === imageUrl),
  )

  await Promise.allSettled(
    pathsToDelete.map(async ({ imageUrl, path }) => {
      await $fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${encodeStoragePath(path)}`, {
        method: "DELETE",
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
        },
      })
      deleted.push(imageUrl)
    }),
  )

  return { deleted, skipped }
}
