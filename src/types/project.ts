export type ProjectType =
  | "object-detection"
  | "classification"
  | "segmentation"
  | "keypoint-detection"

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