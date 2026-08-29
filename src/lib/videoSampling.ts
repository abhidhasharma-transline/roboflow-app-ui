import type { SamplingPreset } from "@/types/upload"

function formatIntervalLabel(seconds: number): string {
  const rounded = Math.round(seconds)
  return Number.isInteger(seconds) || Math.abs(seconds - rounded) < 0.05
    ? `1 frame every ${rounded} seconds`
    : `1 frame every ${seconds.toFixed(1)} seconds`
}

/** Mirrors app/upload/service.py's _sampling_presets() exactly. */
export function samplingPresets(duration: number): SamplingPreset[] {
  // The slowest preset can't sample less often than "once for the whole
  // clip" — capping it at the video's own duration (instead of always 60s)
  // keeps the label meaningful for anything shorter than a minute.
  const slowestInterval = duration > 0 ? Math.min(60, duration) : 60
  return [
    { label: "60 frames/second", interval: 1 / 60, count: Math.floor(duration * 60) },
    { label: "1 frame every 1 second", interval: 1.0, count: Math.floor(duration), default: true },
    {
      label: formatIntervalLabel(slowestInterval),
      interval: slowestInterval,
      count: Math.max(1, Math.floor(duration / slowestInterval)),
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