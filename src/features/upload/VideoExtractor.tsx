import { useEffect, useMemo, useRef, useState } from "react"
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
import { ChevronUp, ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { triggerExtraction } from "@/lib/uploadApi"
import { useExtractionProgress } from "@/hooks/useExtractionProgress"
import type { VideoInitiateResponse } from "@/types/upload"

interface VideoExtractorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  projectId: string
  video: VideoInitiateResponse
  /** Called once extraction finishes successfully, with the batch to load. */
  onExtractionComplete: (batchId: string) => void
  /** No backend call by design — the batch just stays empty until images are added another way. */
  onSkip: () => void
}

const FILMSTRIP_FRAME_COUNT = 12
// We don't get an actual fps from the backend at this step, so frame-step
// buttons use a reasonable approximation. Good enough for nudging the
// playhead; not used for anything that affects the final extraction math.
const ASSUMED_FPS = 30

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(3)
  return `${String(m).padStart(2, "0")}:${s.padStart(6, "0")}`
}

export function VideoExtractor({
  open,
  onOpenChange,
  workspaceId,
  projectId,
  video,
  onExtractionComplete,
  onSkip,
}: VideoExtractorProps) {
  const playerRef = useRef<HTMLVideoElement>(null)
  // Callback-ref state instead of useRef: Radix Dialog renders its content
  // through a Portal whose mount timing isn't synchronous with the first
  // render commit, so a plain useRef can still be null when our effect first
  // runs (and its dependency array never changes to trigger a retry). State
  // updates from the ref callback force a re-render once the nodes are
  // actually attached, which re-fires the effect below.
  const [thumbVideoEl, setThumbVideoEl] = useState<HTMLVideoElement | null>(null)
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null)

  const [currentTime, setCurrentTime] = useState(0)
  const [filmstrip, setFilmstrip] = useState<string[]>([])
  const [filmstripStatus, setFilmstripStatus] = useState<"loading" | "ready" | "unavailable">(
    "loading"
  )
  const [manualOpen, setManualOpen] = useState(false)
  const [manualMarks, setManualMarks] = useState<number[]>([])

  const minInterval = Math.min(...video.sampling_presets.map((p) => p.interval))
  const maxInterval = Math.max(...video.sampling_presets.map((p) => p.interval))
  const defaultPreset =
    video.sampling_presets.find((p) => p.default) ?? video.sampling_presets[0]

  const [frameInterval, setFrameInterval] = useState(defaultPreset?.interval ?? 1)
  const [extracting, setExtracting] = useState(false)
  const [videoUploadId, setVideoUploadId] = useState<string | null>(null)

  const { progress } = useExtractionProgress(workspaceId, projectId, videoUploadId)

  // ── Generate filmstrip thumbnails once, off-screen, without touching the visible player ──
  // Three ways this can legitimately fail:
  //   1. Missing CORS headers on the video URL — "loadedmetadata"/"error" never fire as expected.
  //   2. The canvas gets tainted (cross-origin frame the browser wasn't allowed to read) — toDataURL() throws.
  //   3. A single seek() never completes (slow/partial range-request support) — the original
  //      code awaited this with no timeout, which is the most likely cause of a permanent
  //      "Generating preview…" hang. Every seek now races against a timeout.
  useEffect(() => {
    if (!open || filmstrip.length > 0) {
      return
    }
    const thumbVideo = thumbVideoEl
    const canvas = canvasEl
    if (!thumbVideo || !canvas) {
      return
    }

    let cancelled = false

    function giveUp() {
      if (cancelled) return
      cancelled = true
      setFilmstripStatus("unavailable")
    }

    const loadTimeout = window.setTimeout(() => giveUp(), 8000)

    function waitForSeek(t: number): Promise<boolean> {
      return new Promise((resolve) => {
        let done = false
        const finish = (ok: boolean) => {
          if (done) return
          done = true
          thumbVideo!.removeEventListener("seeked", onSeeked)
          window.clearTimeout(seekTimeout)
          resolve(ok)
        }
        const onSeeked = () => finish(true)
        const seekTimeout = window.setTimeout(() => finish(false), 4000)
        thumbVideo!.addEventListener("seeked", onSeeked)
        thumbVideo!.currentTime = t
      })
    }

    async function generate() {
      window.clearTimeout(loadTimeout)
      if (cancelled) return

      const ctx = canvas!.getContext("2d")
      if (!ctx) return giveUp()

      const results: string[] = []
      const step = video.duration / (FILMSTRIP_FRAME_COUNT + 1)

      try {
        for (let i = 1; i <= FILMSTRIP_FRAME_COUNT; i++) {
          if (cancelled) return
          const t = step * i
          const seeked = await waitForSeek(t)
          if (cancelled) return
          if (!seeked) {
            continue
          }
          canvas!.width = 80
          canvas!.height = 56
          ctx.drawImage(thumbVideo!, 0, 0, 80, 56)
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
      } catch (err) {
        giveUp()
      }
    }

    function onError() {
      window.clearTimeout(loadTimeout)
      giveUp()
    }

    thumbVideo.addEventListener("loadedmetadata", generate, { once: true })
    thumbVideo.addEventListener("error", onError, { once: true })

    // Set crossOrigin before src imperatively — JSX attribute ordering on
    // <video> doesn't reliably guarantee crossOrigin applies before the
    // browser starts fetching, which can otherwise taint the canvas even
    // when CORS is configured correctly server-side.
    thumbVideo.crossOrigin = "anonymous"
    thumbVideo.src = video.video_url
    thumbVideo.load()

    return () => {
      cancelled = true
      window.clearTimeout(loadTimeout)
      thumbVideo.removeEventListener("loadedmetadata", generate)
      thumbVideo.removeEventListener("error", onError)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, video.duration, thumbVideoEl, canvasEl])


  const outputCount =
    frameInterval > 0 ? Math.max(1, Math.round(video.duration / frameInterval)) : 0
  const combinedCount = outputCount + manualMarks.length

  const sliderPosition = useMemo(() => {
    const logMin = Math.log(minInterval)
    const logMax = Math.log(maxInterval)
    const logVal = Math.log(Math.max(minInterval, Math.min(maxInterval, frameInterval)))
    return ((logVal - logMin) / (logMax - logMin)) * 100
  }, [frameInterval, minInterval, maxInterval])

  function setPosition(position: number) {
    const logMin = Math.log(minInterval)
    const logMax = Math.log(maxInterval)
    const logVal = logMin + (position / 100) * (logMax - logMin)
    setFrameInterval(Number(Math.exp(logVal).toFixed(3)))
  }

  function seekTo(t: number) {
    const clamped = Math.max(0, Math.min(video.duration, t))
    if (playerRef.current) playerRef.current.currentTime = clamped
    setCurrentTime(clamped)
  }

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

  async function handleExtract() {
    setExtracting(true)
    try {
      const res = await triggerExtraction(
        workspaceId,
        projectId,
        video.video_upload_id,
        frameInterval,
        manualMarks
      )
      setVideoUploadId(res.video_upload_id)
    } catch {
      setExtracting(false)
    }
  }

  useEffect(() => {
    if (progress?.status === "done") {
      onExtractionComplete(video.batch_id)
    }
  }, [progress?.status, onExtractionComplete, video.batch_id])

  return (
    <Dialog open={open} onOpenChange={extracting ? undefined : onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0 sm:max-w-2xl" showCloseButton={!extracting}>
        <DialogHeader className="border-b border-border p-5 pb-4">
          <DialogTitle className="text-base">
            Extract frames from {video.filename}{" "}
            <span className="font-normal text-muted-foreground">
              ({video.duration_label.replace(/^00:/, "")}s)
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[75vh] overflow-y-auto p-5">
          {/* Off-screen video used only to render filmstrip thumbnails onto the canvas.
              src/crossOrigin are set imperatively in the effect above, not here. */}
          <video ref={setThumbVideoEl} muted className="hidden" />
          <canvas ref={setCanvasEl} className="hidden" />

          {!extracting ? (
            <>
              <video
                ref={playerRef}
                src={video.video_url}
                controls
                className="w-full rounded-lg bg-black"
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              />

              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {formatTimestamp(currentTime)} / {formatTimestamp(video.duration)}
                </span>
                <button
                  onClick={() => setManualOpen((v) => !v)}
                  className="flex items-center gap-1 rounded-md border border-border px-2 py-1 font-medium text-foreground hover:bg-accent"
                >
                  {manualOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  {manualOpen ? "Hide" : "Show"} Manual Selection
                </button>
              </div>

              {/* Filmstrip with playhead + manual mark ticks */}
              <div className="relative mt-2 flex h-14 overflow-hidden rounded-md border border-border bg-muted">
                {filmstripStatus === "loading" ? (
                  <div className="flex w-full items-center justify-center text-xs text-muted-foreground">
                    Generating preview…
                  </div>
                ) : filmstripStatus === "unavailable" ? (
                  <div className="flex w-full items-center justify-center text-xs text-muted-foreground">
                    Preview unavailable — use the player above and the controls below to pick frames.
                  </div>
                ) : (
                  filmstrip.map((src, i) => (
                    <img key={i} src={src} className="h-full flex-1 object-cover" alt="" />
                  ))
                )}
                <div
                  className="absolute top-0 h-full w-0.5 bg-brand"
                  style={{ left: `${(currentTime / video.duration) * 100}%` }}
                />
                {manualMarks.map((m) => (
                  <div
                    key={m}
                    className="absolute top-0 h-full w-0.5 bg-amber-400"
                    style={{ left: `${(m / video.duration) * 100}%` }}
                  />
                ))}
              </div>

              {manualOpen && (
                <div className="mt-3 rounded-lg border border-border p-3">
                  <p className="mb-2 text-sm font-semibold text-foreground">Select frames to upload</p>
                  <div className="flex flex-wrap items-center gap-2">
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
                <p className="mb-3 text-sm font-semibold text-foreground">How should we sample the video?</p>
                <div className="mb-3 flex items-center justify-between text-xs">
                  {video.sampling_presets.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setFrameInterval(preset.interval)}
                      className={cn(
                        "rounded-md px-2.5 py-1.5 font-medium transition-colors",
                        Math.abs(preset.interval - frameInterval) < 1e-6
                          ? "bg-brand text-brand-foreground"
                          : "bg-muted text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <Slider
                  value={[sliderPosition]}
                  onValueChange={([v]) => setPosition(v)}
                  min={0}
                  max={100}
                  step={0.1}
                />
                <div className="mt-4 flex items-center gap-2 text-sm text-foreground">
                  Output 1 frame every
                  <Input
                    type="number"
                    step="0.1"
                    min={minInterval}
                    max={maxInterval}
                    value={frameInterval}
                    onChange={(e) =>
                      setFrameInterval(
                        Math.max(minInterval, Math.min(maxInterval, Number(e.target.value) || minInterval))
                      )
                    }
                    className="h-8 w-20"
                  />
                  seconds (
                  <Input
                    type="number"
                    min={1}
                    value={outputCount}
                    onChange={(e) => {
                      const count = Math.max(1, Number(e.target.value) || 1)
                      setFrameInterval(video.duration / count)
                    }}
                    className="h-8 w-20"
                  />
                  images)
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
              <p className="text-sm font-medium text-foreground">
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

        {!extracting && (
          <div className="flex items-center justify-between border-t border-border p-4">
            <Button variant="outline" onClick={onSkip}>
              Skip Video
            </Button>
            <Button variant="brand" onClick={handleExtract}>
              Extract {combinedCount} Frame{combinedCount !== 1 && "s"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
