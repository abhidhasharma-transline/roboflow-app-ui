// Mirrors app/user/schema.py exactly.

// System-level role — only ever "super_admin" or null (a regular account).
// ADMIN/LABELER/REVIEWER are workspace/project-scoped now, see WorkspaceRole
// in types/workspace.ts, not this.
export type SystemRole = "super_admin"

// Workspace/project-scoped role — see app/core/permissions.py.
export type WorkspaceRole = "admin" | "labeler" | "reviewer"

// Kept for spots that display a role generically regardless of which of the
// two above it came from (e.g. a shared role-label lookup).
export type UserRole = SystemRole | WorkspaceRole

export interface User {
  id: string
  email: string
  username: string
  role: SystemRole | null
  // Nullable — a provisioned-but-not-fully-set-up account (or one created
  // directly rather than through a flow that requires a name) can genuinely
  // have neither set. fullName()/initials() in lib/userDisplay.ts already
  // fall back to the username for exactly this case.
  first_name: string | null
  last_name: string | null
  phone: string | null
  avatar_url: string | null
  is_active: boolean
  is_activated: boolean
  // Which Super Admin provisioned this account (POST /auth/users) — null
  // for the one bootstrap super_admin who self-registered. Resolve to a
  // name client-side by looking this id up in the same user list.
  created_by: string | null
  created_at: string
}

export interface LoginRequest {
  /** Email or username — the backend tries both columns. */
  identifier: string
  password: string
}

export interface RegisterRequest {
  first_name: string
  last_name: string
  email: string
  username: string
  password: string
}

export interface CreateUserRequest {
  email: string
  first_name: string
  last_name: string
  is_super_admin: boolean
}

// The user picks their own username when they activate the account SA created for them.
export interface ActivateAccountRequest {
  username: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: User
}

export interface UpdateProfileRequest {
  first_name: string
  last_name: string
  phone: string | null
}

export interface ChangePasswordRequest {
  current_password: string
  new_password: string
}

export interface ActivityActionGroup {
  action: string
  count: number
}

export interface ActivityDay {
  date: string   // YYYY-MM-DD
  count: number                  // true total, uncapped
  actions: ActivityActionGroup[] // grouped by action text, capped server-side
}