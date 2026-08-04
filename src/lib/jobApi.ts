import { api } from "@/lib/api"
import type {
  BatchDetail,
  BatchSummary,
  JobCreateResponse,
  JobDetail,
  JobImageSummary,
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
  tab: "annotated" | "unannotated"
): Promise<{ images: JobImageSummary[] }> {
  const res = await api.get<{ images: JobImageSummary[] }>(
    `${jobsBase(workspaceId, projectId)}/${jobId}/images`,
    { params: { tab } }
  )
  return res.data
}
