// Mirrors app/projects/schema.py (ProjectResponse) exactly.

export type ProjectVisibility = "public" | "private"

export type ProjectAnnotationType =
  | "object_detection"
  | "segmentation"
  | "classification"
  | "keypoint"

export interface Project {
  id: string
  name: string
  slug: string
  description: string | null
  visibility: ProjectVisibility
  annotation_type: ProjectAnnotationType
  folder_id: string | null
  is_active: boolean
  created_at: string
  thumbnail_url: string | null
  classes_locked: boolean
}

export interface ProjectFolder {
  id: string
  workspace_id: string
  name: string
  created_by: string
  created_at: string
  project_count: number
}

export interface ProjectMember {
  id: string
  user_id: string
  role: "admin" | "labeler" | "reviewer" | "super_admin"
  // Redacted to null by the backend for any row that isn't the requester's
  // own, unless the requester is super admin — never a peer's real overrides.
  permission_overrides: Record<string, boolean> | null
  is_owner: boolean
  // True when this member is a system-level super admin — their stored
  // project role is a vestigial value that isn't actually consulted, since
  // super admin bypasses every permission check outright.
  is_super_admin: boolean
  email: string
  username: string
  first_name?: string
  last_name?: string
}
