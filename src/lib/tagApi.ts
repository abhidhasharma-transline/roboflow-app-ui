import { api } from "@/lib/api"

export interface ImageTag {
  id: string
  name: string
  is_active: boolean
}

export interface ImageMetadataItem {
  key: string
  value: string
}

function imageTagsBase(workspaceId: string, projectId: string, imageId: string) {
  return `/workspaces/${workspaceId}/projects/${projectId}/images/${imageId}/tags`
}

function imageMetadataBase(workspaceId: string, projectId: string, imageId: string) {
  return `/workspaces/${workspaceId}/projects/${projectId}/images/${imageId}/metadata`
}

/** All tags defined on the project (for filter dropdowns, not per-image). */
export async function listTags(workspaceId: string, projectId: string): Promise<ImageTag[]> {
  const res = await api.get<ImageTag[]>(`/workspaces/${workspaceId}/projects/${projectId}/tags`)
  return res.data
}

export async function listImageTags(
  workspaceId: string,
  projectId: string,
  imageId: string
): Promise<ImageTag[]> {
  const res = await api.get<ImageTag[]>(imageTagsBase(workspaceId, projectId, imageId))
  return res.data
}

export async function addImageTag(
  workspaceId: string,
  projectId: string,
  imageId: string,
  name: string
): Promise<ImageTag> {
  const res = await api.post<ImageTag>(imageTagsBase(workspaceId, projectId, imageId), { name })
  return res.data
}

export async function removeImageTag(
  workspaceId: string,
  projectId: string,
  imageId: string,
  tagId: string
): Promise<void> {
  await api.delete(`${imageTagsBase(workspaceId, projectId, imageId)}/${tagId}`)
}

export async function bulkApplyTags(
  workspaceId: string,
  projectId: string,
  imageIds: string[],
  tagNames: string[]
): Promise<{ tagged_images: number; tags_applied: number; links_created: number }> {
  const res = await api.post(
    `/workspaces/${workspaceId}/projects/${projectId}/tags/bulk-apply`,
    { image_ids: imageIds, tag_names: tagNames }
  )
  return res.data
}

export async function addImageMetadata(
  workspaceId: string,
  projectId: string,
  imageId: string,
  key: string,
  value: string
): Promise<ImageMetadataItem> {
  const res = await api.post<ImageMetadataItem>(imageMetadataBase(workspaceId, projectId, imageId), { key, value })
  return res.data
}

export async function removeImageMetadata(
  workspaceId: string,
  projectId: string,
  imageId: string,
  key: string
): Promise<void> {
  await api.delete(`${imageMetadataBase(workspaceId, projectId, imageId)}/${encodeURIComponent(key)}`)
}

export async function bulkApplyMetadata(
  workspaceId: string,
  projectId: string,
  imageIds: string[],
  key: string,
  value: string
): Promise<{ updated_images: number }> {
  const res = await api.post(
    `/workspaces/${workspaceId}/projects/${projectId}/images/metadata/bulk-apply`,
    { image_ids: imageIds, key, value }
  )
  return res.data
}
