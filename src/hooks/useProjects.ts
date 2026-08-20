import { useEffect, useState } from "react"
import type { Project } from "@/types/project"
import { listProjects, getProject, resolveProjectWorkspace } from "@/lib/projectApi"
import { useWorkspaceStore } from "@/stores/workspaceStore"

export function useProjects(workspaceId: string | null) {
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!workspaceId) return
    setIsLoading(true)
    listProjects(workspaceId)
      .then(setProjects)
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false))
  }, [workspaceId])

  return { projects, isLoading, error }
}

/** Convenience for pages/components that only know the projectId (route param),
 *  not the workspaceId — reads the active workspace from the store.
 *
 *  Self-healing: the store's active workspace can be missing or just wrong
 *  for this specific project (fresh page load before a default is picked, a
 *  bookmarked/notification link, browser back/forward, or simply having
 *  switched workspaces earlier) — a mismatch 404s on `getProject`. Rather
 *  than surfacing that, resolve the project's real workspace directly from
 *  the route and correct the (global) store; every other project-scoped
 *  page reads the same store, so one correction here fixes them all. */
export function useProject(projectId: string | undefined) {
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace)
  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  async function refetch() {
    if (!projectId) return
    setIsLoading(true)
    try {
      if (workspaceId) {
        try {
          setProject(await getProject(workspaceId, projectId))
          return
        } catch {
          // Fall through — workspaceId may just be stale/wrong for this project.
        }
      }
      const resolved = await resolveProjectWorkspace(projectId)
      if (resolved.workspace_id !== workspaceId) {
        // Corrects the store; the effect below re-runs with the right id.
        setActiveWorkspace(resolved.workspace_id, resolved.workspace_name)
      } else {
        // Already had the right workspace and it still failed — no access, or deleted.
        setProject(null)
      }
    } catch {
      setProject(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, workspaceId])

  return { project, isLoading, refetch }
}
