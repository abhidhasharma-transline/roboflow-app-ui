import type { Workspace, Project } from "@/types/project"
import type { ImageItem, Batch } from "@/types/image"
import type { AnnotationJob, ClassLabel } from "@/types/annotation"
import type { DatasetVersion } from "@/types/version"
import type { User } from "@/types/auth"

// Simulate network latency so loading states are actually visible during dev
const delay = (ms = 400) => new Promise((res) => setTimeout(res, ms))

export const mockUser: User = {
  id: "u1",
  name: "Aditi Sharma",
  email: "aditi@company.com",
  avatarUrl: null,
  role: "admin",
}

const mockWorkspaces: Workspace[] = [
  {
    id: "ws1",
    name: "Acme Robotics",
    slug: "acme-robotics",
    memberCount: 8,
    planTier: "enterprise",
    createdAt: "2026-01-15T10:00:00Z",
  },
]

const mockProjects: Project[] = [
  {
    id: "p1",
    workspaceId: "ws1",
    name: "Conveyor Defect Detection",
    type: "object-detection",
    imageCount: 1240,
    annotatedCount: 890,
    classCount: 5,
    thumbnailUrl: null,
    createdAt: "2026-02-01T09:00:00Z",
    updatedAt: "2026-07-15T12:00:00Z",
  },
  {
    id: "p2",
    workspaceId: "ws1",
    name: "Warehouse PPE Compliance",
    type: "object-detection",
    imageCount: 640,
    annotatedCount: 640,
    classCount: 4,
    thumbnailUrl: null,
    createdAt: "2026-03-12T09:00:00Z",
    updatedAt: "2026-07-10T09:00:00Z",
  },
  {
    id: "p3",
    workspaceId: "ws1",
    name: "Product Quality Classifier",
    type: "classification",
    imageCount: 320,
    annotatedCount: 145,
    classCount: 2,
    thumbnailUrl: null,
    createdAt: "2026-05-20T09:00:00Z",
    updatedAt: "2026-07-18T09:00:00Z",
  },
]

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

export async function mockGetWorkspaces(): Promise<Workspace[]> {
  await delay()
  return mockWorkspaces
}

export async function mockGetProjects(workspaceId: string): Promise<Project[]> {
  await delay()
  return mockProjects.filter((p) => p.workspaceId === workspaceId)
}

export async function mockGetProject(projectId: string): Promise<Project | undefined> {
  await delay()
  return mockProjects.find((p) => p.id === projectId)
}

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

export async function mockLogin(email: string, _password: string): Promise<{ user: User; token: string }> {
  await delay(600)
  return { user: { ...mockUser, email }, token: "mock-jwt-token" }
}
