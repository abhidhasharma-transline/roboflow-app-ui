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
// The server closes with this code specifically for an invalid/expired
// token (see app/annotations/route.py's annotations_live) — retrying that
// would just hit the same rejection forever, so it's the one close reason
// that should NOT trigger a reconnect attempt.
const AUTH_FAILURE_CLOSE_CODE = 4401
const RECONNECT_BASE_DELAY_MS = 500
const RECONNECT_MAX_DELAY_MS = 10000

function buildWsUrl(path: string, token: string) {
  const httpBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1"
  const wsBase = httpBase.replace(/^http/, "ws")
  return `${wsBase}${path}?token=${encodeURIComponent(token)}`
}

/** Real-time relay for one image's annotations — created/updated/deleted events
 *  from other users' REST writes, plus ephemeral drag-preview + lock state.
 *  Persistence itself always goes through annotationApi.ts (REST); this socket
 *  never writes to Postgres.
 *
 *  Reconnects automatically (exponential backoff, capped) on any drop that
 *  isn't an auth failure — previously a network blip or server restart
 *  silently killed live updates for the rest of the session, with no way
 *  back short of switching images or reloading the page. */
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
  const [connected, setConnected] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const heldLocksRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!workspaceId || !projectId || !imageId || !token) return

    let cancelled = false
    let reconnectAttempt = 0
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const path = `/workspaces/${workspaceId}/projects/${projectId}/images/${imageId}/annotations/live`

    function connect() {
      if (cancelled) return
      const socket = new WebSocket(buildWsUrl(path, token!))
      wsRef.current = socket
      // A fresh connection starts with zero locks held server-side too
      // (the server tracks "held by THIS connection"), so any bookkeeping
      // from a previous connection is meaningless now.
      heldLocksRef.current = new Set()
      setRemoteDrafts({})
      setLocks({})

      socket.onopen = () => {
        if (cancelled) return
        reconnectAttempt = 0
        setConnected(true)
      }

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
          case "lock_denied":
            // A request we sent was rejected — someone else already holds
            // it. We never actually held it, so drop it from our own
            // bookkeeping (otherwise the heartbeat loop below would keep
            // renewing a lock that was never ours) and reflect the real
            // owner immediately rather than waiting on a stale UI state.
            heldLocksRef.current.delete(msg.annotation_id)
            setLocks((prev) => ({
              ...prev,
              [msg.annotation_id]: { userId: msg.user_id, userName: msg.user_name },
            }))
            break
        }
      }

      socket.onclose = (event) => {
        if (wsRef.current === socket) wsRef.current = null
        setConnected(false)
        if (cancelled || event.code === AUTH_FAILURE_CLOSE_CODE) return
        const delay = Math.min(RECONNECT_MAX_DELAY_MS, RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempt)
        reconnectAttempt += 1
        reconnectTimer = setTimeout(connect, delay)
      }

      socket.onerror = () => {
        // onclose always follows onerror for a WebSocket — the actual
        // reconnect scheduling happens there, this just surfaces sooner.
        socket.close()
      }
    }

    connect()

    const heartbeat = window.setInterval(() => {
      const socket = wsRef.current
      if (socket?.readyState !== WebSocket.OPEN) return
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
      cancelled = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      window.clearInterval(heartbeat)
      window.clearInterval(pruneDrafts)
      const socket = wsRef.current
      if (socket) {
        if (socket.readyState === WebSocket.OPEN) {
          for (const id of heldLocksRef.current) {
            socket.send(JSON.stringify({ type: "lock_release", annotation_id: id }))
          }
        }
        socket.onclose = null // this is a deliberate unmount, not a drop — don't reconnect
        socket.close()
      }
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

  return { remoteDrafts, locks, connected, sendDragPreview, acquireLock, releaseLock }
}
