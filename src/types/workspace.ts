// Mirrors app/workspace/schema.py.
//
// NOTE: the backend's WorkspaceResponse currently only returns
// { id, is_active, created_at } — no name/slug/owner_id. name/slug are kept
// here as optional so the UI can show them the moment the backend adds them
// back (recommended — MyInvitationResponse.workspace_name already implies
// the Workspace model has a name column, it's just not exposed on this
// response yet).
export interface Workspace {
  id: string
  name?: string
  slug?: string
  owner_id?: string
  is_active: boolean
  created_at: string
}

export interface WorkspaceMember {
  id: string
  user_id: string
  email: string
  username: string
  first_name?: string
  last_name?: string
  joined_at: string
}

export type InvitationStatus = "pending" | "accepted" | "rejected" | "expired"

// Mirrors WorkspaceInvitationResponse — a workspace's outgoing invitations
// (used on the owner's Team Members page, "Pending" list).
export interface WorkspaceInvitation {
  id: string
  email: string
  status: InvitationStatus
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
  token: string
  created_at: string
  expires_at: string
}
