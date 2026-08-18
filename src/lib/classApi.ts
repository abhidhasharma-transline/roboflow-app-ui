import { api } from "@/lib/api"

export interface ProjectClass {
  id: string
  class_index: number
  name: string
  color: string
  is_active: boolean
}

export async function listClasses(workspaceId: string, projectId: string): Promise<ProjectClass[]> {
  const res = await api.get<ProjectClass[]>(
    `/workspaces/${workspaceId}/projects/${projectId}/classes`
  )
  return res.data
}

export async function createClass(
  workspaceId: string,
  projectId: string,
  payload: { name: string; color: string }
): Promise<ProjectClass> {
  const res = await api.post<ProjectClass>(
    `/workspaces/${workspaceId}/projects/${projectId}/classes`,
    payload
  )
  return res.data
}
