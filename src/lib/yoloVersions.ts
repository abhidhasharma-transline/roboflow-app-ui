// Mirrors app/core/yolo_export.py's YOLO_VERSIONS. Ultralytics has not
// published official pretrained segmentation weights for YOLOv12 — only
// detection — so a dataset with real polygon annotations exported for
// YOLOv12 has every shape reduced to its bounding box. Used to warn the
// user before export, not just explain it after in the README.
export const YOLO_FORMATS = ["YOLOv8", "YOLOv9", "YOLOv11", "YOLOv12", "YOLO26"]

const SEGMENTATION_UNSUPPORTED = new Set(["YOLOv12"])

export function supportsSegmentation(format: string): boolean {
  return !SEGMENTATION_UNSUPPORTED.has(format)
}

// Suggested when a user wants to switch away from a segmentation-unsupported
// version — the first (and default) entry in the dropdown that does support it.
export const SUGGESTED_SEGMENTATION_FORMAT = "YOLOv8"
