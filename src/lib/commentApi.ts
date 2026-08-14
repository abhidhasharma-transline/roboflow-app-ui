import { api } from "@/lib/api"

export interface ImageComment {
  id: string
  x: number
  y: number
  text: string
  created_by: string
  author_name: string | null
  created_at: string
}

function base(workspaceId: string, projectId: string, imageId: string) {
  return `/workspaces/${workspaceId}/projects/${projectId}/images/${imageId}/comments`
}

export async function listComments(
  workspaceId: string,
  projectId: string,
  imageId: string
): Promise<ImageComment[]> {
  const res = await api.get<ImageComment[]>(base(workspaceId, projectId, imageId))
  return res.data
}

export async function createComment(
  workspaceId: string,
  projectId: string,
  imageId: string,
  payload: { x: number; y: number; text: string }
): Promise<ImageComment> {
  const res = await api.post<ImageComment>(base(workspaceId, projectId, imageId), payload)
  return res.data
}

export async function deleteComment(
  workspaceId: string,
  projectId: string,
  imageId: string,
  commentId: string
): Promise<void> {
  await api.delete(`${base(workspaceId, projectId, imageId)}/${commentId}`)
}

export interface ImageHistoryEntry {
  id: string
  action: string
  user_name: string | null
  created_at: string
}

export async function getImageHistory(
  workspaceId: string,
  projectId: string,
  imageId: string
): Promise<ImageHistoryEntry[]> {
  const res = await api.get<ImageHistoryEntry[]>(
    `/workspaces/${workspaceId}/projects/${projectId}/images/${imageId}/history`
  )
  return res.data
}
