// Mirrors app/api/v1/upload.py response shapes exactly.

export interface UploadImagesResponse {
  batch_id: string
  batch_name: string
  source_type: "images" | "folder"
  saved: number
  duplicates: number
  duplicate_filenames: string[]
  errors: { file: string; error: string }[]
  total: number
  images_annotated: number
  annotations_imported: number
}

export interface VideoInitiateResponse {
  batch_id: string
  batch_name: string
  video_upload_id: string
  video_url: string
  filename: string
  duration: number
  duration_label: string
  sampling_presets: SamplingPreset[]
}

export interface SamplingPreset {
  label: string
  interval: number
  count: number
  default?: boolean
}

export interface TriggerExtractionResponse {
  status: "processing"
  video_upload_id: string
  batch_id: string
  estimated_frames: number
  ws_channel: string
}

export type ExtractionStatus = "processing" | "done" | "failed"

export interface ExtractionProgress {
  status: ExtractionStatus
  percent: number
  saved?: number
  total?: number
  message?: string
}

export type BatchPreviewTab = "all" | "annotated" | "unannotated"

export interface BatchPreviewImage {
  id: string
  filename: string
  thumbnail_url: string | null
  status: string
  is_duplicate: boolean
  width: number
  height: number
  tags: { id: string; name: string }[]
  annotation_count: number
  class_names: string[]
}

export interface BatchPreviewResponse {
  batch_id: string
  batch_name: string
  tags: string[]
  counts: {
    all: number
    annotated: number
    unannotated: number
  }
  total: number
  skip: number
  limit: number
  images: BatchPreviewImage[]
}

export interface SaveBatchResponse {
  batch_id: string
  batch_name: string
  status: string
  image_count: number
}