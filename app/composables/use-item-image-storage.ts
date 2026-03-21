import type { ListingFormSubmitData } from "../types/listing-form"

const getFileExtension = (file: File) => {
  const nameParts = file.name.split(".")
  const fromName = nameParts.length > 1 ? nameParts[nameParts.length - 1]?.toLowerCase() : ""
  if (fromName) return fromName

  const fromType = file.type.split("/")[1]?.toLowerCase()
  return fromType || "jpg"
}

export const useItemImageStorage = () => {
  const supabase = useSupabaseClient()
  const runtimeConfig = useRuntimeConfig()
  const bucket = runtimeConfig.public.itemImagesBucket as string

  const uploadAndResolvePaths = async (params: {
    itemId: string
    userId: string
    media: ListingFormSubmitData["media"]
  }) => {
    const { itemId, userId, media } = params

    const orderedPaths: string[] = []
    const resolvedPathByEntryId = new Map<string, string>()

    for (const entry of media.entries) {
      if (entry.type === "existing") {
        orderedPaths.push(entry.path)
        resolvedPathByEntryId.set(entry.id, entry.path)
        continue
      }

      const isCover = media.coverEntryId === entry.id
      const variant = isCover ? "cover" : "gallery"
      const ext = getFileExtension(entry.file)
      const filename = `${crypto.randomUUID()}.${ext}`
      const storagePath = `items/${userId}/${itemId}/${variant}/${filename}`

      const { error } = await supabase.storage.from(bucket).upload(storagePath, entry.file, {
        contentType: entry.file.type || undefined,
        upsert: false,
      })

      if (error) {
        throw new Error(`Failed to upload image: ${error.message}`)
      }

      orderedPaths.push(storagePath)
      resolvedPathByEntryId.set(entry.id, storagePath)
    }

    const fallbackCoverPath = orderedPaths[0] ?? null
    const selectedCoverPath = media.coverEntryId
      ? (resolvedPathByEntryId.get(media.coverEntryId) ?? fallbackCoverPath)
      : fallbackCoverPath

    return {
      photos: orderedPaths,
      thumbnailImage: selectedCoverPath,
    }
  }

  return {
    uploadAndResolvePaths,
  }
}
