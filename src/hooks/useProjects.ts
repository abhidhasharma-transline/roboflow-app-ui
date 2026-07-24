import { useEffect, useState } from "react"
import type { Project } from "@/types/project"
import { mockGetProjects, mockGetProject } from "@/lib/mockApi"
// import { api } from "@/lib/api" // <-- uncomment when backend is ready

export function useProjects(workspaceId: string | null) {
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!workspaceId) return
    setIsLoading(true)
    mockGetProjects(workspaceId)
      // real version: api.get(`/workspaces/${workspaceId}/projects`).then(r => r.data)
      .then(setProjects)
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false))
  }, [workspaceId])

  return { projects, isLoading, error }
}

export function useProject(projectId: string | undefined) {
  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    setIsLoading(true)
    mockGetProject(projectId)
      .then((p) => setProject(p ?? null))
      .finally(() => setIsLoading(false))
  }, [projectId])

  return { project, isLoading }
}
