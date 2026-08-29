import { api } from "@/lib/api"

export interface VersionSplitStat {
  count: number
  percent: number
}

export type ResizeMode =
  | "stretch"
  | "fill_center_crop"
  | "fit_within"
  | "fit_reflect"
  | "fit_black_edges"
  | "fit_white_edges"

export interface PreprocessingConfig {
  auto_orient: boolean
  resize: { mode: ResizeMode; width: number; height: number } | null
  grayscale?: boolean
  auto_contrast?: boolean
  random_sample?: boolean
}

export interface ProjectVersion {
  id: string
  name: string
  note: string | null
  image_count: number
  class_count: number
  split_ratio: Record<"train" | "valid" | "test", VersionSplitStat> | null
  preprocessing: PreprocessingConfig | null
  augmentations: Record<string, { label: string }> | null
  created_at: string
  created_by_name: string | null
}

export interface VersionImageAnnotation {
  shape_type: "bbox" | "polygon"
  geometry: Record<string, unknown>
  class_color: string
  class_name: string
}

export interface VersionImageSummary {
  id: string
  filename: string
  thumbnail_url: string | null
  image_url: string | null
  split: "train" | "valid" | "test"
  annotations: VersionImageAnnotation[]
}

export async function listVersions(workspaceId: string, projectId: string): Promise<ProjectVersion[]> {
  const res = await api.get<ProjectVersion[]>(`/workspaces/${workspaceId}/projects/${projectId}/versions`)
  return res.data
}

export async function createVersion(
  workspaceId: string,
  projectId: string,
  payload: {
    name: string
    note?: string
    preprocessing?: PreprocessingConfig
    augmentations?: Record<string, { label: string }>
  }
): Promise<ProjectVersion> {
  const res = await api.post<ProjectVersion>(`/workspaces/${workspaceId}/projects/${projectId}/versions`, payload)
  return res.data
}

export async function renameVersion(
  workspaceId: string,
  projectId: string,
  versionId: string,
  name: string
): Promise<ProjectVersion> {
  const res = await api.patch<ProjectVersion>(
    `/workspaces/${workspaceId}/projects/${projectId}/versions/${versionId}`,
    { name }
  )
  return res.data
}

export async function deleteVersion(workspaceId: string, projectId: string, versionId: string): Promise<void> {
  await api.delete(`/workspaces/${workspaceId}/projects/${projectId}/versions/${versionId}`)
}

export async function listTrashedVersions(workspaceId: string, projectId: string): Promise<ProjectVersion[]> {
  const res = await api.get<ProjectVersion[]>(`/workspaces/${workspaceId}/projects/${projectId}/versions/trash`)
  return res.data
}

export async function restoreVersion(
  workspaceId: string,
  projectId: string,
  versionId: string
): Promise<ProjectVersion> {
  const res = await api.post<ProjectVersion>(
    `/workspaces/${workspaceId}/projects/${projectId}/versions/${versionId}/restore`
  )
  return res.data
}

export async function getVersionImages(
  workspaceId: string,
  projectId: string,
  versionId: string
): Promise<{ total: number; items: VersionImageSummary[] }> {
  const res = await api.get(`/workspaces/${workspaceId}/projects/${projectId}/versions/${versionId}/images`)
  return res.data
}

export async function exportVersionYolo(
  workspaceId: string,
  projectId: string,
  versionId: string
): Promise<Blob> {
  const res = await api.get(
    `/workspaces/${workspaceId}/projects/${projectId}/versions/${versionId}/export/yolo`,
    { responseType: "blob" }
  )
  return res.data
}
