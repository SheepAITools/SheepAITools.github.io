const IMAGE_MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

function getImageExtension(imageSrc: string): string {
  const dataUrlMatch = imageSrc.match(/^data:([^;,]+)[;,]/i)
  if (dataUrlMatch?.[1]) {
    return IMAGE_MIME_EXTENSIONS[dataUrlMatch[1].toLowerCase()] ?? "png"
  }

  try {
    const pathname = new URL(imageSrc).pathname
    const extension = pathname.split(".").pop()?.toLowerCase()
    if (extension && ["jpg", "jpeg", "png", "webp"].includes(extension)) {
      return extension === "jpeg" ? "jpg" : extension
    }
  } catch {
    // Non-URL sources fall back to PNG.
  }

  return "png"
}

export function buildImageDownloadName(prefix: string, imageSrc: string, timestamp = Date.now()): string {
  return `${prefix}-${timestamp}.${getImageExtension(imageSrc)}`
}

export function downloadImage(imageSrc: string, filenamePrefix: string): void {
  const link = document.createElement("a")
  link.href = imageSrc
  link.download = buildImageDownloadName(filenamePrefix, imageSrc)
  document.body.appendChild(link)
  link.click()
  link.remove()
}
