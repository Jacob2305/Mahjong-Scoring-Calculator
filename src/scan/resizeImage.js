// Downscale a photo to a fixed long edge and re-encode as JPEG. Keeps uploads
// small and the model's image token cost predictable. createImageBitmap
// applies EXIF orientation, so portrait phone photos come out upright.
const LONG_EDGE = 1568

export async function resizeImage(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const original = { width: bitmap.width, height: bitmap.height, bytes: file.size }
  const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return {
    dataUrl,
    base64,
    mediaType: 'image/jpeg',
    width: w,
    height: h,
    bytes: Math.round((base64.length * 3) / 4),
    original,
  }
}
