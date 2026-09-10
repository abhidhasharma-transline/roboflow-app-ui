// Mirrors app/workspace/schema.py.
import type { WorkspaceRole } from "@/types/auth"

export interface Workspace {
  id: string
  name: string
  slug: string
  owner_id: string
  is_active: boolean
  // The one workspace every account gets automatically at activation — it
  // can't be deleted by anyone, super admin included (see delete_workspace
  // on the backend), so the Delete action should never be offered for one.
  is_personal: boolean
  created_at: string
}

export interface WorkspaceMember {
  id: string
  user_id: string
  email: string
  username: string
  first_name?: string
  last_name?: string
  role: WorkspaceRole
  permission_overrides: Record<string, boolean> | null
  has_full_project_access: boolean
  // True when this member is a system-level super admin — their stored
  // workspace role/has_full_project_access are vestigial and never actually
  // consulted, since super admin bypasses every permission check outright.
  is_super_admin: boolean
  joined_at: string
}

export type InvitationStatus = "pending" | "accepted" | "rejected" | "expired"

// Mirrors WorkspaceInvitationResponse — a workspace's outgoing invitations
// (used on the owner's Team Members page, "Pending" list).
export interface WorkspaceInvitation {
  id: string
  email: string
  status: InvitationStatus
  role: WorkspaceRole
  invited_by: string
  created_at: string
  expires_at: string
}

// Mirrors MyInvitationResponse — invitations *sent to* the current user,
// waiting for them to accept/reject.
export interface MyInvitation {
  id: string
  workspace_id: string
  workspace_name: string
  invited_by: string
  invited_by_name: string
  role: WorkspaceRole
  token: string
  created_at: string
  expires_at: string
}

// Payload shape shared by "invite a member" and "edit an existing member" —
// mirrors app/workspace/schema.py's InviteMemberRequest / the PATCH member body.
export interface MemberAccessPayload {
  role: WorkspaceRole
  permissions: Record<string, boolean> | null
  project_ids: string[] | null
}
