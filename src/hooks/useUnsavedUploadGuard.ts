import { useEffect } from "react"
import { useUnsavedUploadStore } from "@/stores/unsavedUploadStore"
import { discardBatch } from "@/lib/uploadApi"

export function useUnsavedUploadGuard() {
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
  // our handler instead of actually leaving; if the person confirms, we undo
  // the sentinel and let the *next* Back press through for real.
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
        window.history.back()
      } else {
        window.history.pushState(null, "", window.location.href)
      }
    }

    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBatch])
}
