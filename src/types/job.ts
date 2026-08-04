export type JobType = "self" | "team"

export interface BatchDetail {
  id: string
  name: string
  status: string
  source_type: string
  created_at: string
  unassigned_count: number
}

export interface BatchSummary {
  id: string
  name: string
  status: string
  created_at: string
  unassigned_count: number
}

export interface JobAssignmentSummary {
  user_id: string
  image_count: number
}

export interface JobCreateResponse {
  job_id: string
  title: string
  assignments: JobAssignmentSummary[]
}

export interface JobAssignmentDetail {
  user_id: string
  name: string
  email: string
  image_count: number
}

export interface JobDetail {
  id: string
  title: string
  type: JobType
  instructions: string | null
  status: string
  batch_id: string
  batch_name: string
  created_at: string
  total_images: number
  annotated_count: number
  unannotated_count: number
  assignments: JobAssignmentDetail[]
}

export interface JobImageSummary {
  id: string
  filename: string
  thumbnail_url: string | null
}
