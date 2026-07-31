import type { SamplingPreset } from "@/types/upload"

/** Mirrors app/upload/service.py's _sampling_presets() exactly. */
export function samplingPresets(duration: number): SamplingPreset[] {
  return [
    { label: "60 frames/second", interval: Number((1 / 60).toFixed(4)), count: Math.floor(duration * 60) },
    { label: "1 frame every 1 second", interval: 1.0, count: Math.floor(duration), default: true },
    { label: "1 frame every 60 seconds", interval: 60.0, count: Math.max(1, Math.floor(duration / 60)) },
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