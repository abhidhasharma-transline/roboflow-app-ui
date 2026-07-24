export type ExportFormat =
  | "coco"
  | "yolov8"
  | "yolov5"
  | "pascal-voc"
  | "tfrecord"
  | "createml"

export interface DatasetVersion {
  id: string
  projectId: string
  versionNumber: number
  imageCount: number
  trainCount: number
  validCount: number
  testCount: number
  preprocessingSteps: string[]
  augmentationSteps: string[]
  createdAt: string
  exportFormats: ExportFormat[]
}
