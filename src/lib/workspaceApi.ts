import { api } from "@/lib/api"
import type {
  Workspace,
  WorkspaceMember,
  WorkspaceInvitation,
  MyInvitation,
  MemberAccessPayload,
} from "@/types/workspace"

/** mineOnly forces real-membership filtering even for a super admin — use it
 *  anywhere "my own workspaces" is the intent (e.g. the profile page), as
 *  opposed to the admin-wide "every workspace on the platform" view. */
export async function listWorkspaces(opts?: { mineOnly?: boolean }): Promise<Workspace[]> {
  const res = await api.get<Workspace[]>("/workspaces", {
    params: opts?.mineOnly ? { mine_only: true } : undefined,
  })
  return res.data
}

export async function createWorkspace(name: string): Promise<Workspace> {
  const res = await api.post<Workspace>("/workspaces", { name, members: [] })
  return res.data
}

/** Super admin or the workspace owner only. Soft-delete — rejected for the
 *  auto-created personal workspace every account gets at registration. */
export async function deleteWorkspace(workspaceId: string): Promise<{ message: string }> {
  const res = await api.delete<{ message: string }>(`/workspaces/${workspaceId}`)
  return res.data
}

export async function getWorkspace(workspaceId: string): Promise<Workspace> {
  const res = await api.get<Workspace>(`/workspaces/${workspaceId}`)
  return res.data
}

export async function listWorkspaceMembers(
  workspaceId: string
): Promise<WorkspaceMember[]> {
  const res = await api.get<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`)
  return res.data
}

/** Super admin or the workspace owner only. */
export async function updateWorkspaceMember(
  workspaceId: string,
  userId: string,
  payload: Partial<MemberAccessPayload> & { full_access?: boolean }
): Promise<WorkspaceMember> {
  const res = await api.patch<WorkspaceMember>(
    `/workspaces/${workspaceId}/members/${userId}`,
    payload
  )
  return res.data
}

/** Super admin or the workspace owner only. Also revokes any per-project
 *  access they held in this workspace's projects. */
export async function removeWorkspaceMember(
  workspaceId: string,
  userId: string
): Promise<{ message: string }> {
  const res = await api.delete<{ message: string }>(
    `/workspaces/${workspaceId}/members/${userId}`
  )
  return res.data
}

/* ---------- Invitations ---------- */

export async function inviteWorkspaceMember(
  workspaceId: string,
  email: string,
  access: MemberAccessPayload
): Promise<{ message: string }> {
  const res = await api.post<{ message: string }>(
    `/workspaces/${workspaceId}/invite`,
    { email, ...access }
  )
  return res.data
}

/** Owner-only on the backend — throws 403 if the current user isn't the workspace owner. */
export async function listWorkspaceInvitations(
  workspaceId: string
): Promise<WorkspaceInvitation[]> {
  const res = await api.get<WorkspaceInvitation[]>(
    `/workspaces/${workspaceId}/invitations`
  )
  return res.data
}

/** Invitations sent *to* the current user, across all workspaces. */
export async function listMyInvitations(): Promise<MyInvitation[]> {
  const res = await api.get<MyInvitation[]>("/workspaces/my/invitations")
  return res.data
}

export async function acceptInvitation(token: string): Promise<{ message: string }> {
  const res = await api.post<{ message: string }>(`/workspaces/invitations/${token}/accept`)
  return res.data
}

export async function rejectInvitation(token: string): Promise<{ message: string }> {
  const res = await api.post<{ message: string }>(`/workspaces/invitations/${token}/reject`)
  return res.data
}

/** Owner-only on the backend. Only pending invitations can be cancelled. */
export async function cancelInvitation(invitationId: string): Promise<{ message: string }> {
  const res = await api.delete<{ message: string }>(`/workspaces/invitations/${invitationId}`)
  return res.data
}