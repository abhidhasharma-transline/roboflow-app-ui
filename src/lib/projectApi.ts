import { api } from "@/lib/api"
import type {
  Project,
  ProjectFolder,
  ProjectAnnotationType,
  ProjectMember,
} from "@/types/project"

function base(workspaceId: string) {
  return `/workspaces/${workspaceId}`
}

/** folderId omitted = root-level projects only (matches the backend default). */
export async function listProjects(
  workspaceId: string,
  opts?: { folderId?: string; search?: string }
): Promise<Project[]> {
  const res = await api.get<Project[]>(`${base(workspaceId)}/projects`, {
    params: { folder_id: opts?.folderId, search: opts?.search },
  })
  return res.data
}

export async function getProject(workspaceId: string, projectId: string): Promise<Project> {
  const res = await api.get<Project>(`${base(workspaceId)}/projects/${projectId}`)
  return res.data
}

export async function createProject(
  workspaceId: string,
  payload: {
    name: string
    description?: string
    annotation_type: ProjectAnnotationType
    folder_id?: string | null
  }
): Promise<Project> {
  const res = await api.post<Project>(`${base(workspaceId)}/projects`, {
    ...payload,
    visibility: "private", // locked — no public option in this internal tool
  })
  return res.data
}

export async function listProjectMembers(
  workspaceId: string,
  projectId: string
): Promise<ProjectMember[]> {
  const res = await api.get<ProjectMember[]>(
    `${base(workspaceId)}/projects/${projectId}/members`
  )
  return res.data
}

export async function addProjectMember(
  workspaceId: string,
  projectId: string,
  userId: string,
  role: ProjectMember["role"]
): Promise<{ message: string }> {
  const res = await api.post<{ message: string }>(
    `${base(workspaceId)}/projects/${projectId}/members`,
    { user_id: userId, role }
  )
  return res.data
}

/* ---------- Folders ---------- */

export async function listFolders(workspaceId: string): Promise<ProjectFolder[]> {
  const res = await api.get<ProjectFolder[]>(`${base(workspaceId)}/folders`)
  return res.data
}

export async function getFolder(workspaceId: string, folderId: string): Promise<ProjectFolder> {
  const res = await api.get<ProjectFolder>(`${base(workspaceId)}/folders/${folderId}`)
  return res.data
}

export async function createFolder(workspaceId: string, name: string): Promise<ProjectFolder> {
  const res = await api.post<ProjectFolder>(`${base(workspaceId)}/folders`, { name })
  return res.data
}

export async function deleteFolder(workspaceId: string, folderId: string): Promise<{ message: string }> {
  const res = await api.delete<{ message: string }>(`${base(workspaceId)}/folders/${folderId}`)
  return res.data
}