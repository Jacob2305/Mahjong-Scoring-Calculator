import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ScanReview, { toReviewItems } from './ScanReview.jsx'
import { resizeImage } from './resizeImage.js'
import { scanHand, scanAvailable, preloadLocalModel } from './scanApi.js'
import { summarizeLog } from './recognize.js'

// Header "Scan" button plus the whole capture → recognise → review flow.
// onCommit receives the reviewed hand: { concealed, melded, flowers, ctx }.
// Overlays are portalled to <body>: the sticky header's backdrop-blur would
// otherwise trap `position: fixed` inside the header's box.
// variant 'big': the prominent button in the middle of the home screen.
export default function ScanButton({ ctx, onCommit, variant = 'small' }) {
  const [stage, setStage] = useState(null) // null | 'choose' | 'scanning' | 'review'
  const [photo, setPhoto] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState(null) // retry progress shown under the spinner
  const [attemptSummary, setAttemptSummary] = useState(null) // e.g. "3.8-flash: 503 ×3"
  const cameraRef = useRef(null)
  const uploadRef = useRef(null)
  const runId = useRef(0) // ignore results from a scan the user closed

  async function run(img) {
    const id = ++runId.current
    setStage('scanning')
    setError(null)
    setStatus(null)
    setAttemptSummary(null)
    console.info(
      `[scan] sending ${img.width}×${img.height} JPEG, ~${Math.round(img.bytes / 1024)} KB`
      + ` (original ${img.original.width}×${img.original.height}, ${Math.round(img.original.bytes / 1024)} KB)`,
    )
    try {
      const data = await scanHand(img, (s) => { if (id === runId.current) setStatus(s) })
      console.info(`[scan] done in ${(data.ms / 1000).toFixed(1)}s with ${data.model}: ${data.tiles.length} tiles`, data.tiles)
      if (id !== runId.current) return
      setResult({ items: toReviewItems(data.tiles), issues: data.issues })
      setStage('review')
    } catch (err) {
      console.info(`[scan] failed: ${summarizeLog(err.log)}`)
      if (id !== runId.current) return
      setError(err.message || 'Scan failed')
      setAttemptSummary(err.log?.length ? summarizeLog(err.log) : null)
      setStage('choose')
    }
  }

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again
    if (!file) return
    let img
    try {
      img = await resizeImage(file)
    } catch {
      setError('Could not read that image.')
      setStage('choose')
      return
    }
    setPhoto(img)
    run(img)
  }

  const close = () => { runId.current++; setStage(null); setError(null); setResult(null) }

  return (
    <>
      <button
        onClick={() => { preloadLocalModel(); setStage('choose') }}
        className={variant === 'big'
          ? 'flex-1 rounded-xl bg-gradient-to-r from-gold-light to-gold px-3 py-2.5 text-sm font-bold text-brown-dark shadow-lg active:scale-[0.98]'
          : 'rounded-lg bg-gold px-2.5 py-1 text-xs font-semibold text-brown-dark'}
      >
        {variant === 'big' ? '📷 Scan your hand' : '📷 Scan'}
      </button>

      {/* Rear camera on phones; desktop browsers fall back to a file picker. */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={uploadRef} type="file" accept="image/*" hidden onChange={onFile} />

      {(stage === 'choose' || stage === 'scanning') && createPortal(
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4" onClick={close}>
          <div className="w-full max-w-md rounded-2xl bg-felt-800 p-5" onClick={(e) => e.stopPropagation()}>
            {stage === 'scanning' ? (
              <div className="flex flex-col items-center py-6 text-ivory/80">
                {photo && <img src={photo.dataUrl} alt="" className="mb-4 max-h-40 rounded-lg opacity-70" />}
                <div className="w-8 h-8 rounded-full border-4 border-gold/30 border-t-gold animate-spin" />
                <p className="mt-3 text-sm">Reading tiles…</p>
                {status && <p className="mt-1 text-xs text-amber-300">{status}</p>}
                <button onClick={close} className="mt-4 text-xs text-ivory/50 underline">Cancel</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-ivory text-lg">Scan your hand</h2>
                  <button onClick={close} className="rounded-lg bg-felt-700 w-8 h-8 text-ivory/70">✕</button>
                </div>
                <p className="text-sm text-ivory/60 mb-3">
                  Lay the tiles face up and shoot from above. Fill the frame and avoid glare.
                </p>
                <div className="mb-4 rounded-lg bg-felt-900/60 px-3 py-2 text-xs text-ivory/70 leading-relaxed">
                  <span className="font-semibold text-gold">Have revealed sets?</span> Leave a clear gap between
                  your two groups:
                  <div className="mt-1.5 grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-md border border-ivory/15 p-1.5">
                      <div className="flex gap-1 justify-center">
                        <span className="rounded bg-ivory/20 px-1.5">暗</span><span className="opacity-40">│</span><span className="rounded bg-gold/30 px-1.5">明</span>
                      </div>
                      <div className="mt-1 text-[10px]">concealed left · revealed right</div>
                    </div>
                    <div className="rounded-md border border-ivory/15 p-1.5">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="rounded bg-ivory/20 px-1.5">暗</span><span className="rounded bg-gold/30 px-1.5">明</span>
                      </div>
                      <div className="mt-1 text-[10px]">concealed top · revealed below</div>
                    </div>
                  </div>
                  <div className="mt-1.5 text-[10px] text-ivory/50">You can drag tiles between the two sides afterwards.</div>
                </div>
                {!scanAvailable && (
                  <div className="mb-3 rounded-lg bg-amber-900/40 border border-amber-700/70 px-3 py-2 text-sm text-amber-100">
                    Scanning isn't set up on this site yet (no Gemini key was added when it was built).
                  </div>
                )}
                {error && (
                  <div className="mb-3 rounded-lg bg-red-900/50 border border-red-700 px-3 py-2 text-sm text-red-100">
                    {error}
                    {attemptSummary && <div className="mt-1 text-[10px] text-red-200/70 break-words">{attemptSummary}</div>}
                  </div>
                )}
                <div className="grid gap-2">
                  <button onClick={() => cameraRef.current.click()} className="rounded-xl py-3.5 font-bold bg-gradient-to-r from-gold-light to-gold text-brown-dark">
                    📷 Take photo
                  </button>
                  <button onClick={() => uploadRef.current.click()} className="rounded-xl py-3 font-semibold bg-felt-700 text-ivory/80">
                    Upload a photo
                  </button>
                  {photo && error && (
                    <button onClick={() => run(photo)} className="rounded-xl py-3 font-semibold bg-felt-700 text-ivory/80">
                      Try the same photo again
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}

      {stage === 'review' && result && createPortal(
        <ScanReview
          photoUrl={photo.dataUrl}
          initialItems={result.items}
          issues={result.issues}
          ctx={ctx}
          onCancel={close}
          onRetake={() => { setResult(null); setStage('choose') }}
          onCommit={(hand) => { onCommit(hand); close() }}
        />,
        document.body,
      )}
    </>
  )
}
