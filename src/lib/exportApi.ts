import { api } from "@/lib/api"

export interface DatasetExportStatus {
  status: "processing" | "done" | "failed"
  percent: number
  message?: string
  download_url?: string
}

/** Same filter shape as listProjectImages (src/lib/imageApi.ts) — lets
 * "Export" match whatever the Dataset page's grid is actually showing
 * (a tag filter narrowed to 4 of 10 images, say) instead of always
 * exporting the whole dataset regardless of what's on screen. */
export interface DatasetExportFilters {
  tagId?: string
  classId?: string
  split?: string
  search?: string
}

/** Kicks off a background export job — building a ZIP for thousands of
 * images inline in the request risked a multi-minute held-open request and
 * a large in-memory buffer. Poll getDatasetExportStatus() for progress.
 *
 * Every YOLO release (v8/v9/v11/v12/26/...) reads the identical .txt +
 * data.yaml layout — there's genuinely nothing version-specific to
 * generate there, so this hits the same backend endpoint regardless of
 * which label is picked. `format` still does something real: the backend
 * bundles a README.txt naming the exact pretrained checkpoint + training
 * command for whichever version was selected. */
export async function startDatasetExport(
  workspaceId: string,
  projectId: string,
  format: string,
  filters: DatasetExportFilters = {}
): Promise<{ export_id: string }> {
  const res = await api.post(
    `/workspaces/${workspaceId}/projects/${projectId}/export/yolo/start`,
    null,
    {
      params: {
        format,
        tag_id: filters.tagId,
        class_id: filters.classId,
        split: filters.split,
        search: filters.search || undefined,
      },
    }
  )
  return res.data
}

export async function getDatasetExportStatus(
  workspaceId: string,
  projectId: string,
  exportId: string
): Promise<DatasetExportStatus> {
  const res = await api.get(`/workspaces/${workspaceId}/projects/${projectId}/export/yolo/status/${exportId}`)
  return res.data
}

/** Whether the dataset has any real polygon annotations — checked before
 * export starts so a segmentation-unsupported YOLO version selection (see
 * src/lib/yoloVersions.ts) can be flagged with a warning up front, instead
 * of the user only finding out from the bundled README after downloading.
 * Takes the same filters as startDatasetExport so the warning reflects the
 * actual image set about to be exported, not the whole dataset. */
export async function checkDatasetHasPolygon(
  workspaceId: string,
  projectId: string,
  filters: DatasetExportFilters = {}
): Promise<boolean> {
  const res = await api.get(`/workspaces/${workspaceId}/projects/${projectId}/export/yolo/precheck`, {
    params: {
      tag_id: filters.tagId,
      class_id: filters.classId,
      split: filters.split,
      search: filters.search || undefined,
    },
  })
  return res.data.has_polygon
}
