import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Builds a download filename like "Project Name.yolov8.zip" (Roboflow's
 *  convention) from arbitrary parts — strips characters Windows/macOS/Linux
 *  all reject in filenames, but otherwise leaves spaces/casing alone. */
export function exportFilename(parts: (string | null | undefined)[], extension: string): string {
  const safeParts = parts
    .filter((p): p is string => !!p && p.trim().length > 0)
    .map((p) => p.trim().replace(/[\\/:*?"<>|]/g, ""))
  return `${safeParts.join(".")}.${extension}`
}

/** Pulls a FastAPI `detail` message out of an axios error, falling back to
 *  a generic message when the response isn't shaped like one (network
 *  failure, unexpected 500, etc.) — so a specific backend validation
 *  message (e.g. "nothing to move back to unassigned") reaches the user
 *  instead of being swallowed into "please try again". */
export function extractErrorMessage(err: unknown, fallback = "Something went wrong — please try again."): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const resp = (err as { response?: { data?: { detail?: unknown } } }).response
    const detail = resp?.data?.detail
    if (typeof detail === "string") return detail
  }
  return fallback
}
