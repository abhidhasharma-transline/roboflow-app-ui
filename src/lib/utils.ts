import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
