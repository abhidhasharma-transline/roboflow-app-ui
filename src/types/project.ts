export type ProjectType =
  | "object-detection"
  | "classification"
  | "segmentation"
  | "keypoint-detection"

export interface Workspace {
  id: string
  name: string
  slug: string
  memberCount: number
  planTier: "free" | "starter" | "enterprise"
  createdAt: string
}

export interface Project {
  id: string
  workspaceId: string
  name: string
  type: ProjectType
  imageCount: number
  annotatedCount: number
  classCount: number
  modelCount: number
  isPublic: boolean
  thumbnailUrl: string | null
  createdAt: string
  updatedAt: string
}