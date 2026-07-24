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
      } catch {
        // Keep polling — a transient network blip shouldn't stop the fallback.
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