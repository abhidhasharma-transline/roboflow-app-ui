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
