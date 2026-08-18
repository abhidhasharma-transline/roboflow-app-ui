export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export interface Annotation {
  id: string
  imageId: string
  classId: string
  className: string
  color: string
  bbox?: BoundingBox
  polygon?: Point[]
  zIndex: number
  createdBy: string
  createdAt: string
}

export type JobStatus = "not-started" | "in-progress" | "completed"

export interface AnnotationJob {
  id: string
  projectId: string
  name: string
  assigneeId: string | null
  assigneeName: string | null
  imageCount: number
  completedCount: number
  status: JobStatus
  dueDate: string | null
  createdAt: string
}

export interface ClassLabel {
  id: string
  name: string
  color: string
  count: number
}
