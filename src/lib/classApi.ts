import { api } from "@/lib/api"

export interface ProjectClass {
  id: string
  class_index: number
  name: string
  color: string
  is_active: boolean
  annotation_count: number
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

export async function updateClass(
  workspaceId: string,
  projectId: string,
  classId: string,
  payload: { name?: string; color?: string }
): Promise<ProjectClass> {
  const res = await api.patch<ProjectClass>(
    `/workspaces/${workspaceId}/projects/${projectId}/classes/${classId}`,
    payload
  )
  return res.data
}

export async function deleteClass(workspaceId: string, projectId: string, classId: string): Promise<void> {
  await api.delete(`/workspaces/${workspaceId}/projects/${projectId}/classes/${classId}`)
}

/** The annotation tool's inline "type a new class name while drawing" flow —
 *  rejected with a 400 when the project has Lock Classes enabled, unlike
 *  createClass() above (explicit management, never blocked). */
export async function quickCreateClass(
  workspaceId: string,
  projectId: string,
  payload: { name: string; color: string }
): Promise<ProjectClass> {
  const res = await api.post<ProjectClass>(
    `/workspaces/${workspaceId}/projects/${projectId}/classes/quick-create`,
    payload
  )
  return res.data
}

export async function setClassesLocked(
  workspaceId: string,
  projectId: string,
  locked: boolean
): Promise<{ classes_locked: boolean }> {
  const res = await api.patch(`/workspaces/${workspaceId}/projects/${projectId}/classes/lock`, { locked })
  return res.data
}
