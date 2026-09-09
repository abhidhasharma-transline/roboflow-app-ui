import { useCallback, useEffect, useRef, useState } from "react"
import { extractionSocketUrl, fetchExtractionStatus } from "@/lib/uploadApi"
import type { ExtractionProgress } from "@/types/upload"

const POLL_INTERVAL_MS = 2000

export function useExtractionProgress(
  workspaceId: string | null,
  projectId: string | undefined,
  videoUploadId: string | null
) {
  const [progress, setProgress] = useState<ExtractionProgress | null>(null)
  const progressRef = useRef<ExtractionProgress | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    progressRef.current = progress
  }, [progress])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const startPolling = useCallback(() => {
    if (!workspaceId || !projectId || !videoUploadId || pollRef.current) return
    pollRef.current = setInterval(async () => {
      try {
        const data = await fetchExtractionStatus(workspaceId, projectId, videoUploadId)
        setProgress(data)
        if (data.status === "done" || data.status === "failed") stopPolling()
      } catch (err) {
        // A 404 ("Video upload not found") is never transient — that row is
        // gone (discarded, or this ID was stale to begin with) and will
        // never start existing again, so retrying it every 2s forever was
        // pure noise that also left the UI looking permanently stuck rather
        // than surfacing a real error. Anything else (network blip, 5xx)
        // is worth retrying, since the fallback's whole point is riding out
        // exactly that kind of transient failure.
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status === 404) {
          stopPolling()
          setProgress({ status: "failed", percent: 0, message: "Lost track of this upload — please try again." })
        }
      }
    }, POLL_INTERVAL_MS)
  }, [workspaceId, projectId, videoUploadId, stopPolling])

  useEffect(() => {
    if (!workspaceId || !projectId || !videoUploadId) return

    setProgress({ status: "processing", percent: 0, message: "Starting extraction…" })

    const url = extractionSocketUrl(workspaceId, projectId, videoUploadId)
    const ws = new WebSocket(url)

    ws.onmessage = (event) => {
      try {
        const data: ExtractionProgress = JSON.parse(event.data)
        setProgress(data)
        if (data.status === "done" || data.status === "failed") {
          stopPolling()
          ws.close()
        }
      } catch {
        // ignore malformed frame
      }
    }

    ws.onerror = () => {
      // Socket-level failure (proxy blocked it, etc.) — fall back to polling
      // immediately rather than waiting for onclose.
      startPolling()
    }

    ws.onclose = (event) => {
      // A clean close after a terminal state is expected, not a failure.
      const isTerminal =
        progressRef.current?.status === "done" || progressRef.current?.status === "failed"
      if (!isTerminal && event.code !== 1000) {
        startPolling()
      }
    }

    return () => {
      ws.close()
      stopPolling()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, projectId, videoUploadId])

  return { progress }
}