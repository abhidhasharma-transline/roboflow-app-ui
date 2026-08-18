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
  status: string
  split: "train" | "valid" | "test" | null
  width: number | null
  height: number | null
  is_duplicate: boolean
  annotations: ProjectImageAnnotation[]
  tag_count: number
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
