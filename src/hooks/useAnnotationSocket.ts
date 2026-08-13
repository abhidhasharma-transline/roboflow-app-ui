import { useCallback, useEffect, useRef, useState } from "react"
import { useAuthStore } from "@/stores/authStore"
import { useAnnotationStore } from "@/stores/annotationStore"
import { toStoreAnnotation, type AnnotationRecord } from "@/lib/annotationApi"

export interface RemoteDraft {
  userId: string
  userName: string
  shapeType: "bbox" | "polygon"
  geometry: Record<string, unknown>
  tempId: string
  receivedAt: number
}

export interface LockInfo {
  userId: string
  userName: string
}

const HEARTBEAT_INTERVAL_MS = 8000
// Drag previews aren't correlated to a "finished drawing" event, so a stale
// one (drawer paused, navigated away, or disconnected) is pruned client-side
// instead of waiting on an explicit "stopped drawing" message.
const DRAFT_STALE_MS = 2000
const DRAFT_PRUNE_INTERVAL_MS = 1000

function buildWsUrl(path: string, token: string) {
  const httpBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1"
  const wsBase = httpBase.replace(/^http/, "ws")
  return `${wsBase}${path}?token=${encodeURIComponent(token)}`
}

/** Real-time relay for one image's annotations — created/updated/deleted events
 *  from other users' REST writes, plus ephemeral drag-preview + lock state.
 *  Persistence itself always goes through annotationApi.ts (REST); this socket
 *  never writes to Postgres. */
export function useAnnotationSocket(
  workspaceId: string | undefined,
  projectId: string | undefined,
  imageId: string | undefined,
  currentUserId?: string
) {
  const token = useAuthStore((s) => s.token)
  const upsertAnnotation = useAnnotationStore((s) => s.upsertAnnotation)
  const removeAnnotation = useAnnotationStore((s) => s.removeAnnotation)

  const [remoteDrafts, setRemoteDrafts] = useState<Record<string, RemoteDraft>>({})
  const [locks, setLocks] = useState<Record<string, LockInfo>>({})

  const wsRef = useRef<WebSocket | null>(null)
  const heldLocksRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!workspaceId || !projectId || !imageId || !token) return

    const path = `/workspaces/${workspaceId}/projects/${projectId}/images/${imageId}/annotations/live`
    const socket = new WebSocket(buildWsUrl(path, token))
    wsRef.current = socket
    heldLocksRef.current = new Set()
    setRemoteDrafts({})
    setLocks({})

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      switch (msg.type) {
        case "created":
        case "updated":
          upsertAnnotation(toStoreAnnotation(msg.annotation as AnnotationRecord))
          break
        case "deleted":
          removeAnnotation(msg.annotation_id)
          break
        case "drag_preview":
          // The relay echoes to every connected client on this image, including
          // the sender — don't show your own live draft back to yourself.
          if (msg.user_id === currentUserId) break
          setRemoteDrafts((prev) => ({
            ...prev,
            [msg.temp_id]: {
              userId: msg.user_id,
              userName: msg.user_name,
              shapeType: msg.shape_type,
              geometry: msg.geometry,
              tempId: msg.temp_id,
              receivedAt: Date.now(),
            },
          }))
          break
        case "lock_acquired":
          setLocks((prev) => ({
            ...prev,
            [msg.annotation_id]: { userId: msg.user_id, userName: msg.user_name },
          }))
          break
        case "lock_released":
          setLocks((prev) => {
            const next = { ...prev }
            delete next[msg.annotation_id]
            return next
          })
          break
      }
    }

    const heartbeat = window.setInterval(() => {
      if (socket.readyState !== WebSocket.OPEN) return
      for (const id of heldLocksRef.current) {
        socket.send(JSON.stringify({ type: "lock_heartbeat", annotation_id: id }))
      }
    }, HEARTBEAT_INTERVAL_MS)

    const pruneDrafts = window.setInterval(() => {
      const cutoff = Date.now() - DRAFT_STALE_MS
      setRemoteDrafts((prev) => {
        const next: Record<string, RemoteDraft> = {}
        let changed = false
        for (const [id, draft] of Object.entries(prev)) {
          if (draft.receivedAt >= cutoff) {
            next[id] = draft
          } else {
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, DRAFT_PRUNE_INTERVAL_MS)

    return () => {
      window.clearInterval(heartbeat)
      window.clearInterval(pruneDrafts)
      if (socket.readyState === WebSocket.OPEN) {
        for (const id of heldLocksRef.current) {
          socket.send(JSON.stringify({ type: "lock_release", annotation_id: id }))
        }
      }
      socket.close()
      wsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, projectId, imageId, token, currentUserId])

  const sendDragPreview = useCallback(
    (shapeType: "bbox" | "polygon", geometry: Record<string, unknown>, tempId: string) => {
      const socket = wsRef.current
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "drag_preview", shape_type: shapeType, geometry, temp_id: tempId }))
      }
    },
    []
  )

  const acquireLock = useCallback((annotationId: string) => {
    heldLocksRef.current.add(annotationId)
    const socket = wsRef.current
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "lock_acquire", annotation_id: annotationId }))
    }
  }, [])

  const releaseLock = useCallback((annotationId: string) => {
    heldLocksRef.current.delete(annotationId)
    const socket = wsRef.current
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "lock_release", annotation_id: annotationId }))
    }
  }, [])

  return { remoteDrafts, locks, sendDragPreview, acquireLock, releaseLock }
}
