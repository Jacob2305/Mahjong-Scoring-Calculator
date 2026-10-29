import { recognizeHand } from './recognize.js'

// The on-device scanner (runtime + model, ~25 MB) loads only once someone opens Scan.
const loadLocal = () => import('./localScan.js')
export function preloadLocalModel() {
  loadLocal().then((m) => m.preloadLocalModel()).catch(() => {})
}

// Optional backup: the site owner's free Gemini key, built in at `npm run build`
// from .env. Only used if the on-device model can't run on a device.
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''

// The on-device model ships with the site, so scanning always works.
export const scanAvailable = true

// Optional reference crops in src/scan/refs/, named <id>_<style>.jpg.
const refFiles = import.meta.glob('./refs/*.{jpg,jpeg,png,webp}', { eager: true, query: '?url', import: 'default' })
let refsPromise = null
function loadRefs() {
  refsPromise ||= Promise.all(
    Object.entries(refFiles).map(async ([path, url]) => {
      const name = path.split('/').pop()
      const blob = await (await fetch(url)).blob()
      const dataUrl = await new Promise((resolve) => {
        const r = new FileReader()
        r.onload = () => resolve(r.result)
        r.readAsDataURL(blob)
      })
      return {
        id: name.split(/[_.]/)[0],
        label: name.replace(/\.[^.]+$/, ''),
        mediaType: blob.type || 'image/jpeg',
        data: dataUrl.slice(dataUrl.indexOf(',') + 1),
      }
    }),
  )
  return refsPromise
}

// img: from resizeImage(). Tries the on-device model first.
export async function scanHand(img, onStatus) {
  try {
    const { scanLocally } = await loadLocal()
    return await scanLocally(img, onStatus)
  } catch (err) {
    // Model failed to download or run (very old browser, offline first visit…).
    console.warn('[scan] on-device model failed', err)
    if (!API_KEY) throw new Error('The scanner could not load. Check your connection and try again.')
    onStatus('Using the online scanner instead…')
  }
  const refs = await loadRefs()
  return recognizeHand({ apiKey: API_KEY, imageBase64: img.base64, mediaType: img.mediaType, refs, onStatus })
}
