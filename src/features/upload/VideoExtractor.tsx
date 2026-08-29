import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { ChevronUp, ChevronDown, X, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { initiateVideoUpload, probeVideo, triggerExtraction } from "@/lib/uploadApi"
import { samplingPresets } from "@/lib/videoSampling"
import { useExtractionProgress } from "@/hooks/useExtractionProgress"

interface VideoExtractorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  projectId: string
  file: File
  batchName: string
  tagNames: string[]
  /** Called once extraction finishes successfully, with the batch to load. */
  onExtractionComplete: (batchId: string) => void
  /** Nothing was ever uploaded at this point, so there's genuinely nothing to clean up. */
  onSkip: () => void
}

// Fallback density before duration/interval are known yet.
const FILMSTRIP_FRAME_COUNT = 15
// The filmstrip should show every frame the current sampling rate would
// actually pull from the full timeline — that's the only way dragging a
// handle by one cell corresponds to adding/removing one real extracted
// frame. Capped so an aggressive rate (e.g. 60fps) on a longer clip can't
// demand hundreds of live canvas captures.
const PREVIEW_MIN_FRAMES = 8
const PREVIEW_MAX_FRAMES = 150
const ASSUMED_FPS = 30
const MIN_RANGE_SECONDS = 0.5

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(3)
  return `${String(m).padStart(2, "0")}:${s.padStart(6, "0")}`
}

function formatRate(interval: number): string {
  if (interval <= 0) return "—"
  if (interval <= 1) {
    const fps = 1 / interval
    return `${Number.isInteger(fps) ? fps : fps.toFixed(1)} frames/second`
  }
  return `1 frame every ${interval < 10 ? interval.toFixed(2) : interval.toFixed(1)} seconds`
}

export function VideoExtractor({
  open,
  onOpenChange,
  workspaceId,
  projectId,
  file,
  batchName,
  tagNames,
  onExtractionComplete,
  onSkip,
}: VideoExtractorProps) {
  const playerRef = useRef<HTMLVideoElement>(null)
  const filmstripRef = useRef<HTMLDivElement>(null)

  // Never touches the network — a local, disposable URL pointing at the
  // File already sitting in the browser's memory. Same-origin for canvas
  // purposes, so no CORS setup is needed at all for thumbnail generation.
  //
  // Creation AND revocation live in the SAME effect (not useMemo-for-create
  // + useEffect-for-cleanup) on purpose: React StrictMode's dev-mode
  // mount→cleanup→mount simulation would otherwise revoke the URL that the
  // component is actually displaying, since a URL created during the render
  // phase (useMemo) is shared across both simulated mounts while the
  // cleanup only runs once — killing the live URL before the video can load
  // it (this is exactly what "Loading video…" forever + a failed blob:
  // request with 0 bytes transferred means). Creating a fresh URL inside
  // each effect invocation keeps the discarded first cycle's URL and the
  // real second cycle's URL fully independent.
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setVideoUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const [thumbVideoEl, setThumbVideoEl] = useState<HTMLVideoElement | null>(null)
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null)

  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  // The source video's own aspect ratio — driving the filmstrip's height
  // from this (rather than a guessed fixed height) is what keeps individual
  // frames looking like the actual footage instead of stretched/over-cropped
  // slivers, regardless of how many cells fit across the dialog's width.
  const [videoAspect, setVideoAspect] = useState<number | null>(null)
  const [filmstripWidth, setFilmstripWidth] = useState(0)
  const [filmstrip, setFilmstrip] = useState<string[]>([])
  const [filmstripStatus, setFilmstripStatus] = useState<"loading" | "ready" | "unavailable">(
    "loading"
  )
  const [manualOpen, setManualOpen] = useState(false)
  const [manualMarks, setManualMarks] = useState<number[]>([])

  const [rangeStart, setRangeStart] = useState(0)
  const [rangeEnd, setRangeEnd] = useState(0)
  const [draggingHandle, setDraggingHandle] = useState<"start" | "end" | null>(null)

  // The source video's own frame rate — a purely client-side estimate
  // (duration / interval) can't know this, so it happily shows counts
  // above what the video actually contains (ffmpeg would then duplicate
  // frames to reach it). Probed once, read-only, as soon as a file is
  // picked — nothing is uploaded/persisted by this call.
  const [nativeFps, setNativeFps] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    setNativeFps(null)
    probeVideo(workspaceId, projectId, file)
      .then((res) => {
        if (!cancelled) setNativeFps(res.native_fps)
      })
      .catch(() => {
        // Probe failing shouldn't block the preview — just means the
        // estimate stays uncapped until extraction time, where the worker
        // applies the same cap itself regardless.
      })
    return () => {
      cancelled = true
    }
  }, [workspaceId, projectId, file])

  const presets = useMemo(() => (duration > 0 ? samplingPresets(duration) : []), [duration])
  const minInterval = presets.length ? Math.min(...presets.map((p) => p.interval)) : 1 / 60
  const maxInterval = presets.length ? Math.max(...presets.map((p) => p.interval)) : 60

  const [frameInterval, setFrameInterval] = useState(1)

  // Debounced so dragging the rate slider doesn't fire off a fresh round of
  // canvas seeks+captures on every intermediate value — only once the user
  // actually settles on a rate.
  const [debouncedInterval, setDebouncedInterval] = useState(frameInterval)
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedInterval(frameInterval), 350)
    return () => window.clearTimeout(t)
  }, [frameInterval])

  const desiredFilmstripCount = useMemo(() => {
    if (duration <= 0 || debouncedInterval <= 0) return FILMSTRIP_FRAME_COUNT
    return Math.min(
      PREVIEW_MAX_FRAMES,
      Math.max(PREVIEW_MIN_FRAMES, Math.round(duration / debouncedInterval))
    )
  }, [duration, debouncedInterval])

  const [phase, setPhase] = useState<"idle" | "uploading" | "extracting">("idle")
  const [videoUploadId, setVideoUploadId] = useState<string | null>(null)
  const [committedBatchId, setCommittedBatchId] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const { progress } = useExtractionProgress(workspaceId, projectId, videoUploadId)

  // Once duration is known (native <video> metadata), initialize range/interval defaults.
  useEffect(() => {
    if (duration > 0 && rangeEnd === 0) {
      setRangeEnd(duration)
      const def = samplingPresets(duration).find((p) => p.default)
      if (def) setFrameInterval(def.interval)
    }
  }, [duration, rangeEnd])

  // ── Generate filmstrip thumbnails off-screen, without touching the visible player ──
  // Re-runs whenever desiredFilmstripCount changes (i.e. the sampling rate
  // settled on a new value) so the strip always shows exactly the frames
  // the current settings would actually extract, not a fixed decorative
  // count unrelated to it.
  useEffect(() => {
    if (!open || duration === 0 || !videoUrl) return
    const thumbVideo = thumbVideoEl
    const canvas = canvasEl
    if (!thumbVideo || !canvas) return

    setFilmstripStatus("loading")
    let cancelled = false
    // StrictMode (dev only) mounts this effect, cleans it up, then mounts it
    // again — the first pass's generate() loop is mid-seek when cleanup
    // runs. Track the in-flight seek's own cleanup so the effect's cleanup
    // can force it to settle immediately instead of leaving it dangling to
    // race the second (real) pass's seeks on the same shared <video>.
    let activeSeekCleanup: (() => void) | null = null

    function giveUp() {
      if (cancelled) return
      cancelled = true
      setFilmstripStatus("unavailable")
    }

    // Waits for the seek to visibly land, but — unlike the old version —
    // NEVER reports failure. Some browsers occasionally never fire "seeked"
    // for a given seek (especially on sparsely-keyframed footage like
    // security-cam H.264), and treating that as "skip this slot" was why
    // the strip would silently end up with fewer cells than intended (e.g.
    // 5 instead of 15). Whatever frame is actually on screen once we stop
    // waiting is still a perfectly good thumbnail — capturing something is
    // always better than capturing nothing, so this only ever delays, never
    // drops, a slot.
    function settleSeek(t: number): Promise<void> {
      return new Promise((resolve) => {
        let done = false
        const finish = () => {
          if (done) return
          done = true
          thumbVideo!.removeEventListener("seeked", onSettled)
          thumbVideo!.removeEventListener("timeupdate", onSettled)
          window.clearTimeout(timer)
          activeSeekCleanup = null
          resolve()
        }
        const onSettled = () => finish()
        const timer = window.setTimeout(finish, 1500)
        thumbVideo!.addEventListener("seeked", onSettled, { once: true })
        thumbVideo!.addEventListener("timeupdate", onSettled, { once: true })
        activeSeekCleanup = finish
        thumbVideo!.currentTime = t
      })
    }

    async function generate() {
      const ctx = canvas!.getContext("2d")
      if (!ctx) return giveUp()

      const results: string[] = []
      const frameCount = desiredFilmstripCount
      const step = duration / (frameCount + 1)

      // Capturing at a fixed 80x56 box (unrelated to the source video's real
      // aspect ratio) squashed every frame into that shape — actual pixel
      // distortion baked into the JPEG, not just a display-layer crop, so no
      // amount of CSS sizing on the <img> could ever undo it. Derive the
      // capture box from the video's own dimensions instead.
      const vw = thumbVideo!.videoWidth || 16
      const vh = thumbVideo!.videoHeight || 9
      const captureWidth = 160
      const captureHeight = Math.round((captureWidth * vh) / vw)

      try {
        for (let i = 1; i <= frameCount; i++) {
          if (cancelled) return
          const t = step * i
          await settleSeek(t)
          if (cancelled) return
          canvas!.width = captureWidth
          canvas!.height = captureHeight
          ctx.drawImage(thumbVideo!, 0, 0, captureWidth, captureHeight)
          results.push(canvas!.toDataURL("image/jpeg", 0.6))
        }
        if (!cancelled) {
          if (results.length > 0) {
            setFilmstrip(results)
            setFilmstripStatus("ready")
          } else {
            giveUp()
          }
        }
      } catch {
        giveUp()
      }
    }

    function onLoadedMetadata() {
      generate()
    }
    function onError() {
      giveUp()
    }

    // This is a SECOND, independent <video> element from the visible
    // player above — it needs its own src and its own "is metadata ready"
    // wait before we can start seeking it frame-by-frame.
    thumbVideo.addEventListener("loadedmetadata", onLoadedMetadata, { once: true })
    thumbVideo.addEventListener("error", onError, { once: true })
    thumbVideo.src = videoUrl
    thumbVideo.load()

    return () => {
      cancelled = true
      activeSeekCleanup?.()
      thumbVideo.removeEventListener("loadedmetadata", onLoadedMetadata)
      thumbVideo.removeEventListener("error", onError)
    }
  }, [open, duration, thumbVideoEl, canvasEl, videoUrl, desiredFilmstripCount])

  // Tracks the filmstrip's actual rendered width so its height can be
  // derived from the real video aspect ratio instead of a guessed constant.
  useEffect(() => {
    const el = filmstripRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setFilmstripWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [open])

  // Each cell is filmstripWidth / count wide; deriving height from the
  // source video's own aspect ratio means individual frames show their real
  // proportions instead of being stretched or over-cropped by object-cover.
  const filmstripHeight = useMemo(() => {
    const fallback = 96
    if (!videoAspect || !filmstripWidth) return fallback
    const count = filmstrip.length || desiredFilmstripCount
    const gapTotal = (count - 1) * 2
    const cellWidth = (filmstripWidth - gapTotal) / count
    // Clamped so a high frame count on a wide (16:9-ish) video never
    // shrinks the strip down to an unusably thin sliver — some cropping at
    // that density is normal (Roboflow's own filmstrip crops too), the bug
    // was distorted pixels, not the crop itself.
    return Math.min(112, Math.max(64, Math.round(cellWidth / videoAspect)))
  }, [videoAspect, filmstripWidth, filmstrip.length, desiredFilmstripCount])

  const trimmedDuration = Math.max(MIN_RANGE_SECONDS, rangeEnd - rangeStart)
  // Capped at what the source can actually deliver over the trimmed range
  // — matches the same cap the celery worker applies at extraction time,
  // so this number never over-promises what "Extract N Frames" produces.
  const outputCount =
    frameInterval > 0
      ? Math.max(
          1,
          Math.min(
            Math.round(trimmedDuration / frameInterval),
            nativeFps != null ? Math.floor(trimmedDuration * nativeFps) : Infinity
          )
        )
      : 0
  const combinedCount = outputCount + manualMarks.length

  // Local draft text for the two numeric inputs below, decoupled from the
  // committed frameInterval/outputCount — a controlled <input type="number">
  // bound directly to the derived value fights the user mid-keystroke
  // (e.g. typing "0.5" starts with "0", which used to collapse straight
  // back to the minimum via `Number(...) || minInterval`, making the field
  // feel un-typeable). Committing on every parseable value keeps live
  // updates while still letting an in-progress edit sit uncommitted.
  const [intervalDraft, setIntervalDraft] = useState(() => String(frameInterval))
  const [countDraft, setCountDraft] = useState(() => String(outputCount))

  useEffect(() => {
    setIntervalDraft(String(Number(frameInterval.toFixed(3))))
  }, [frameInterval])

  useEffect(() => {
    setCountDraft(String(outputCount))
  }, [outputCount])

  const sliderPosition = useMemo(() => {
    if (!duration) return 0
    const logMin = Math.log(minInterval)
    const logMax = Math.log(maxInterval)
    const logVal = Math.log(Math.max(minInterval, Math.min(maxInterval, frameInterval)))
    return ((logVal - logMin) / (logMax - logMin)) * 100
  }, [frameInterval, minInterval, maxInterval, duration])

  function setPosition(position: number) {
    const logMin = Math.log(minInterval)
    const logMax = Math.log(maxInterval)
    const logVal = logMin + (position / 100) * (logMax - logMin)
    // Rounding this to 3 decimals used to throw away most of the precision
    // at the fast end of the scale (1/60 ≈ 0.0167 rounds to 0.017, a ~2%
    // error) which snowballs into dozens of frames of difference once
    // duration / interval is computed — keep the raw float, only round for
    // on-screen display (formatRate / intervalDraft already do that).
    setFrameInterval(Math.exp(logVal))
  }

  function seekTo(t: number) {
    const clamped = Math.max(0, Math.min(duration, t))
    if (playerRef.current) playerRef.current.currentTime = clamped
    setCurrentTime(clamped)
  }

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!draggingHandle || !filmstripRef.current || !duration) return
      const rect = filmstripRef.current.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const t = pct * duration
      if (draggingHandle === "start") {
        const next = Math.min(t, rangeEnd - MIN_RANGE_SECONDS)
        setRangeStart(next)
        seekTo(next)
      } else {
        const next = Math.max(t, rangeStart + MIN_RANGE_SECONDS)
        setRangeEnd(next)
      }
    },
    [draggingHandle, duration, rangeStart, rangeEnd]
  )

  useEffect(() => {
    if (!draggingHandle) return
    function onUp() {
      setDraggingHandle(null)
    }
    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", onUp)
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [draggingHandle, handlePointerMove])

  const isMarked = manualMarks.some((m) => Math.abs(m - currentTime) < 1 / ASSUMED_FPS / 2)

  function toggleCurrentFrame() {
    if (isMarked) {
      setManualMarks((marks) => marks.filter((m) => Math.abs(m - currentTime) >= 1 / ASSUMED_FPS / 2))
    } else {
      setManualMarks((marks) => [...marks, currentTime].sort((a, b) => a - b))
    }
  }

  function jumpToAdjacentMark(direction: "prev" | "next") {
    if (manualMarks.length === 0) return
    if (direction === "next") {
      const next = manualMarks.find((m) => m > currentTime + 0.001)
      seekTo(next ?? manualMarks[manualMarks.length - 1])
    } else {
      const prev = [...manualMarks].reverse().find((m) => m < currentTime - 0.001)
      seekTo(prev ?? manualMarks[0])
    }
  }

  // ── The actual commit point — nothing has touched the server before this. ──
  async function handleExtract() {
    setUploadError(null)
    setPhase("uploading")
    try {
      const initiated = await initiateVideoUpload(workspaceId, projectId, file, {
        batchName,
        tagNames,
      })
      setCommittedBatchId(initiated.batch_id)
      setPhase("extracting")
      const res = await triggerExtraction(
        workspaceId,
        projectId,
        initiated.video_upload_id,
        frameInterval,
        manualMarks,
        { start: rangeStart, end: rangeEnd },
        nativeFps
      )
      setVideoUploadId(res.video_upload_id)
    } catch (err) {
      setPhase("idle")
      setUploadError(extractErrorMessage(err))
    }
  }

  useEffect(() => {
    if (progress?.status === "done" && committedBatchId) {
      onExtractionComplete(committedBatchId)
    }
  }, [progress?.status, committedBatchId, onExtractionComplete])

  return (
    <Dialog open={open} onOpenChange={phase !== "idle" ? undefined : onOpenChange}>
      <DialogContent className="max-w-4xl gap-0 p-0 sm:max-w-4xl" showCloseButton={phase === "idle"}>
        <DialogHeader className="border-b border-border p-5 pb-4">
          <DialogTitle className="text-base">
            Extract frames from {file.name}
            {duration > 0 && (
              <span className="font-normal text-muted-foreground"> ({duration.toFixed(3)}s)</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[80vh] overflow-y-auto p-6">
          <video ref={setThumbVideoEl} muted className="hidden" />
          <canvas ref={setCanvasEl} className="hidden" />

          {phase === "idle" ? (
            <>
              <video
                ref={playerRef}
                src={videoUrl ?? undefined}
                controls
                className="aspect-video w-full rounded-lg bg-black"
                onLoadedMetadata={(e) => {
                  setDuration(e.currentTarget.duration)
                  const { videoWidth, videoHeight } = e.currentTarget
                  if (videoWidth && videoHeight) setVideoAspect(videoWidth / videoHeight)
                }}
                onTimeUpdate={(e) => {
                  const t = e.currentTarget.currentTime
                  // The trim range is what actually gets extracted — playback
                  // should preview just that range too, not run past the end
                  // handle into footage that won't be in the output.
                  if (rangeEnd > 0 && t >= rangeEnd) {
                    e.currentTarget.pause()
                    e.currentTarget.currentTime = rangeEnd
                    setCurrentTime(rangeEnd)
                    return
                  }
                  setCurrentTime(t)
                }}
              />

              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {formatTimestamp(currentTime)} / {formatTimestamp(duration)}
                </span>
                <div className="flex items-center gap-1.5">
                  {duration > 0 && (rangeStart > 0 || rangeEnd < duration) && (
                    <button
                      title="Reset sampling range"
                      onClick={() => {
                        setRangeStart(0)
                        setRangeEnd(duration)
                      }}
                      className="flex items-center gap-1 rounded-md border border-border px-2 py-1 font-medium text-foreground hover:bg-accent"
                    >
                      <RotateCcw className="size-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => setManualOpen((v) => !v)}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-1 font-medium text-foreground hover:bg-accent"
                  >
                    {manualOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    {manualOpen ? "Hide" : "Show"} Manual Selection
                  </button>
                </div>
              </div>

              <div
                ref={filmstripRef}
                onClick={(e) => {
                  if (!filmstripRef.current || !duration) return
                  const rect = filmstripRef.current.getBoundingClientRect()
                  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
                  seekTo(pct * duration)
                }}
                style={{ height: filmstripHeight }}
                className="relative mt-2 flex cursor-pointer overflow-hidden rounded-md border border-border bg-muted select-none"
              >
                {filmstripStatus === "loading" ? (
                  <div className="flex w-full items-center justify-center text-xs text-muted-foreground">
                    {duration === 0 ? "Loading video…" : "Generating preview…"}
                  </div>
                ) : filmstripStatus === "unavailable" ? (
                  <div className="flex w-full items-center justify-center text-xs text-muted-foreground">
                    Preview unavailable — use the player above and the controls below to pick frames.
                  </div>
                ) : (
                  <div className="flex w-full gap-0.5 bg-black">
                    {filmstrip.map((src, i) => (
                      <img key={i} src={src} className="h-full flex-1 object-cover" alt="" />
                    ))}
                  </div>
                )}

                {duration > 0 && (
                  <>
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 bg-black/50"
                      style={{ width: `${(rangeStart / duration) * 100}%` }}
                    />
                    <div
                      className="pointer-events-none absolute inset-y-0 right-0 bg-black/50"
                      style={{ width: `${100 - (rangeEnd / duration) * 100}%` }}
                    />
                    <div
                      className="pointer-events-none absolute top-0 z-10 h-full w-[3px] bg-white"
                      style={{
                        left: `${(currentTime / duration) * 100}%`,
                        boxShadow: "0 0 8px 2px var(--brand), 0 0 2px 1px rgba(255,255,255,0.9)",
                      }}
                    />
                    {manualMarks.map((m) => (
                      <div
                        key={m}
                        className="pointer-events-none absolute top-0 h-full w-0.5 bg-amber-400"
                        style={{ left: `${(m / duration) * 100}%` }}
                      />
                    ))}
                    <div
                      onPointerDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDraggingHandle("start")
                        seekTo(rangeStart)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-0 z-10 flex h-full w-4 -translate-x-1/2 cursor-ew-resize items-center justify-center"
                      style={{ left: `${(rangeStart / duration) * 100}%` }}
                    >
                      <div className="h-full w-2.5 rounded-full bg-brand shadow-sm" />
                    </div>
                    <div
                      onPointerDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDraggingHandle("end")
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-0 z-10 flex h-full w-4 -translate-x-1/2 cursor-ew-resize items-center justify-center"
                      style={{ left: `${(rangeEnd / duration) * 100}%` }}
                    >
                      <div className="h-full w-2.5 rounded-full bg-brand shadow-sm" />
                    </div>
                  </>
                )}
              </div>

              {manualOpen && (
                <div className="mt-3 rounded-lg border border-border p-3">
                  <p className="mb-2 text-sm font-semibold text-foreground">Select frames to upload</p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={manualMarks.length === 0}
                      onClick={() => jumpToAdjacentMark("prev")}
                    >
                      ⏮ Previous
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => seekTo(currentTime - 1 / ASSUMED_FPS)}>
                      ‹ -1 Frame
                    </Button>
                    <Button
                      size="sm"
                      onClick={toggleCurrentFrame}
                      className={cn(
                        isMarked
                          ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                          : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                      )}
                    >
                      {isMarked ? "Remove Current Frame" : "Add Current Frame"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => seekTo(currentTime + 1 / ASSUMED_FPS)}>
                      +1 Frame ›
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={manualMarks.length === 0}
                      onClick={() => jumpToAdjacentMark("next")}
                    >
                      Next ⏭
                    </Button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-start gap-2 text-sm">
                    <span className="font-medium text-foreground">Selected frames</span>
                    {manualMarks.length === 0 ? (
                      <span className="text-muted-foreground">Add frames from the current playhead.</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {manualMarks.map((m) => (
                          <span
                            key={m}
                            className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                          >
                            {formatTimestamp(m)}
                            <button onClick={() => setManualMarks((marks) => marks.filter((x) => x !== m))}>
                              <X className="size-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 rounded-lg border border-border p-4">
                <p className="mb-4 text-sm font-semibold text-foreground">How should we sample the video?</p>

                <div className="relative mb-2 flex items-center justify-between text-xs">
                  <button
                    onClick={() => setFrameInterval(minInterval)}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 font-medium transition-colors",
                      Math.abs(minInterval - frameInterval) < 1e-6
                        ? "bg-brand text-brand-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {presets.find((p) => p.interval === minInterval)?.label ?? "Fastest"}
                  </button>
                  <button
                    onClick={() => setFrameInterval(maxInterval)}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 font-medium transition-colors",
                      Math.abs(maxInterval - frameInterval) < 1e-6
                        ? "bg-brand text-brand-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {presets.find((p) => p.interval === maxInterval)?.label ?? "Slowest"}
                  </button>
                </div>

                <div className="relative h-7">
                  <span
                    className="absolute top-0 -translate-x-1/2 rounded-md border border-brand bg-background px-2.5 py-1 text-xs font-medium whitespace-nowrap text-brand shadow-md"
                    style={{ left: `${Math.min(94, Math.max(6, sliderPosition))}%` }}
                  >
                    {formatRate(frameInterval)}
                  </span>
                </div>

                <Slider
                  value={[sliderPosition]}
                  onValueChange={([v]) => setPosition(v)}
                  min={0}
                  max={100}
                  step={0.1}
                  disabled={duration === 0}
                />
                <div className="mt-4 flex items-center gap-2 text-sm text-foreground">
                  Output 1 frame every
                  <Input
                    type="number"
                    step="0.1"
                    min={minInterval}
                    max={maxInterval}
                    value={intervalDraft}
                    onChange={(e) => {
                      setIntervalDraft(e.target.value)
                      const parsed = Number(e.target.value)
                      if (e.target.value.trim() !== "" && !Number.isNaN(parsed)) {
                        setFrameInterval(Math.max(minInterval, Math.min(maxInterval, parsed)))
                      }
                    }}
                    onBlur={() => setIntervalDraft(String(Number(frameInterval.toFixed(3))))}
                    className="h-8 w-20"
                  />
                  seconds (
                  <Input
                    type="number"
                    min={1}
                    value={countDraft}
                    onChange={(e) => {
                      setCountDraft(e.target.value)
                      const parsed = Number(e.target.value)
                      if (e.target.value.trim() !== "" && !Number.isNaN(parsed) && parsed >= 1) {
                        setFrameInterval(trimmedDuration / parsed)
                      }
                    }}
                    onBlur={() => setCountDraft(String(outputCount))}
                    className="h-8 w-20"
                  />
                  images)
                </div>
              </div>

              {uploadError && <p className="mt-3 text-sm text-destructive">{uploadError}</p>}
            </>
          ) : phase === "uploading" ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <p className="text-lg font-semibold text-brand">Processing files…</p>
              <p className="font-mono text-xs text-muted-foreground">{file.name}</p>
              <Progress value={0} className="w-full max-w-sm" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <p className="text-lg font-semibold text-brand">Processing files…</p>
              <p className="font-mono text-xs text-muted-foreground">
                {progress?.message ?? "Starting extraction…"}
              </p>
              <Progress value={progress?.percent ?? 0} className="w-full max-w-sm" />
              {progress?.total ? (
                <p className="text-xs text-muted-foreground">
                  {progress.saved} / {progress.total} frames
                </p>
              ) : null}
              {progress?.status === "failed" && (
                <p className="text-sm text-destructive">{progress.message}</p>
              )}
            </div>
          )}
        </div>

        {phase === "idle" && (
          <div className="flex items-center justify-between border-t border-border p-4">
            <Button variant="outline" onClick={onSkip}>
              Skip Video
            </Button>
            <Button variant="brand" onClick={handleExtract} disabled={duration === 0}>
              Extract {combinedCount} Frame{combinedCount !== 1 && "s"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function extractErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const resp = (err as { response?: { data?: { detail?: unknown } } }).response
    const detail = resp?.data?.detail
    if (typeof detail === "string") return detail
  }
  return "Upload failed — please try again."
}
