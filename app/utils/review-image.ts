const encodeStoragePath = (path: string) => path.split("/").map(encodeURIComponent).join("/")

export const normalizeReviewImageUrl = (
  image: string,
  options: {
    supabaseUrl?: string | null
    bucket: string
  },
) => {
  const trimmedImage = image.trim()
  if (!trimmedImage) return ""

  if (/^https?:\/\//i.test(trimmedImage)) {
    return trimmedImage
  }

  const normalizedSupabaseUrl = options.supabaseUrl?.replace(/\/$/, "") ?? ""
  if (trimmedImage.startsWith("/storage/v1/object/public/")) {
    return normalizedSupabaseUrl ? `${normalizedSupabaseUrl}${trimmedImage}` : trimmedImage
  }

  const normalizedPath = trimmedImage.replace(/^\/+/, "")
  if (!normalizedSupabaseUrl) {
    return normalizedPath
  }

  return `${normalizedSupabaseUrl}/storage/v1/object/public/${options.bucket}/${encodeStoragePath(normalizedPath)}`
}
