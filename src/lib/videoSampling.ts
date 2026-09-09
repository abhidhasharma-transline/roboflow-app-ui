import type { SamplingPreset } from "@/types/upload"

function formatIntervalLabel(seconds: number): string {
  const rounded = Math.round(seconds)
  return Number.isInteger(seconds) || Math.abs(seconds - rounded) < 0.05
    ? `1 frame every ${rounded} seconds`
    : `1 frame every ${seconds.toFixed(1)} seconds`
}

// Inclusive of both endpoints (t=0 and the last in-range grid point) —
// matches Roboflow's own displayed count. app/upload/service.py's
// _capped_count() mirrors this exactly, and app/workers/tasks.py's
// extraction explicitly grabs that trailing frame too, so this is a real
// promise, not just a display rounding. Also mirrors _capped_count()'s
// native-fps cap — a sampling rate faster than the source's own frame rate
// can't yield more real frames than the source actually has, so without
// this a preset's `count` (if ever displayed) could overpromise what
// extraction actually produces.
function inclusiveCount(duration: number, interval: number, nativeFps: number | null): number {
  if (duration <= 0 || interval <= 0) return 0
  const requested = Math.floor(duration / interval) + 1
  if (nativeFps == null) return requested
  const nativeCap = Math.floor(duration * nativeFps) + 1
  return Math.max(1, Math.min(requested, nativeCap))
}

/** Mirrors app/upload/service.py's _sampling_presets() exactly. */
export function samplingPresets(duration: number, nativeFps: number | null = null): SamplingPreset[] {
  // The slowest preset can't sample less often than "once for the whole
  // clip" — capping it at the video's own duration (instead of always 60s)
  // keeps the label meaningful for anything shorter than a minute.
  const slowestInterval = duration > 0 ? Math.min(60, duration) : 60
  return [
    { label: "60 frames/second", interval: 1 / 60, count: inclusiveCount(duration, 1 / 60, nativeFps) },
    { label: "1 frame every 1 second", interval: 1.0, count: inclusiveCount(duration, 1.0, nativeFps), default: true },
    {
      label: formatIntervalLabel(slowestInterval),
      interval: slowestInterval,
      count: Math.max(1, inclusiveCount(duration, slowestInterval, nativeFps)),
    },
  ]
}

function pad(n: number, width = 2): string {
  return String(Math.floor(n)).padStart(width, "0")
}

/** Mirrors app/upload/service.py's _fmt_duration() exactly ("MM:SS.mmm"). */
export function formatDurationLabel(seconds: number): string {
  const whole = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${pad(whole)}:${rest.toFixed(3).padStart(6, "0")}`
}