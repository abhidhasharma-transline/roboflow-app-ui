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

export async function renameBatch(
  workspaceId: string,
  projectId: string,
  batchId: string,
  name: string
): Promise<{ id: string; name: string }> {
  const res = await api.patch<{ id: string; name: string }>(
    `${base(workspaceId, projectId)}/${batchId}`,
    { name }
  )
  return res.data
}

export async function tagBatchImages(
  workspaceId: string,
  projectId: string,
  batchId: string,
  tagNames: string[]
): Promise<{ tagged_images: number; links_created: number }> {
  const res = await api.post(`${base(workspaceId, projectId)}/${batchId}/tags`, { tag_names: tagNames })
  return res.data
}

export async function mergeBatches(
  workspaceId: string,
  projectId: string,
  batchIds: string[]
): Promise<{ target_batch_id: string; moved_images: number }> {
  const res = await api.post(`${base(workspaceId, projectId)}/merge`, { batch_ids: batchIds })
  return res.data
}

/** Streams the batch's raw images as a zip (protected route, so a plain
 *  <a href> can't carry the auth header) and saves it client-side. */
/** Fetched as a blob (not a plain <a href> navigation) because the endpoint
 *  needs the auth header — a bare link can't carry it. The resulting blob:
 *  URL is same-origin, so link.download reliably triggers a silent save
 *  instead of the browser's "Save As" prompt (which cross-origin links, or
 *  a click fired well after the user's original gesture, can trigger). */
export async function downloadBatchImages(
  workspaceId: string,
  projectId: string,
  batchId: string,
  fallbackName: string
): Promise<void> {
  const res = await api.get(`${base(workspaceId, projectId)}/${batchId}/download`, {
    responseType: "blob",
  })
  const disposition = res.headers["content-disposition"] as string | undefined
  const match = disposition?.match(/filename="([^"]+)"/)
  const filename = match?.[1] || `${fallbackName}.zip`

  const url = URL.createObjectURL(res.data as Blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
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
    imageIds?: string[]
  }
): Promise<JobCreateResponse> {
  const res = await api.post<JobCreateResponse>(`${base(workspaceId, projectId)}/${batchId}/jobs`, {
    job_type: payload.jobType,
    instructions: payload.instructions || null,
    shuffle: payload.shuffle,
    total_images: payload.totalImages,
    assignee_ids: payload.assigneeIds,
    image_ids: payload.imageIds ?? [],
  })
  return res.data
}

export async function getJob(
  workspaceId: string,
  projectId: string,
  jobId: string,
  assignedTo?: string,
  /** Narrows the counts to one reviewer's exclusive review slice — ignored
   *  server-side for a Reviewer caller, whose own query is already forced
   *  to their own id regardless of this param. */
  reviewerId?: string
): Promise<JobDetail> {
  const res = await api.get<JobDetail>(`${jobsBase(workspaceId, projectId)}/${jobId}`, {
    params: assignedTo || reviewerId ? { assigned_to: assignedTo, reviewer_id: reviewerId } : undefined,
  })
  return res.data
}

export async function getJobImages(
  workspaceId: string,
  projectId: string,
  jobId: string,
  tab: "annotated" | "unannotated" | "all",
  paging?: { skip?: number; limit?: number },
  /** Only meaningful with tab="annotated" — see get_job_images' own docstring. */
  review?: "pending" | "approved",
  /** Narrows a shared job's full image list to one labeler's slice — ignored
   *  server-side for a Labeler caller, whose own query is already forced to
   *  their own id regardless of this param. */
  assignedTo?: string,
  /** Same idea, but for narrowing tab="annotated" to one reviewer's
   *  exclusive slice — ignored server-side for a Reviewer caller. */
  reviewerId?: string
): Promise<{ total: number; images: JobImageSummary[] }> {
  const res = await api.get<{ total: number; images: JobImageSummary[] }>(
    `${jobsBase(workspaceId, projectId)}/${jobId}/images`,
    { params: { tab, review, assigned_to: assignedTo, reviewer_id: reviewerId, ...paging } }
  )
  return res.data
}

/** The approve/reject action a reviewer takes on a job's annotated images —
 *  the piece that was missing before: "Submit for Review" could hand a job
 *  to a reviewer, but nothing could ever act on it. */
export async function reviewJobImages(
  workspaceId: string,
  projectId: string,
  jobId: string,
  imageIds: string[],
  action: "approve" | "reject",
  note?: string
): Promise<{ updated: number; action: string }> {
  const res = await api.post(`${jobsBase(workspaceId, projectId)}/${jobId}/images/review`, {
    image_ids: imageIds,
    action,
    note,
  })
  return res.data
}

export async function listJobs(
  workspaceId: string,
  projectId: string,
  status?: "active" | "completed" | "cancelled",
  stage?: "annotating" | "dataset"
): Promise<JobSummary[]> {
  const res = await api.get<JobSummary[]>(jobsBase(workspaceId, projectId), {
    params: { status, stage },
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

export async function updateJobTitle(
  workspaceId: string,
  projectId: string,
  jobId: string,
  title: string
): Promise<{ title: string }> {
  const res = await api.patch<{ title: string }>(
    `${jobsBase(workspaceId, projectId)}/${jobId}`,
    { title }
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

export async function tagJobImages(
  workspaceId: string,
  projectId: string,
  jobId: string,
  tagNames: string[]
): Promise<{ tagged_images: number; links_created: number }> {
  const res = await api.post(`${jobsBase(workspaceId, projectId)}/${jobId}/tags`, { tag_names: tagNames })
  return res.data
}

export async function moveJobToUnassigned(
  workspaceId: string,
  projectId: string,
  jobId: string
): Promise<{ moved_images: number }> {
  const res = await api.post(`${jobsBase(workspaceId, projectId)}/${jobId}/move-to-unassigned`)
  return res.data
}

export type DatasetSplitMethod = "existing" | "split" | "all_train" | "all_valid" | "all_test"

export async function addJobImagesToDataset(
  workspaceId: string,
  projectId: string,
  jobId: string,
  method: DatasetSplitMethod = "existing"
): Promise<{ job_id: string; images_added: number }> {
  const res = await api.post(`${jobsBase(workspaceId, projectId)}/${jobId}/add-to-dataset`, { method })
  return res.data
}

export async function deleteJobAnnotations(
  workspaceId: string,
  projectId: string,
  jobId: string
): Promise<{ deleted: number }> {
  const res = await api.delete(`${jobsBase(workspaceId, projectId)}/${jobId}/annotations`)
  return res.data
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
