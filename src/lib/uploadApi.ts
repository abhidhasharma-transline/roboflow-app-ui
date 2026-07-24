import { api } from "@/lib/api"
import type {
  UploadImagesResponse,
  VideoInitiateResponse,
  TriggerExtractionResponse,
  ExtractionProgress,
  BatchPreviewResponse,
  BatchPreviewTab,
  SaveBatchResponse,
} from "@/types/upload"

function uploadBase(workspaceId: string, projectId: string) {
  return `/workspaces/${workspaceId}/projects/${projectId}/upload`
}

/** POST /upload/images — handles both "Select Files" and "Select Folder". */
export async function uploadImages(
  workspaceId: string,
  projectId: string,
  files: File[],
  opts: { batchName: string; tagNames: string[]; folderName?: string },
  onProgress?: (percent: number) => void
): Promise<UploadImagesResponse> {
  const form = new FormData()
  files.forEach((file) => form.append("files", file))
  form.append("batch_name", opts.batchName)
  form.append("tag_names", opts.tagNames.join(","))
  form.append("folder_name", opts.folderName ?? "")

  const res = await api.post<UploadImagesResponse>(
    `${uploadBase(workspaceId, projectId)}/images`,
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
      },
    }
  )
  return res.data
}

/** POST /upload/video/initiate — step 1 of 2 for video upload. */
export async function initiateVideoUpload(
  workspaceId: string,
  projectId: string,
  file: File,
  opts: { batchName: string; tagNames: string[] },
  onProgress?: (percent: number) => void
): Promise<VideoInitiateResponse> {
  const form = new FormData()
  form.append("file", file)
  form.append("batch_name", opts.batchName)
  form.append("tag_names", opts.tagNames.join(","))

  const res = await api.post<VideoInitiateResponse>(
    `${uploadBase(workspaceId, projectId)}/video/initiate`,
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
      },
    }
  )
  return res.data
}

/** POST /upload/video/extract — step 2 of 2. Queues extraction, returns immediately. */
export async function triggerExtraction(
  workspaceId: string,
  projectId: string,
  videoUploadId: string,
  frameInterval: number,
  manualMarks: number[]
): Promise<TriggerExtractionResponse> {
  const res = await api.post<TriggerExtractionResponse>(
    `${uploadBase(workspaceId, projectId)}/video/extract`,
    {
      video_upload_id: videoUploadId,
      frame_interval: frameInterval,
      manual_marks: manualMarks,
    }
  )
  return res.data
}

/** GET /upload/video/{id}/status — REST fallback if the WebSocket drops. */
export async function fetchExtractionStatus(
  workspaceId: string,
  projectId: string,
  videoUploadId: string
): Promise<ExtractionProgress> {
  const res = await api.get<ExtractionProgress>(
    `${uploadBase(workspaceId, projectId)}/video/${videoUploadId}/status`
  )
  return res.data
}

/** GET /upload/batch/{id}/preview — paginated image grid for the review step. */
export async function fetchBatchPreview(
  workspaceId: string,
  projectId: string,
  batchId: string,
  opts: { tab?: BatchPreviewTab; skip?: number; limit?: number } = {}
): Promise<BatchPreviewResponse> {
  const res = await api.get<BatchPreviewResponse>(
    `${uploadBase(workspaceId, projectId)}/batch/${batchId}/preview`,
    { params: { tab: opts.tab ?? "all", skip: opts.skip ?? 0, limit: opts.limit ?? 50 } }
  )
  return res.data
}

/** POST /upload/batch/{id}/save — "Save and Continue", finalizes name + tags. */
export async function saveBatch(
  workspaceId: string,
  projectId: string,
  batchId: string,
  batchName: string,
  tagNames: string[]
): Promise<SaveBatchResponse> {
  const res = await api.post<SaveBatchResponse>(
    `${uploadBase(workspaceId, projectId)}/batch/${batchId}/save`,
    { batch_name: batchName, tag_names: tagNames }
  )
  return res.data
}

/** Builds the ws:// or wss:// URL for the extraction-progress socket. */
export function extractionSocketUrl(
  workspaceId: string,
  projectId: string,
  videoUploadId: string
): string {
  const httpBase = api.defaults.baseURL ?? ""
  const wsBase = httpBase.replace(/^http/, "ws")
  const token = localStorage.getItem("auth_token") ?? ""
  return `${wsBase}${uploadBase(workspaceId, projectId)}/progress/${videoUploadId}?token=${encodeURIComponent(token)}`
}