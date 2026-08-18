import { api } from "@/lib/api"
import type { Annotation } from "@/types/annotation"

export interface AnnotationRecord {
  id: string
  image_id: string
  class_id: string
  class_name: string
  class_color: string
  shape_type: "bbox" | "polygon"
  geometry: Record<string, unknown>
  z_index: number
  created_by: string
  created_at: string
}

/** Maps the backend's generic geometry shape onto the store's bbox/polygon union. */
export function toStoreAnnotation(record: AnnotationRecord): Annotation {
  return {
    id: record.id,
    imageId: record.image_id,
    classId: record.class_id,
    className: record.class_name,
    color: record.class_color,
    bbox: record.shape_type === "bbox" ? (record.geometry as unknown as Annotation["bbox"]) : undefined,
    polygon:
      record.shape_type === "polygon"
        ? ((record.geometry as { points: unknown }).points as Annotation["polygon"])
        : undefined,
    zIndex: record.z_index,
    createdBy: record.created_by,
    createdAt: record.created_at,
  }
}

function base(workspaceId: string, projectId: string, imageId: string) {
  return `/workspaces/${workspaceId}/projects/${projectId}/images/${imageId}/annotations`
}

export async function listAnnotations(
  workspaceId: string,
  projectId: string,
  imageId: string
): Promise<AnnotationRecord[]> {
  const res = await api.get<AnnotationRecord[]>(base(workspaceId, projectId, imageId))
  return res.data
}

export async function createAnnotation(
  workspaceId: string,
  projectId: string,
  imageId: string,
  payload: { classId: string; shapeType: "bbox" | "polygon"; geometry: Record<string, unknown> }
): Promise<AnnotationRecord> {
  const res = await api.post<AnnotationRecord>(base(workspaceId, projectId, imageId), {
    class_id: payload.classId,
    shape_type: payload.shapeType,
    geometry: payload.geometry,
  })
  return res.data
}

export async function updateAnnotation(
  workspaceId: string,
  projectId: string,
  imageId: string,
  annotationId: string,
  payload: { classId?: string; geometry?: Record<string, unknown>; zIndex?: number }
): Promise<AnnotationRecord> {
  const res = await api.patch<AnnotationRecord>(
    `${base(workspaceId, projectId, imageId)}/${annotationId}`,
    { class_id: payload.classId, geometry: payload.geometry, z_index: payload.zIndex }
  )
  return res.data
}

export async function deleteAnnotation(
  workspaceId: string,
  projectId: string,
  imageId: string,
  annotationId: string
): Promise<void> {
  await api.delete(`${base(workspaceId, projectId, imageId)}/${annotationId}`)
}
