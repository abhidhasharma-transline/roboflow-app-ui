import { useEffect, useRef } from "react"
import { listWorkspaces } from "@/lib/workspaceApi"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useAuthStore } from "@/stores/authStore"

/**
 * Ensures an active workspace is set as soon as we know who's logged in —
 * defaulting to the workspace the user owns (every account gets one
 * automatically at registration), not whichever workspace happens to be
 * first in the list. Runs once per login/session; does nothing if a
 * workspace is already active (e.g. the user just switched manually).
 */
export function useDefaultWorkspace() {
  const user = useAuthStore((s) => s.user)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace)
  const attempted = useRef(false)

  useEffect(() => {
    if (!user || activeWorkspaceId || attempted.current) return
    attempted.current = true

    listWorkspaces()
      .then((workspaces) => {
        if (workspaces.length === 0) return
        const owned = workspaces.find((w) => w.owner_id === user.id)
        const target = owned ?? workspaces[0]
        setActiveWorkspace(target.id, target.name)
      })
      .catch(() => {
        // Silent — pages that need a workspace already show their own
        // "no active workspace" fallback state.
      })
  }, [user, activeWorkspaceId, setActiveWorkspace])
}