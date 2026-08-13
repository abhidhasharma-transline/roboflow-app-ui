import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useNavigate, useSearchParams } from "react-router-dom"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  MoreHorizontal,
  MousePointer2,
  Square,
  Spline,
  Brush,
  Wand2,
  Sparkles,
  MessageSquare,
  Undo2,
  Redo2,
  CircleSlash,
  Minus,
  Plus,
  Lock,
  SunMedium,
  Keyboard,
  Tag as TagIcon,
  Trash2,
  X,
  Copy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useAnnotationStore, type AnnotationTool } from "@/stores/annotationStore"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useAuthStore } from "@/stores/authStore"
import { useProject } from "@/hooks/useProjects"
import { useAnnotationSocket, type LockInfo } from "@/hooks/useAnnotationSocket"
import { getJobImages } from "@/lib/jobApi"
import { listClasses, createClass, type ProjectClass } from "@/lib/classApi"
import { listAnnotations, createAnnotation, updateAnnotation, deleteAnnotation, toStoreAnnotation } from "@/lib/annotationApi"
import { listImageTags, addImageTag, removeImageTag, type ImageTag } from "@/lib/tagApi"
import type { JobImageSummary } from "@/types/job"
import type { Annotation, BoundingBox, Point } from "@/types/annotation"

type ResizeHandle = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw"

const RESIZE_HANDLES: { key: ResizeHandle; className: string; cursor: string }[] = [
  { key: "nw", className: "-left-1 -top-1", cursor: "nwse-resize" },
  { key: "n", className: "left-1/2 -top-1 -translate-x-1/2", cursor: "ns-resize" },
  { key: "ne", className: "-top-1 -right-1", cursor: "nesw-resize" },
  { key: "e", className: "top-1/2 -right-1 -translate-y-1/2", cursor: "ew-resize" },
  { key: "se", className: "-right-1 -bottom-1", cursor: "nwse-resize" },
  { key: "s", className: "left-1/2 -bottom-1 -translate-x-1/2", cursor: "ns-resize" },
  { key: "sw", className: "-bottom-1 -left-1", cursor: "nesw-resize" },
  { key: "w", className: "top-1/2 -left-1 -translate-y-1/2", cursor: "ew-resize" },
]

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max)
}

const NEW_CLASS_COLORS = [
  "#FF3B3B", "#3B82F6", "#22C55E", "#F59E0B", "#A855F7", "#EC4899", "#14B8A6", "#F97316",
]

const tools: { key: AnnotationTool; icon: typeof MousePointer2; label: string }[] = [
  { key: "select", icon: MousePointer2, label: "Select (V)" },
  { key: "bbox", icon: Square, label: "Bounding box (B)" },
  { key: "polygon", icon: Spline, label: "Polygon (P)" },
]

const leftNavItems = [
  { key: "labels", icon: TagIcon, label: "Labels" },
  { key: "attributes", icon: Sparkles, label: "Attributes" },
  { key: "comments", icon: MessageSquare, label: "Comments" },
  { key: "history", icon: Undo2, label: "History" },
  { key: "raw", icon: CircleSlash, label: "Raw Data" },
]

function AnnotationBoxOverlay({
  annotation,
  bbox,
  lockedBy,
  currentUserId,
  deleting,
  selected,
  selectable,
  onDelete,
  onContextMenu,
  onBodyMouseDown,
  onHandleMouseDown,
}: {
  annotation: Annotation
  bbox: BoundingBox
  lockedBy?: LockInfo
  currentUserId?: string
  deleting: boolean
  selected: boolean
  selectable: boolean
  onDelete: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onBodyMouseDown: (e: React.MouseEvent) => void
  onHandleMouseDown: (handle: ResizeHandle, e: React.MouseEvent) => void
}) {
  const lockedByOther = Boolean(lockedBy && lockedBy.userId !== currentUserId)

  return (
    <div
      onContextMenu={onContextMenu}
      onMouseDown={selectable ? onBodyMouseDown : undefined}
      className="group absolute border-2"
      style={{
        left: `${bbox.x}%`,
        top: `${bbox.y}%`,
        width: `${bbox.width}%`,
        height: `${bbox.height}%`,
        borderColor: annotation.color,
        cursor: selectable ? "move" : undefined,
      }}
    >
      <span
        className="absolute -top-5 left-0 rounded-t px-1.5 py-0.5 text-[10px] font-medium text-white"
        style={{ backgroundColor: annotation.color }}
      >
        {annotation.className}
      </span>
      {lockedByOther && (
        <span className="absolute -bottom-5 left-0 rounded-b bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
          {lockedBy!.userName} editing…
        </span>
      )}
      <button
        onClick={onDelete}
        disabled={lockedByOther || deleting}
        title={lockedByOther ? `Locked by ${lockedBy!.userName}` : "Delete"}
        className="absolute -top-5 right-0 hidden rounded bg-black/60 p-0.5 text-white group-hover:block disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Trash2 className="size-3" />
      </button>
      {selected &&
        RESIZE_HANDLES.map((h) => (
          <div
            key={h.key}
            onMouseDown={(e) => {
              e.stopPropagation()
              onHandleMouseDown(h.key, e)
            }}
            className={cn("absolute size-2 rounded-sm border border-white bg-brand", h.className)}
            style={{ cursor: h.cursor }}
          />
        ))}
    </div>
  )
}

export function AnnotationToolPage() {
  const { projectId, jobId } = useParams<{ projectId: string; jobId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialImageId = useRef(searchParams.get("image"))
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const canvasRef = useRef<HTMLDivElement>(null)

  const currentUser = useAuthStore((s) => s.user)
  const { project } = useProject(projectId)
  const [images, setImages] = useState<JobImageSummary[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [classes, setClasses] = useState<ProjectClass[]>([])
  const [hideLabels, setHideLabels] = useState(false)
  const [panelTab, setPanelTab] = useState<"classes" | "layers">("classes")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const {
    activeTool,
    setActiveTool,
    activeClassId,
    setActiveClassId,
    annotations,
    setAnnotations,
    zoom,
    setZoom,
  } = useAnnotationStore()

  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null)
  const drawTempIdRef = useRef<string | null>(null)
  const lastPreviewSentRef = useRef(0)

  const [polygonPoints, setPolygonPoints] = useState<Point[]>([])
  const [polygonHoverPos, setPolygonHoverPos] = useState<Point | null>(null)

  const [newClassOpen, setNewClassOpen] = useState(false)
  const [newClassName, setNewClassName] = useState("")
  const [creatingClass, setCreatingClass] = useState(false)

  const [imageTags, setImageTags] = useState<ImageTag[]>([])
  const [tagDraft, setTagDraft] = useState("")
  const [savingTag, setSavingTag] = useState(false)

  type PendingShape =
    | { shapeType: "bbox"; geometry: { x: number; y: number; width: number; height: number } }
    | { shapeType: "polygon"; geometry: { points: Point[] } }
  const [pendingShape, setPendingShape] = useState<PendingShape | null>(null)
  const [pendingClassName, setPendingClassName] = useState("")
  const [savingPending, setSavingPending] = useState(false)

  const [contextMenu, setContextMenu] = useState<{ annotationId: string; x: number; y: number } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  type DragMode =
    | { type: "move"; annotationId: string; startPos: Point; startBbox: BoundingBox }
    | { type: "resize"; annotationId: string; handle: ResizeHandle; startPos: Point; startBbox: BoundingBox }
  const [dragMode, setDragMode] = useState<DragMode | null>(null)
  const [resizeOverride, setResizeOverride] = useState<{ id: string; bbox: BoundingBox } | null>(null)

  const currentImage = images[currentIndex]

  const { remoteDrafts, locks, sendDragPreview, acquireLock, releaseLock } = useAnnotationSocket(
    workspaceId ?? undefined,
    projectId,
    currentImage?.id,
    currentUser?.id
  )

  useEffect(() => {
    if (!workspaceId || !projectId || !jobId) return
    getJobImages(workspaceId, projectId, jobId, "all").then((res) => {
      setImages(res.images)
      if (initialImageId.current) {
        const idx = res.images.findIndex((img) => img.id === initialImageId.current)
        if (idx >= 0) setCurrentIndex(idx)
        initialImageId.current = null
      }
    })
    listClasses(workspaceId, projectId).then((rows) => {
      setClasses(rows)
      if (rows[0]) setActiveClassId(rows[0].id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, projectId, jobId])

  // Each image's annotations are loaded fresh from the server when you page
  // to it — `annotations` in the store always holds just the current image's
  // set, kept live afterwards by the WS created/updated/deleted broadcasts.
  useEffect(() => {
    if (!workspaceId || !projectId || !currentImage) return
    listAnnotations(workspaceId, projectId, currentImage.id).then((rows) => {
      setAnnotations(rows.map(toStoreAnnotation))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, projectId, currentImage?.id])

  useEffect(() => {
    if (!workspaceId || !projectId || !currentImage) return
    listImageTags(workspaceId, projectId, currentImage.id).then(setImageTags)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, projectId, currentImage?.id])

  async function handleAddTag() {
    if (!workspaceId || !projectId || !currentImage || !tagDraft.trim()) return
    setSavingTag(true)
    try {
      const tag = await addImageTag(workspaceId, projectId, currentImage.id, tagDraft.trim())
      setImageTags((prev) => (prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]))
      setTagDraft("")
    } finally {
      setSavingTag(false)
    }
  }

  async function handleRemoveTag(tagId: string) {
    if (!workspaceId || !projectId || !currentImage) return
    setImageTags((prev) => prev.filter((t) => t.id !== tagId))
    await removeImageTag(workspaceId, projectId, currentImage.id, tagId)
  }

  // Switching images or tools mid-polygon-draw abandons the in-progress shape
  // rather than carrying stray points onto a different image/tool.
  useEffect(() => {
    setPolygonPoints([])
    setPolygonHoverPos(null)
    drawTempIdRef.current = null
    setPendingShape(null)
    setPendingClassName("")
    setSelectedAnnotationId(null)
  }, [currentImage?.id, activeTool])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && polygonPoints.length > 0) {
        setPolygonPoints([])
        setPolygonHoverPos(null)
        drawTempIdRef.current = null
      }
      if (e.key === "Escape" && pendingShape) {
        setPendingShape(null)
        setPendingClassName("")
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [polygonPoints.length, pendingShape])

  useEffect(() => {
    if (!contextMenu) return
    function close(e: MouseEvent) {
      if (contextMenuRef.current?.contains(e.target as Node)) return
      setContextMenu(null)
    }
    window.addEventListener("mousedown", close)
    return () => window.removeEventListener("mousedown", close)
  }, [contextMenu])

  const classCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of annotations) {
      counts.set(a.classId, (counts.get(a.classId) ?? 0) + 1)
    }
    return counts
  }, [annotations])

  const activeClass = classes.find((c) => c.id === activeClassId)

  const SNAP_THRESHOLD = 3 // percent of image width/height
  function isNearPoint(a: Point, b: Point) {
    return Math.hypot(a.x - b.x, a.y - b.y) < SNAP_THRESHOLD
  }
  const isNearPolygonStart = Boolean(
    polygonPoints.length >= 3 && polygonHoverPos && isNearPoint(polygonHoverPos, polygonPoints[0])
  )

  const unusedClasses = classes.filter((c) => !classCounts.get(c.id))
  const usedClasses = classes.filter((c) => classCounts.get(c.id))

  function goPrev() {
    setCurrentIndex((i) => Math.max(0, i - 1))
  }
  function goNext() {
    setCurrentIndex((i) => Math.min(images.length - 1, i + 1))
  }

  function getRelativePos(e: React.MouseEvent) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    }
  }

  function handleMouseDown(e: React.MouseEvent) {
    // Overlays for existing annotations stop propagation on their own
    // mousedown, so reaching here means the click landed on empty canvas —
    // clear any selection while in the select tool.
    if (activeTool === "select") {
      setSelectedAnnotationId(null)
      return
    }
    if (activeTool !== "bbox") return
    drawTempIdRef.current = crypto.randomUUID()
    setDrawStart(getRelativePos(e))
  }

  function handleMouseMove(e: React.MouseEvent) {
    const pos = getRelativePos(e)

    if (activeTool === "polygon" && polygonPoints.length > 0) {
      setPolygonHoverPos(pos)
      const now = Date.now()
      if (drawTempIdRef.current && now - lastPreviewSentRef.current > 60) {
        lastPreviewSentRef.current = now
        sendDragPreview("polygon", { points: polygonPoints }, drawTempIdRef.current)
      }
    }

    if (!drawStart) return
    setDrawCurrent(pos)

    const now = Date.now()
    if (drawTempIdRef.current && now - lastPreviewSentRef.current > 60) {
      lastPreviewSentRef.current = now
      sendDragPreview(
        "bbox",
        {
          x: Math.min(drawStart.x, pos.x),
          y: Math.min(drawStart.y, pos.y),
          width: Math.abs(pos.x - drawStart.x),
          height: Math.abs(pos.y - drawStart.y),
        },
        drawTempIdRef.current
      )
    }
  }

  function closePolygon(points: Point[]) {
    setPolygonPoints([])
    setPolygonHoverPos(null)
    drawTempIdRef.current = null
    if (points.length < 3 || !currentImage) return
    setPendingShape({ shapeType: "polygon", geometry: { points } })
    setPendingClassName(activeClass?.name ?? "")
  }

  function handleCanvasClick(e: React.MouseEvent) {
    if (activeTool !== "polygon") return
    const pos = getRelativePos(e)
    if (polygonPoints.length >= 3 && isNearPoint(pos, polygonPoints[0])) {
      closePolygon(polygonPoints)
      return
    }
    if (polygonPoints.length === 0) {
      drawTempIdRef.current = crypto.randomUUID()
    }
    setPolygonPoints((prev) => [...prev, pos])
  }

  function handleCanvasDoubleClick() {
    if (activeTool !== "polygon") return
    // The click immediately preceding this dblclick already appended a point
    // at ~the same spot — drop it before closing the shape.
    closePolygon(polygonPoints.slice(0, -1))
  }

  function handleMouseUp() {
    const start = drawStart
    const current = drawCurrent
    setDrawStart(null)
    setDrawCurrent(null)
    drawTempIdRef.current = null

    if (!start || !current || !currentImage) return
    const x = Math.min(start.x, current.x)
    const y = Math.min(start.y, current.y)
    const width = Math.abs(current.x - start.x)
    const height = Math.abs(current.y - start.y)
    if (width <= 1 || height <= 1) return

    setPendingShape({ shapeType: "bbox", geometry: { x, y, width, height } })
    setPendingClassName(activeClass?.name ?? "")
  }

  async function handleDelete(annotationId: string) {
    if (!workspaceId || !projectId || !currentImage) return
    setDeletingId(annotationId)
    acquireLock(annotationId)
    try {
      await deleteAnnotation(workspaceId, projectId, currentImage.id, annotationId)
      // WS "deleted" broadcast removes it from the store, same as create.
    } catch {
      // ignore — no toast system yet
    } finally {
      releaseLock(annotationId)
      setDeletingId(null)
    }
  }

  function handleUndo() {
    const last = annotations[annotations.length - 1]
    if (last) handleDelete(last.id)
  }

  /** Finds an existing class by name (case-insensitive) or creates one —
   * the backend also get-or-creates, this just skips the round-trip when
   * we already have the answer locally. */
  async function resolveClassId(name: string): Promise<string | null> {
    if (!workspaceId || !projectId) return null
    const trimmed = name.trim()
    if (!trimmed) return null

    const existing = classes.find((c) => c.name.toLowerCase() === trimmed.toLowerCase())
    if (existing) return existing.id

    const cls = await createClass(workspaceId, projectId, {
      name: trimmed,
      color: NEW_CLASS_COLORS[classes.length % NEW_CLASS_COLORS.length],
    })
    setClasses((prev) => (prev.some((c) => c.id === cls.id) ? prev : [...prev, cls]))
    return cls.id
  }

  async function handleCreateClass() {
    if (!newClassName.trim()) return
    setCreatingClass(true)
    try {
      const id = await resolveClassId(newClassName)
      if (id) setActiveClassId(id)
      setNewClassName("")
      setNewClassOpen(false)
    } catch {
      // ignore — no toast system yet
    } finally {
      setCreatingClass(false)
    }
  }

  async function handleSavePendingShape(explicitClassId?: string) {
    if (!pendingShape || !workspaceId || !projectId || !currentImage) return
    if (!explicitClassId && !pendingClassName.trim()) return
    setSavingPending(true)
    try {
      const classId = explicitClassId ?? (await resolveClassId(pendingClassName))
      if (!classId) return
      await createAnnotation(workspaceId, projectId, currentImage.id, {
        classId,
        shapeType: pendingShape.shapeType,
        geometry: pendingShape.geometry,
      })
      setActiveClassId(classId)
      setPendingShape(null)
      setPendingClassName("")
    } catch {
      // ignore — no toast system yet
    } finally {
      setSavingPending(false)
    }
  }

  function handleDiscardPendingShape() {
    setPendingShape(null)
    setPendingClassName("")
  }

  async function handleDuplicate(annotationId: string) {
    const ann = annotations.find((a) => a.id === annotationId)
    if (!ann || !workspaceId || !projectId || !currentImage) return
    const OFFSET = 3
    try {
      if (ann.bbox) {
        await createAnnotation(workspaceId, projectId, currentImage.id, {
          classId: ann.classId,
          shapeType: "bbox",
          geometry: {
            x: ann.bbox.x + OFFSET, y: ann.bbox.y + OFFSET,
            width: ann.bbox.width, height: ann.bbox.height,
          },
        })
      } else if (ann.polygon) {
        await createAnnotation(workspaceId, projectId, currentImage.id, {
          classId: ann.classId,
          shapeType: "polygon",
          geometry: { points: ann.polygon.map((p) => ({ x: p.x + OFFSET, y: p.y + OFFSET })) },
        })
      }
    } catch {
      // ignore — no toast system yet
    }
  }

  function startBoxDrag(kind: "move" | "resize", annotationId: string, handle: ResizeHandle | undefined, e: React.MouseEvent) {
    if (activeTool !== "select") return
    e.stopPropagation()
    if (e.button !== 0) return
    const ann = annotations.find((a) => a.id === annotationId)
    if (!ann?.bbox) return
    setSelectedAnnotationId(annotationId)
    acquireLock(annotationId)
    const startPos = getRelativePos(e)
    if (kind === "move") {
      setDragMode({ type: "move", annotationId, startPos, startBbox: ann.bbox })
    } else if (handle) {
      setDragMode({ type: "resize", annotationId, handle, startPos, startBbox: ann.bbox })
    }
  }

  // Live-preview a move/resize drag via a local override (not persisted until
  // mouseup), then commit through the same PATCH endpoint other edits use —
  // its WS "updated" broadcast is what actually lands the change in the store.
  useEffect(() => {
    if (!dragMode) return

    function onMove(e: MouseEvent) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect || !dragMode) return
      const pos = {
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      }
      const dx = pos.x - dragMode.startPos.x
      const dy = pos.y - dragMode.startPos.y
      const b = dragMode.startBbox
      let next: BoundingBox

      if (dragMode.type === "move") {
        next = {
          ...b,
          x: clamp(b.x + dx, 0, 100 - b.width),
          y: clamp(b.y + dy, 0, 100 - b.height),
        }
      } else {
        let { x, y, width, height } = b
        const h = dragMode.handle
        if (h.includes("e")) width = clamp(b.width + dx, 2, 100 - b.x)
        if (h.includes("s")) height = clamp(b.height + dy, 2, 100 - b.y)
        if (h.includes("w")) {
          width = clamp(b.width - dx, 2, b.x + b.width)
          x = b.x + b.width - width
        }
        if (h.includes("n")) {
          height = clamp(b.height - dy, 2, b.y + b.height)
          y = b.y + b.height - height
        }
        next = { x, y, width, height }
      }
      setResizeOverride({ id: dragMode.annotationId, bbox: next })
    }

    function onUp() {
      setDragMode((current) => {
        if (current) {
          setResizeOverride((override) => {
            if (override && override.id === current.annotationId && workspaceId && projectId && currentImage) {
              updateAnnotation(workspaceId, projectId, currentImage.id, current.annotationId, {
                geometry: override.bbox as unknown as Record<string, unknown>,
              })
                .catch(() => {})
                .finally(() => releaseLock(current.annotationId))
            } else {
              releaseLock(current.annotationId)
            }
            return null
          })
        }
        return null
      })
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [dragMode, workspaceId, projectId, currentImage, releaseLock])

  const previewBox =
    drawStart && drawCurrent
      ? {
          x: Math.min(drawStart.x, drawCurrent.x),
          y: Math.min(drawStart.y, drawCurrent.y),
          width: Math.abs(drawCurrent.x - drawStart.x),
          height: Math.abs(drawCurrent.y - drawStart.y),
        }
      : null

  if (!currentImage) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div>
          <button
            onClick={() => navigate(`/projects/${projectId}/annotate`)}
            className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            {(project?.name ?? "Project").toUpperCase()}
            <ChevronRight className="size-3.5" />
            <span className="text-brand">ANNOTATE</span>
          </button>
          <p className="mt-0.5 text-sm font-medium text-foreground">{currentImage.filename}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={goPrev} disabled={currentIndex === 0}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {images.length}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={goNext}
            disabled={currentIndex === images.length - 1}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setHideLabels((v) => !v)}
            title="Toggle label visibility"
          >
            {hideLabels ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" title="More">
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left icon rail */}
        <div className="flex w-16 shrink-0 flex-col items-center gap-1 border-r border-border py-3">
          {leftNavItems.map((item) => (
            <button
              key={item.key}
              disabled={item.key !== "labels"}
              className={cn(
                "flex flex-col items-center gap-1 rounded-md px-2 py-2 text-[10px]",
                item.key === "labels"
                  ? "text-brand"
                  : "cursor-default text-muted-foreground/50"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </button>
          ))}
        </div>

        {/* Classes / Tags panel */}
        <div className="flex w-72 shrink-0 flex-col overflow-y-auto border-r border-border p-4">
          <div className="mb-3 flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">Annotations</p>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {annotations.length}
            </span>
          </div>

          {pendingShape && (
            <div className="mb-4 overflow-hidden rounded-lg border border-brand/40 bg-brand/5">
              <div className="flex items-center justify-between border-b border-brand/20 px-3 py-2">
                <p className="text-sm font-semibold text-foreground">Assign a class</p>
                <button onClick={handleDiscardPendingShape} className="text-muted-foreground hover:text-foreground">
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="p-3">
                <Input
                  value={pendingClassName}
                  onChange={(e) => setPendingClassName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSavePendingShape()
                    if (e.key === "Escape") handleDiscardPendingShape()
                  }}
                  placeholder="Search or create a class…"
                  className="h-8 text-sm"
                  autoFocus
                />
                {pendingClassName.trim() && (
                  <div className="mt-1.5 flex max-h-32 flex-col gap-0.5 overflow-y-auto">
                    {classes
                      .filter((c) => c.name.toLowerCase().includes(pendingClassName.trim().toLowerCase()))
                      .slice(0, 6)
                      .map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleSavePendingShape(c.id)}
                          className="flex items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-accent"
                        >
                          <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: c.color }} />
                          {c.name}
                        </button>
                      ))}
                  </div>
                )}
                <div className="mt-2.5 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={handleDiscardPendingShape}>
                    Delete
                  </Button>
                  <Button
                    variant="brand"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleSavePendingShape()}
                    disabled={savingPending || !pendingClassName.trim()}
                  >
                    {savingPending ? "Saving…" : "Save (Enter)"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Tabs value={panelTab} onValueChange={(v) => setPanelTab(v as "classes" | "layers")}>
            <TabsList className="mb-3 w-full">
              <TabsTrigger value="classes" className="flex-1">
                Classes
              </TabsTrigger>
              <TabsTrigger value="layers" className="flex-1">
                Layers
              </TabsTrigger>
            </TabsList>

            <TabsContent value="classes">
              {usedClasses.length > 0 && (
                <>
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Used Classes</p>
                  <div className="mb-3 flex flex-col gap-1">
                    {usedClasses.map((cls) => (
                      <button
                        key={cls.id}
                        onClick={() => setActiveClassId(cls.id)}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                          activeClassId === cls.id && "bg-accent"
                        )}
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: cls.color }}
                        />
                        <span className="flex-1 truncate text-foreground">{cls.name}</span>
                        <span className="text-xs text-muted-foreground">{classCounts.get(cls.id)}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {newClassOpen ? (
                <div className="mb-3 flex gap-1.5">
                  <Input
                    placeholder="Class name…"
                    className="h-8 text-xs"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateClass()
                    }}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    variant="brand"
                    onClick={handleCreateClass}
                    disabled={creatingClass || !newClassName.trim()}
                  >
                    {creatingClass ? "…" : "Add"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setNewClassOpen(false)
                      setNewClassName("")
                    }}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="mb-3 w-full"
                  onClick={() => setNewClassOpen(true)}
                >
                  <Plus className="size-3.5" />
                  New Class
                </Button>
              )}

              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Unused Classes</p>
              <div className="mb-3 flex flex-col gap-1">
                {unusedClasses.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => setActiveClassId(cls.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                      activeClassId === cls.id && "bg-accent"
                    )}
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: cls.color }}
                    />
                    <span className="flex-1 truncate text-muted-foreground italic">{cls.name}</span>
                    <Sparkles className="size-3 shrink-0 text-muted-foreground/60" />
                  </button>
                ))}
                {classes.length === 0 && (
                  <p className="text-xs text-muted-foreground">No classes on this project yet.</p>
                )}
              </div>

              <Button variant="outline" className="w-full" disabled>
                <Sparkles className="size-3.5" />
                Find Objects with AI
              </Button>
            </TabsContent>

            <TabsContent value="layers">
              <p className="py-6 text-center text-xs text-muted-foreground">No layers yet.</p>
            </TabsContent>
          </Tabs>

          <div className="mt-6 border-t border-border pt-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <TagIcon className="size-3.5" />
              Tags
            </p>
            {imageTags.length === 0 ? (
              <div className="mb-2 flex flex-col items-center gap-1 rounded-md border border-dashed border-border py-4 text-center">
                <p className="text-xs font-medium text-foreground">No Tags Applied</p>
                <p className="px-2 text-xs text-muted-foreground">
                  Type and select tags below to add them to the image.
                </p>
              </div>
            ) : (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {imageTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand"
                  >
                    {tag.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag.id)}
                      className="rounded-full hover:bg-brand/20"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-1.5">
              <Input
                placeholder="Add tag…"
                className="h-8 text-xs"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddTag()
                }}
              />
              <Button size="sm" variant="outline" onClick={handleAddTag} disabled={savingTag || !tagDraft.trim()}>
                Add
              </Button>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="relative flex flex-1 flex-col overflow-hidden bg-neutral-900">
          <div className="flex flex-1 items-center justify-center overflow-auto p-8">
            <div
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onClick={handleCanvasClick}
              onDoubleClick={handleCanvasDoubleClick}
              className="relative select-none"
              style={{
                width: 800 * zoom,
                height: 560 * zoom,
                cursor: activeTool === "bbox" || activeTool === "polygon" ? "crosshair" : "default",
              }}
            >
              <img
                src={currentImage.url}
                alt={currentImage.filename}
                className="size-full rounded object-cover"
                draggable={false}
              />
              {!hideLabels &&
                annotations
                  .filter((a) => a.bbox)
                  .map((ann) => (
                    <AnnotationBoxOverlay
                      key={ann.id}
                      annotation={ann}
                      bbox={resizeOverride?.id === ann.id ? resizeOverride.bbox : ann.bbox!}
                      lockedBy={locks[ann.id]}
                      currentUserId={currentUser?.id}
                      deleting={deletingId === ann.id}
                      selected={selectedAnnotationId === ann.id}
                      selectable={activeTool === "select"}
                      onDelete={() => handleDelete(ann.id)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setContextMenu({ annotationId: ann.id, x: e.clientX, y: e.clientY })
                      }}
                      onBodyMouseDown={(e) => startBoxDrag("move", ann.id, undefined, e)}
                      onHandleMouseDown={(handle, e) => startBoxDrag("resize", ann.id, handle, e)}
                    />
                  ))}
              {!hideLabels &&
                Object.values(remoteDrafts).map((draft) =>
                  draft.shapeType === "bbox" ? (
                    <div
                      key={draft.tempId}
                      className="pointer-events-none absolute border-2 border-dashed"
                      style={{
                        left: `${(draft.geometry as { x: number }).x}%`,
                        top: `${(draft.geometry as { y: number }).y}%`,
                        width: `${(draft.geometry as { width: number }).width}%`,
                        height: `${(draft.geometry as { height: number }).height}%`,
                        borderColor: "white",
                      }}
                    >
                      <span className="absolute -top-5 left-0 rounded-t bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                        {draft.userName} is drawing…
                      </span>
                    </div>
                  ) : null
                )}
              {previewBox && (
                <div
                  className="absolute border-2 border-dashed border-white/70"
                  style={{
                    left: `${previewBox.x}%`,
                    top: `${previewBox.y}%`,
                    width: `${previewBox.width}%`,
                    height: `${previewBox.height}%`,
                  }}
                />
              )}
              {pendingShape?.shapeType === "bbox" && (
                <div
                  className="absolute border-2 border-brand"
                  style={{
                    left: `${pendingShape.geometry.x}%`,
                    top: `${pendingShape.geometry.y}%`,
                    width: `${pendingShape.geometry.width}%`,
                    height: `${pendingShape.geometry.height}%`,
                  }}
                />
              )}
              <svg
                className="pointer-events-none absolute inset-0 size-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {pendingShape?.shapeType === "polygon" && (
                  <polygon
                    points={pendingShape.geometry.points.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="var(--brand)"
                    fillOpacity={0.2}
                    stroke="var(--brand)"
                    strokeWidth={0.3}
                  />
                )}
                {!hideLabels &&
                  annotations
                    .filter((a) => a.polygon && a.polygon.length > 0)
                    .map((a) => (
                      <polygon
                        key={a.id}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          setContextMenu({ annotationId: a.id, x: e.clientX, y: e.clientY })
                        }}
                        style={{ pointerEvents: "auto", cursor: "context-menu" }}
                        points={a.polygon!.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill={`${a.color}33`}
                        stroke={a.color}
                        strokeWidth={0.3}
                      />
                    ))}
                {!hideLabels &&
                  Object.values(remoteDrafts)
                    .filter((d) => d.shapeType === "polygon")
                    .map((d) => {
                      const points = (d.geometry as { points?: Point[] }).points
                      if (!points || points.length === 0) return null
                      return (
                        <polyline
                          key={d.tempId}
                          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                          fill="none"
                          stroke="white"
                          strokeDasharray="1,1"
                          strokeWidth={0.3}
                        />
                      )
                    })}
                {activeTool === "polygon" && polygonPoints.length > 0 && (
                  <polyline
                    points={
                      polygonPoints.map((p) => `${p.x},${p.y}`).join(" ") +
                      (polygonHoverPos ? ` ${polygonHoverPos.x},${polygonHoverPos.y}` : "")
                    }
                    fill="none"
                    stroke="white"
                    strokeDasharray="1,1"
                    strokeWidth={0.3}
                  />
                )}
                {activeTool === "polygon" &&
                  polygonPoints.map((p, i) => {
                    const isStart = i === 0
                    const snap = isStart && isNearPolygonStart
                    return (
                      <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={snap ? 1 : 0.6}
                        fill={snap ? "#22c55e" : "white"}
                        stroke="black"
                        strokeWidth={0.1}
                      />
                    )
                  })}
              </svg>
            </div>
          </div>

          {/* Zoom bar */}
          <div className="flex items-center justify-center gap-2 border-t border-border bg-background py-2">
            <Button variant="ghost" size="icon" onClick={() => setZoom(Math.max(zoom - 0.2, 0.4))}>
              <Minus className="size-4" />
            </Button>
            <span className="w-12 text-center text-xs text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <button className="text-muted-foreground hover:text-foreground" title="Lock zoom">
              <Lock className="size-3.5" />
            </button>
            <Button variant="ghost" size="icon" onClick={() => setZoom(Math.min(zoom + 0.2, 3))}>
              <Plus className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setZoom(1)}>
              RESET
            </Button>
            <button className="text-muted-foreground hover:text-foreground" title="Brightness">
              <SunMedium className="size-4" />
            </button>
            <button className="text-muted-foreground hover:text-foreground" title="Keyboard shortcuts">
              <Keyboard className="size-4" />
            </button>
          </div>
        </div>

        {/* Right tool rail */}
        <div className="flex w-14 shrink-0 flex-col items-center gap-1 border-l border-border py-3">
          {tools.map((tool) => (
            <Button
              key={tool.key}
              variant={activeTool === tool.key ? "brand" : "ghost"}
              size="icon"
              title={tool.label}
              onClick={() => setActiveTool(tool.key)}
            >
              <tool.icon className="size-4" />
            </Button>
          ))}
          <div className="my-1.5 h-px w-8 bg-border" />
          <Button variant="ghost" size="icon" disabled title="Smart segmentation (coming soon)">
            <Brush className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" disabled title="Magic select (coming soon)">
            <Wand2 className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" disabled title="Smart polygon (coming soon)">
            <Sparkles className="size-4" />
          </Button>
          <div className="my-1.5 h-px w-8 bg-border" />
          <Button variant="ghost" size="icon" disabled title="Comments (coming soon)">
            <MessageSquare className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleUndo}
            disabled={annotations.length === 0 || deletingId !== null}
            title="Undo"
          >
            <Undo2 className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" disabled title="Redo (coming soon)">
            <Redo2 className="size-4" />
          </Button>
          <div className="my-1.5 h-px w-8 bg-border" />
          <Button variant="ghost" size="icon" disabled title="Clear (coming soon)">
            <CircleSlash className="size-4" />
          </Button>
        </div>
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 w-44 overflow-hidden rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              handleDuplicate(contextMenu.annotationId)
              setContextMenu(null)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
          >
            <Copy className="size-3.5" />
            Duplicate Object
          </button>
          <button
            onClick={() => {
              handleDelete(contextMenu.annotationId)
              setContextMenu(null)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-destructive hover:bg-accent"
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
