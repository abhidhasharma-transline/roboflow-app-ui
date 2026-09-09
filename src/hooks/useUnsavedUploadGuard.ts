import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useUnsavedUploadStore } from "@/stores/unsavedUploadStore"
import { discardBatch } from "@/lib/uploadApi"

export function useUnsavedUploadGuard() {
  const navigate = useNavigate()
  const pendingBatch = useUnsavedUploadStore((s) => s.pendingBatch)
  const clearPendingBatch = useUnsavedUploadStore((s) => s.clearPendingBatch)

  // Real browser close/refresh/typed-URL navigation.
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (!pendingBatch) return
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [pendingBatch])

  // Browser Back/Forward button or gesture. This is an in-app route change
  // (popstate), not a real page unload, so beforeunload never fires for it —
  // and it bypasses GuardedNavLink too, since nothing was clicked inside the
  // app. We push a sentinel history entry so the first Back press lands on
  // our handler instead of actually leaving.
  useEffect(() => {
    if (!pendingBatch) return

    window.history.pushState(null, "", window.location.href)

    function onPopState() {
      const ok = window.confirm(
        "You have an unsaved upload batch. Leaving now will discard everything uploaded so far. Continue?"
      )
      if (ok) {
        discardBatch(pendingBatch!.workspaceId, pendingBatch!.projectId, pendingBatch!.batchId).catch(() => {})
        clearPendingBatch()
        // A second window.history.back() here (to undo the sentinel and let
        // the "real" Back through) assumes there's always a prior SPA entry
        // to land on — false whenever this upload page was the first entry
        // in the tab's session (a direct load or a refresh), in which case
        // it's a no-op: the URL never changes, the route never remounts, and
        // the person is left staring at the just-discarded batch's stale
        // grid. Navigating explicitly is unconditional either way, and
        // matches how every other discard path (GuardedNavLink, the in-page
        // "Discard and back to Projects" button) already leaves this page.
        navigate("/projects", { replace: true })
      } else {
        window.history.pushState(null, "", window.location.href)
      }
    }

    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBatch])
}
