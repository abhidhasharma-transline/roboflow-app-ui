import { NavLink, useNavigate, type NavLinkProps } from "react-router-dom"
import { useUnsavedUploadStore } from "@/stores/unsavedUploadStore"
import { discardBatch } from "@/lib/uploadApi"

/**
 * A drop-in replacement for react-router's NavLink that also guards
 * in-app navigation: beforeunload only fires on a real browser
 * close/refresh, not on SPA route changes triggered by clicking a
 * sidebar link — this is what catches that gap.
 */
export function GuardedNavLink(props: NavLinkProps) {
  const navigate = useNavigate()
  const { pendingBatch, clearPendingBatch } = useUnsavedUploadStore()

  return (
    <NavLink
      {...props}
      onClick={(e) => {
        if (pendingBatch) {
          e.preventDefault()
          const ok = window.confirm(
            "You have an unsaved upload batch. Leaving now will discard everything uploaded so far. Continue?"
          )
          if (!ok) return
          discardBatch(pendingBatch.workspaceId, pendingBatch.projectId, pendingBatch.batchId).catch(() => {})
          clearPendingBatch()
          // Always land on the Projects list after discarding — not
          // wherever the person happened to click toward.
          navigate("/projects")
          return
        }
        props.onClick?.(e)
      }}
    />
  )
}
