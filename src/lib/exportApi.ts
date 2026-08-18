import { api } from "@/lib/api"

/** Every YOLO release (v8/v9/v11/v12/26/...) reads the identical .txt +
 *  data.yaml layout — there's nothing version-specific to generate, so this
 *  hits the same backend endpoint regardless of which label is picked. */
export async function exportDatasetYolo(workspaceId: string, projectId: string): Promise<Blob> {
  const res = await api.get(`/workspaces/${workspaceId}/projects/${projectId}/export/yolo`, {
    responseType: "blob",
  })
  return res.data
}
