import { useEffect } from "react"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { getWorkspace } from "@/lib/workspaceApi"

/** Returns the active workspace's id/name, fetching the name once if it's missing. */
export function useActiveWorkspace() {
  const { activeWorkspaceId, activeWorkspaceName, setActiveWorkspace } = useWorkspaceStore()

  useEffect(() => {
    if (!activeWorkspaceId || activeWorkspaceName) return
    getWorkspace(activeWorkspaceId)
      .then((ws) => setActiveWorkspace(ws.id, ws.name))
      .catch(() => {})
  }, [activeWorkspaceId, activeWorkspaceName, setActiveWorkspace])

  return { id: activeWorkspaceId, name: activeWorkspaceName }
}