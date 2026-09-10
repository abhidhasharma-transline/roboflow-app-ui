import { api } from "@/lib/api"

export interface ImageDetail {
  id: string
  filename: string
  width: number | null
  height: number | null
  file_size_bytes: number | null
  updated_at: string
  batch_name: string | null
  metadata: { key: string; value: string }[]
}

export async function getImage(
  workspaceId: string,
  projectId: string,
  imageId: string
): Promise<ImageDetail> {
  const res = await api.get<ImageDetail>(`/workspaces/${workspaceId}/projects/${projectId}/images/${imageId}`)
  return res.data
}

/** Just the two presigned URLs for one image — see get_job_images's own
 *  tab="all" for why the annotation tool's pager doesn't get these for
 *  free anymore and has to ask for them one image at a time instead. */
export async function getImageUrl(
  workspaceId: string,
  projectId: string,
  imageId: string
): Promise<{ url: string; thumbnail_url: string | null }> {
  const res = await api.get<{ url: string; thumbnail_url: string | null }>(
    `/workspaces/${workspaceId}/projects/${projectId}/images/${imageId}/url`
  )
  return res.data
}

/** Which job this image currently sits in, if any — throws (404) for an
 *  image that isn't in a job right now (e.g. already promoted to the
 *  dataset). Used to turn an image-scoped notification (a comment mention)
 *  into a real link into the annotation tool, which needs a job id. */
export async function getImageJob(
  workspaceId: string,
  projectId: string,
  imageId: string
): Promise<{ job_id: string }> {
  const res = await api.get<{ job_id: string }>(
    `/workspaces/${workspaceId}/projects/${projectId}/images/${imageId}/job`
  )
  return res.data
}

export interface ProjectImageAnnotation {
  shape_type: "bbox" | "polygon"
  geometry: Record<string, unknown>
  class_color: string
  class_name: string
}

export interface ProjectImageSummary {
  id: string
  filename: string
  thumbnail_url: string | null
  image_url: string | null
  status: string
  split: "train" | "valid" | "test" | null
  width: number | null
  height: number | null
  annotations: ProjectImageAnnotation[]
  tag_count: number
  is_null: boolean
}

export async function listProjectImages(
  workspaceId: string,
  projectId: string,
  params: {
    status?: string
    split?: string
    tagId?: string
    classId?: string
    search?: string
    sort?: "newest" | "oldest"
    skip?: number
    limit?: number
  } = {}
): Promise<{ total: number; items: ProjectImageSummary[] }> {
  const res = await api.get(`/workspaces/${workspaceId}/projects/${projectId}/images`, {
    params: {
      status: params.status,
      split: params.split,
      tag_id: params.tagId,
      class_id: params.classId,
      search: params.search || undefined,
      sort: params.sort,
      skip: params.skip,
      limit: params.limit,
    },
  })
  return res.data
}

export async function bulkSetSplit(
  workspaceId: string,
  projectId: string,
  imageIds: string[],
  split: "train" | "valid" | "test"
): Promise<{ updated_images: number }> {
  const res = await api.post(`/workspaces/${workspaceId}/projects/${projectId}/images/bulk-set-split`, {
    image_ids: imageIds,
    split,
  })
  return res.data
}

export async function markImagesNull(
  workspaceId: string,
  projectId: string,
  imageIds: string[]
): Promise<{ marked_null: number; annotations_removed: number }> {
  const res = await api.post(`/workspaces/${workspaceId}/projects/${projectId}/images/mark-null`, {
    image_ids: imageIds,
  })
  return res.data
}

export async function rebalanceSplit(
  workspaceId: string,
  projectId: string,
  ratios: { train_percent: number; valid_percent: number; test_percent: number } = {
    train_percent: 70,
    valid_percent: 15,
    test_percent: 15,
  }
): Promise<{ updated_images: number; train: number; valid: number; test: number }> {
  const res = await api.post(`/workspaces/${workspaceId}/projects/${projectId}/images/rebalance-split`, ratios)
  return res.data
}

export async function assignImagesForLabeling(
  workspaceId: string,
  projectId: string,
  imageIds: string[],
  assigneeIds: string[],
  options: { instructions?: string; shuffle?: boolean } = {}
): Promise<{ job_id: string; assigned_images: number }> {
  const res = await api.post(`/workspaces/${workspaceId}/projects/${projectId}/images/assign-for-labeling`, {
    image_ids: imageIds,
    assignee_ids: assigneeIds,
    instructions: options.instructions,
    shuffle: options.shuffle ?? true,
  })
  return res.data
}
