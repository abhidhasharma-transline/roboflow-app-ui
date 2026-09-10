import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { listNotifications, markNotificationRead } from "@/lib/notificationApi"
import { resolveNotificationPath } from "@/lib/notificationNav"
import { useNotificationStore } from "@/stores/notificationStore"
import { useToastStore } from "@/stores/toastStore"
import { useWorkspaceStore } from "@/stores/workspaceStore"

// How often to check for brand-new notifications while the app is open —
// separate from IconRail's own (slower) unread-count poll, since a review
// request landing on your desk is worth surfacing sooner than the sidebar
// dot alone does. Mounted once in AppShell, so it's alive on every
// authenticated page, project pages (job/annotation tool) included — that's
// exactly where a reviewer is likely sitting when the notification arrives.
const POLL_MS = 20_000

/** Renders nothing — just watches for unread notifications that showed up
 * since the last check and floats a toast for each one, with a "View"
 * action that jumps straight to it (same resolution NotificationsPage uses
 * for a click). The very first poll after mount only establishes a
 * baseline — it never toasts a backlog of pre-existing unread notifications
 * that were simply sitting there before this tab was opened. */
export function NotificationToastBridge() {
  const navigate = useNavigate()
  const addToast = useToastStore((s) => s.addToast)
  const refetchUnreadCount = useNotificationStore((s) => s.refetchUnreadCount)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const seenIds = useRef<Set<string> | null>(null)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      let unread
      try {
        unread = await listNotifications(true)
      } catch {
        return
      }
      if (cancelled) return

      if (seenIds.current === null) {
        // First run: remember what's already sitting there, don't toast it.
        seenIds.current = new Set(unread.map((n) => n.id))
        return
      }

      const fresh = unread.filter((n) => !seenIds.current!.has(n.id))
      for (const n of fresh) {
        seenIds.current.add(n.id)
        addToast({
          variant: "success",
          title: n.title,
          description: n.message ?? undefined,
          actionLabel: n.project_id ? "View" : undefined,
          onAction: n.project_id
            ? () => {
                void (async () => {
                  try {
                    await markNotificationRead(n.id)
                    refetchUnreadCount()
                  } catch {
                    // Non-fatal — the bell's own list still shows it unread.
                  }
                  if (n.workspace_id && n.workspace_id !== activeWorkspaceId) {
                    useWorkspaceStore.getState().setActiveWorkspace(n.workspace_id)
                  }
                  const path = await resolveNotificationPath(n, activeWorkspaceId)
                  if (path) navigate(path)
                })()
              }
            : undefined,
        })
      }
      if (fresh.length > 0) refetchUnreadCount()
    }

    poll()
    const interval = setInterval(poll, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
    // activeWorkspaceId intentionally excluded — re-subscribing per
    // workspace switch would re-baseline seenIds and could re-toast
    // cross-workspace notifications that arrived during the switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addToast, navigate, refetchUnreadCount])

  return null
}
