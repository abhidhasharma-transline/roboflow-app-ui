import { api } from "@/lib/api"
import type {
  BatchDetail,
  BatchSummary,
  JobActivityEntry,
  JobCreateResponse,
  JobDetail,
  JobImageSummary,
  JobReviewerSummary,
  JobSummary,
  JobType,
} from "@/types/job"

function base(workspaceId: string, projectId: string) {
  return `/workspaces/${workspaceId}/projects/${projectId}/batches`
}

function jobsBase(workspaceId: string, projectId: string) {
  return `/workspaces/${workspaceId}/projects/${projectId}/jobs`
}

export async function listBatches(
  workspaceId: string,
  projectId: string,
  status?: string
): Promise<BatchSummary[]> {
  const res = await api.get<BatchSummary[]>(base(workspaceId, projectId), {
    params: status ? { status } : undefined,
  })
  return res.data
}

export async function getBatch(
  workspaceId: string,
  projectId: string,
  batchId: string
): Promise<BatchDetail> {
  const res = await api.get<BatchDetail>(`${base(workspaceId, projectId)}/${batchId}`)
  return res.data
}

export async function createJob(
  workspaceId: string,
  projectId: string,
  batchId: string,
  payload: {
    jobType: JobType
    instructions?: string
    shuffle: boolean
    totalImages: number
    assigneeIds: string[]
  }
): Promise<JobCreateResponse> {
  const res = await api.post<JobCreateResponse>(`${base(workspaceId, projectId)}/${batchId}/jobs`, {
    job_type: payload.jobType,
    instructions: payload.instructions || null,
    shuffle: payload.shuffle,
    total_images: payload.totalImages,
    assignee_ids: payload.assigneeIds,
  })
  return res.data
}

export async function getJob(
  workspaceId: string,
  projectId: string,
  jobId: string
): Promise<JobDetail> {
  const res = await api.get<JobDetail>(`${jobsBase(workspaceId, projectId)}/${jobId}`)
  return res.data
}

export async function getJobImages(
  workspaceId: string,
  projectId: string,
  jobId: string,
  tab: "annotated" | "unannotated" | "all"
): Promise<{ images: JobImageSummary[] }> {
  const res = await api.get<{ images: JobImageSummary[] }>(
    `${jobsBase(workspaceId, projectId)}/${jobId}/images`,
    { params: { tab } }
  )
  return res.data
}

export async function listJobs(
  workspaceId: string,
  projectId: string,
  status?: "active" | "completed" | "cancelled"
): Promise<JobSummary[]> {
  const res = await api.get<JobSummary[]>(jobsBase(workspaceId, projectId), {
    params: status ? { status } : undefined,
  })
  return res.data
}

export async function updateJobInstructions(
  workspaceId: string,
  projectId: string,
  jobId: string,
  instructions: string
): Promise<{ instructions: string | null }> {
  const res = await api.patch<{ instructions: string | null }>(
    `${jobsBase(workspaceId, projectId)}/${jobId}`,
    { instructions }
  )
  return res.data
}

export async function reassignJob(
  workspaceId: string,
  projectId: string,
  jobId: string,
  payload: { assigneeIds: string[]; shuffle: boolean; instructions?: string }
): Promise<void> {
  await api.post(`${jobsBase(workspaceId, projectId)}/${jobId}/reassign`, {
    assignee_ids: payload.assigneeIds,
    shuffle: payload.shuffle,
    instructions: payload.instructions ?? null,
  })
}

export async function getJobActivity(
  workspaceId: string,
  projectId: string,
  jobId: string
): Promise<JobActivityEntry[]> {
  const res = await api.get<JobActivityEntry[]>(
    `${jobsBase(workspaceId, projectId)}/${jobId}/activity`
  )
  return res.data
}

export async function submitForReview(
  workspaceId: string,
  projectId: string,
  jobId: string,
  reviewerIds: string[]
): Promise<void> {
  await api.post(`${jobsBase(workspaceId, projectId)}/${jobId}/reviewers`, {
    reviewer_ids: reviewerIds,
  })
}

export async function listJobReviewers(
  workspaceId: string,
  projectId: string,
  jobId: string
): Promise<JobReviewerSummary[]> {
  const res = await api.get<JobReviewerSummary[]>(
    `${jobsBase(workspaceId, projectId)}/${jobId}/reviewers`
  )
  return res.data
}
