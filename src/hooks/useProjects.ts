import { useEffect, useState } from "react"
import type { Project } from "@/types/project"
import { listProjects, getProject } from "@/lib/projectApi"
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
 *  not the workspaceId — reads the active workspace from the store. */
export function useProject(projectId: string | undefined) {
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!projectId || !workspaceId) return
    setIsLoading(true)
    getProject(workspaceId, projectId)
      .then(setProject)
      .catch(() => setProject(null))
      .finally(() => setIsLoading(false))
  }, [projectId, workspaceId])

  return { project, isLoading }
}