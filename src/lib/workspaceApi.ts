import { api } from "@/lib/api"
import type { Workspace, WorkspaceMember } from "@/types/workspace"

export async function listWorkspaces(params?: { search?: string }): Promise<Workspace[]> {
  const res = await api.get<Workspace[]>("/workspaces", {
    params: { search: params?.search },
  })
  return res.data
}

export async function getWorkspace(workspaceId: string): Promise<Workspace> {
  const res = await api.get<Workspace>(`/workspaces/${workspaceId}`)
  return res.data
}

/** Super-admin only on the backend — a 403 here means the logged-in user isn't super_admin. */
export async function createWorkspace(name: string): Promise<Workspace> {
  const res = await api.post<Workspace>("/workspaces", { name })
  return res.data
}

export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const res = await api.get<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`)
  return res.data
}

/** Super-admin only. Throws per-email (404 if that user doesn't exist yet, 400 if already a member). */
export async function addWorkspaceMember(workspaceId: string, email: string): Promise<{ message: string }> {
  const res = await api.post<{ message: string }>(`/workspaces/${workspaceId}/members`, { email })
  return res.data
}