import type { ImageItem, Batch } from "@/types/image"
import type { AnnotationJob, ClassLabel } from "@/types/annotation"
import type { DatasetVersion } from "@/types/version"

// Simulate network latency so loading states are actually visible during dev
const delay = (ms = 400) => new Promise((res) => setTimeout(res, ms))


const mockBatches: Batch[] = [
  { id: "b1", projectId: "p1", name: "Batch — Jul 18 upload", imageCount: 120, source: "upload", createdAt: "2026-07-18T09:00:00Z" },
  { id: "b2", projectId: "p1", name: "Batch — Line-cam extraction", imageCount: 300, source: "video-extraction", createdAt: "2026-07-12T09:00:00Z" },
]

const mockImages: ImageItem[] = Array.from({ length: 24 }, (_, i) => ({
  id: `img${i + 1}`,
  projectId: "p1",
  batchId: i % 2 === 0 ? "b1" : "b2",
  url: `https://picsum.photos/seed/rf${i}/800/600`,
  thumbnailUrl: `https://picsum.photos/seed/rf${i}/300/220`,
  status: i < 8 ? "unassigned" : i < 16 ? "annotating" : "dataset",
  width: 800,
  height: 600,
  fileName: `frame_${1000 + i}.jpg`,
  annotationCount: i < 8 ? 0 : Math.floor(Math.random() * 5) + 1,
  uploadedAt: "2026-07-18T09:00:00Z",
}))

const mockJobs: AnnotationJob[] = [
  { id: "j1", projectId: "p1", name: "Batch 1 - QC Pass", assigneeId: "u2", assigneeName: "Rohit Verma", imageCount: 120, completedCount: 80, status: "in-progress", dueDate: "2026-07-25", createdAt: "2026-07-18T09:00:00Z" },
  { id: "j2", projectId: "p1", name: "Batch 2 - Extraction Review", assigneeId: "u3", assigneeName: "Priya Nair", imageCount: 300, completedCount: 300, status: "completed", dueDate: "2026-07-15", createdAt: "2026-07-12T09:00:00Z" },
]

const mockClasses: ClassLabel[] = [
  { id: "c1", name: "scratch", color: "#ef4444", count: 340 },
  { id: "c2", name: "dent", color: "#f59e0b", count: 210 },
  { id: "c3", name: "crack", color: "#8b5cf6", count: 95 },
  { id: "c4", name: "rust", color: "#22c55e", count: 60 },
  { id: "c5", name: "no-defect", color: "#3b82f6", count: 185 },
]

const mockVersions: DatasetVersion[] = [
  {
    id: "v1",
    projectId: "p1",
    versionNumber: 3,
    imageCount: 890,
    trainCount: 712,
    validCount: 133,
    testCount: 45,
    preprocessingSteps: ["Auto-orient", "Resize: 640x640"],
    augmentationSteps: ["Flip: horizontal", "Rotation: ±15°", "Brightness: ±20%"],
    createdAt: "2026-07-15T09:00:00Z",
    exportFormats: ["yolov8", "coco"],
  },
]

// ---- API functions (mirror the real backend contract) ----

export async function mockGetBatches(projectId: string): Promise<Batch[]> {
  await delay()
  return mockBatches.filter((b) => b.projectId === projectId)
}

export async function mockGetImages(projectId: string): Promise<ImageItem[]> {
  await delay()
  return mockImages.filter((i) => i.projectId === projectId)
}

export async function mockGetJobs(projectId: string): Promise<AnnotationJob[]> {
  await delay()
  return mockJobs.filter((j) => j.projectId === projectId)
}

export async function mockGetClasses(projectId: string): Promise<ClassLabel[]> {
  await delay()
  return mockClasses.filter(() => projectId === "p1")
}

export async function mockGetVersions(projectId: string): Promise<DatasetVersion[]> {
  await delay()
  return mockVersions.filter((v) => v.projectId === projectId)
}

