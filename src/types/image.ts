export type ImageStatus = "unassigned" | "annotating" | "dataset"

export interface ImageItem {
  id: string
  projectId: string
  batchId: string | null
  url: string
  thumbnailUrl: string
  status: ImageStatus
  width: number
  height: number
  fileName: string
  annotationCount: number
  uploadedAt: string
}

export interface Batch {
  id: string
  projectId: string
  name: string
  imageCount: number
  source: "upload" | "video-extraction" | "api"
  createdAt: string
}
