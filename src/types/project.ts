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
  permission_overrides: Record<string, boolean> | null
  email: string
  username: string
  first_name?: string
  last_name?: string
}
