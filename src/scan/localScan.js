// Runs the tile model on the phone itself (onnxruntime-web, WebAssembly).
// Free, offline after the first load, and never "busy". The model and the
// runtime (~25 MB together) download the first time someone scans, then the
// browser keeps them cached.
import * as ort from 'onnxruntime-web/wasm'
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import { INPUT_SIZE, letterbox, toTensorData, decode, toHand } from './detect.js'

// Served from public/models/ (copied as-is into dist/ by `npm run build`).
const MODEL_URL = `${import.meta.env.BASE_URL}models/mahjong-tiles.onnx`

ort.env.wasm.wasmPaths = { wasm: wasmUrl }
// Multi-threading needs special server headers Netlify Drop doesn't set.
ort.env.wasm.numThreads = 1

let sessionPromise = null
function loadSession() {
  sessionPromise ||= ort.InferenceSession.create(MODEL_URL, { executionProviders: ['wasm'] })
    .catch((err) => { sessionPromise = null; throw err })
  return sessionPromise
}

// Start downloading the model early (e.g. when the scan dialog opens).
export function preloadLocalModel() {
  loadSession().catch(() => {})
}

async function toInput(dataUrl) {
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob())
  const box = letterbox(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = INPUT_SIZE
  const g = canvas.getContext('2d', { willReadFrequently: true })
  g.fillStyle = 'rgb(114,114,114)' // YOLO's usual padding colour
  g.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE)
  g.drawImage(bitmap, box.padX, box.padY, box.w, box.h)
  bitmap.close?.()
  const { data } = g.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE)
  return { box, tensor: new ort.Tensor('float32', toTensorData(data), [1, 3, INPUT_SIZE, INPUT_SIZE]) }
}

// img: { dataUrl } from resizeImage(). Returns the same shape as recognizeHand().
export async function scanLocally(img, onStatus = () => {}) {
  const started = Date.now()
  if (!sessionPromise) onStatus('Loading the scanner (first time only)…')
  const session = await loadSession()
  onStatus(null)
  const { box, tensor } = await toInput(img.dataUrl)
  const outputs = await session.run({ [session.inputNames[0]]: tensor })
  const out = outputs[session.outputNames[0]]
  const hand = toHand(decode(out.data, out.dims, box))
  return { ...hand, model: 'on-device', attempts: 1, ms: Date.now() - started, log: [] }
}
