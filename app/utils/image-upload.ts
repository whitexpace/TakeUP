const WEBP_MIME_TYPE = "image/webp"
const JPEG_MIME_TYPE = "image/jpeg"

const getFileNameWithExtension = (fileName: string, extension: string) => {
  const trimmedName = fileName.trim() || "image"
  const lastDotIndex = trimmedName.lastIndexOf(".")
  const baseName = lastDotIndex > 0 ? trimmedName.slice(0, lastDotIndex) : trimmedName
  return `${baseName || "image"}.${extension}`
}

const loadImageElement = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error("Unable to load the selected image."))
    }

    image.src = objectUrl
  })

const renderImageCanvas = async (file: File, backgroundColor?: string) => {
  if (typeof document === "undefined") {
    throw new Error("Image conversion is only available in the browser.")
  }

  const image = await loadImageElement(file)
  const canvas = document.createElement("canvas")
  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height

  if (!canvas.width || !canvas.height) {
    throw new Error("Unable to convert the selected image.")
  }

  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("Unable to convert the selected image.")
  }

  if (backgroundColor) {
    context.fillStyle = backgroundColor
    context.fillRect(0, 0, canvas.width, canvas.height)
  }

  context.drawImage(image, 0, 0)
  return canvas
}

const canvasToBlob = (canvas: HTMLCanvasElement, mimeType: string, quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to convert the selected image."))
          return
        }

        resolve(blob)
      },
      mimeType,
      quality,
    )
  })

const createConvertedFile = async (
  file: File,
  mimeType: string,
  extension: string,
  quality: number,
  backgroundColor?: string,
) => {
  const canvas = await renderImageCanvas(file, backgroundColor)
  const normalizedQuality = Number.isFinite(quality) ? Math.min(1, Math.max(0, quality)) : 0.92
  const blob = await canvasToBlob(canvas, mimeType, normalizedQuality)

  return new File([blob], getFileNameWithExtension(file.name, extension), {
    type: mimeType,
    lastModified: file.lastModified,
  })
}

export const convertImageFileToWebP = async (file: File, quality = 0.92): Promise<File> => {
  const webpFileName = getFileNameWithExtension(file.name, "webp")

  if (file.type === WEBP_MIME_TYPE && file.name === webpFileName) {
    return file
  }

  if (file.type === WEBP_MIME_TYPE || file.name.toLowerCase().endsWith(".webp")) {
    return new File([file], webpFileName, {
      type: WEBP_MIME_TYPE,
      lastModified: file.lastModified,
    })
  }

  try {
    return await createConvertedFile(file, WEBP_MIME_TYPE, "webp", quality)
  } catch (webpError) {
    try {
      return await createConvertedFile(
        file,
        JPEG_MIME_TYPE,
        "jpg",
        Math.min(0.9, quality),
        "#ffffff",
      )
    } catch {
      if (file.type && file.type.startsWith("image/")) {
        return file
      }

      throw webpError
    }
  }
}
