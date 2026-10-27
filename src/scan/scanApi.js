import { recognizeHand } from './recognize.js'

// The site owner's free Gemini key, built in at `npm run build` from .env.
// Everyone who opens the site scans with it; nobody else needs a key.
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
export const scanAvailable = !!API_KEY

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

export async function scanHand({ base64, mediaType }, onStatus) {
  const refs = await loadRefs()
  return recognizeHand({ apiKey: API_KEY, imageBase64: base64, mediaType, refs, onStatus })
}
