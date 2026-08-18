import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useNavigate, useSearchParams } from "react-router-dom"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  MoreHorizontal,
  MoreVertical,
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
  GripVertical,
  Image as ImageIcon,
  Calendar,
  Folder,
  RotateCcw,
  History as HistoryIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { useAnnotationStore, type AnnotationTool } from "@/stores/annotationStore"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useAuthStore } from "@/stores/authStore"
import { useThemeStore } from "@/stores/themeStore"
import { useToastStore } from "@/stores/toastStore"
import { useProject } from "@/hooks/useProjects"
import { useAnnotationSocket, type LockInfo } from "@/hooks/useAnnotationSocket"
import { getJobImages, moveJobToUnassigned, deleteJobAnnotations } from "@/lib/jobApi"
import { listClasses, createClass, type ProjectClass } from "@/lib/classApi"
import { listAnnotations, createAnnotation, updateAnnotation, deleteAnnotation, toStoreAnnotation } from "@/lib/annotationApi"
import {
  listImageTags, addImageTag, removeImageTag, addImageMetadata, removeImageMetadata,
  type ImageTag,
} from "@/lib/tagApi"
import { getImage, type ImageDetail } from "@/lib/imageApi"
import {
  listComments, createComment, deleteComment, getImageHistory,
  type ImageComment, type ImageHistoryEntry,
} from "@/lib/commentApi"
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
  { key: "history", icon: HistoryIcon, label: "History" },
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
  alwaysShowLabels,
  masked,
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
  alwaysShowLabels: boolean
  masked: boolean
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
        backgroundColor: masked ? annotation.color : undefined,
        cursor: selectable ? "move" : undefined,
      }}
    >
      <span
        className={cn(
          "absolute -top-5 left-0 rounded-t px-1.5 py-0.5 text-[10px] font-medium text-white transition-opacity duration-150",
          alwaysShowLabels ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        style={{ backgroundColor: annotation.color }}
      >
        {annotation.className}
      </span>
      {lockedByOther && (
        <span className="absolute -bottom-5 left-0 rounded-b bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
          {lockedBy!.userName} editing…
        </span>
      )}
      {selectable && (
        <button
          onClick={onDelete}
          disabled={lockedByOther || deleting}
          title={lockedByOther ? `Locked by ${lockedBy!.userName}` : "Delete"}
          className="absolute -top-5 right-0 hidden rounded bg-black/60 p-0.5 text-white group-hover:block disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="size-3" />
        </button>
      )}
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
  const addToast = useToastStore((s) => s.addToast)
  const { project } = useProject(projectId)
  const [images, setImages] = useState<JobImageSummary[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [classes, setClasses] = useState<ProjectClass[]>([])
  const [hideLabels, setHideLabels] = useState(false)
  const [panelTab, setPanelTab] = useState<"classes" | "layers">("classes")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [movingToUnassigned, setMovingToUnassigned] = useState(false)
  const [deletingAllAnnotations, setDeletingAllAnnotations] = useState(false)

  const [activeLeftNav, setActiveLeftNav] = useState<"labels" | "attributes" | "comments" | "history" | "raw">("labels")
  const [imageDetail, setImageDetail] = useState<ImageDetail | null>(null)
  const [metaKeyDraft, setMetaKeyDraft] = useState("")
  const [metaValueDraft, setMetaValueDraft] = useState("")
  const [savingMeta, setSavingMeta] = useState(false)

  const [comments, setComments] = useState<ImageComment[]>([])
  const [pendingComment, setPendingComment] = useState<Point | null>(null)
  const [commentDraft, setCommentDraft] = useState("")
  const [savingComment, setSavingComment] = useState(false)
  const [openCommentId, setOpenCommentId] = useState<string | null>(null)

  const [historyEntries, setHistoryEntries] = useState<ImageHistoryEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [displayOptionsOpen, setDisplayOptionsOpen] = useState(false)
  const [contrast, setContrast] = useState(100)
  const [brightness, setBrightness] = useState(100)
  const [bgDarkness, setBgDarkness] = useState(0)
  const [alwaysShowLabels, setAlwaysShowLabels] = useState(false)
  const [maskBoxes, setMaskBoxes] = useState(false)
  // "Display Mode" drives the app-wide theme (not just the canvas), so the
  // whole page — sidebars, toolbars, everything — switches, not just the
  // image backdrop.
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

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

  const [brushPoints, setBrushPoints] = useState<Point[]>([])
  const [isBrushing, setIsBrushing] = useState(false)
  const BRUSH_MIN_DISTANCE = 0.6 // percent — skip points closer than this to keep the path light

  const [imageTags, setImageTags] = useState<ImageTag[]>([])
  const [tagDraft, setTagDraft] = useState("")
  const [savingTag, setSavingTag] = useState(false)

  type PendingShape =
    | { shapeType: "bbox"; geometry: { x: number; y: number; width: number; height: number } }
    | { shapeType: "polygon"; geometry: { points: Point[] } }
  const [pendingShape, setPendingShape] = useState<PendingShape | null>(null)
  const [pendingClassName, setPendingClassName] = useState("")
  // Defaults to the currently active class so Enter-to-save works with zero
  // typing, without pre-filling the search box (which would filter the list
  // down to just that one class and hide every other option).
  const [pendingSelectedClassId, setPendingSelectedClassId] = useState<string | null>(null)
  const [savingPending, setSavingPending] = useState(false)

  const [contextMenu, setContextMenu] = useState<{ annotationId: string; x: number; y: number } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const displayOptionsRef = useRef<HTMLDivElement>(null)

  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null)
  const [hoveredPolygonId, setHoveredPolygonId] = useState<string | null>(null)
  const [hoveredLayerId, setHoveredLayerId] = useState<string | null>(null)
  type DragMode =
    | { type: "move"; annotationId: string; startPos: Point; startBbox: BoundingBox }
    | { type: "resize"; annotationId: string; handle: ResizeHandle; startPos: Point; startBbox: BoundingBox }
  const [dragMode, setDragMode] = useState<DragMode | null>(null)
  const [resizeOverride, setResizeOverride] = useState<{ id: string; bbox: BoundingBox } | null>(null)

  const [hoverViewportPos, setHoverViewportPos] = useState<Point | null>(null)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  // Pan is a CSS translate on the canvas stage (not scrollLeft/scrollTop) so the
  // viewport never grows a scrollbar and the crosshair guides can extend past
  // the image edges into the surrounding canvas, matching Roboflow's feel.
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())

  type HistoryAction =
    | { type: "create"; id: string; classId: string; shapeType: "bbox" | "polygon"; geometry: Record<string, unknown> }
    | { type: "delete"; id: string; classId: string; shapeType: "bbox" | "polygon"; geometry: Record<string, unknown> }
    | { type: "update"; id: string; before: Record<string, unknown>; after: Record<string, unknown> }
  const [undoStack, setUndoStack] = useState<HistoryAction[]>([])
  const [redoStack, setRedoStack] = useState<HistoryAction[]>([])
  function pushHistory(action: HistoryAction) {
    setUndoStack((prev) => [...prev, action])
    setRedoStack([])
  }

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

  useEffect(() => {
    if (!workspaceId || !projectId || !currentImage) return
    if (activeLeftNav !== "attributes" && activeLeftNav !== "raw") return
    setImageDetail(null)
    getImage(workspaceId, projectId, currentImage.id).then(setImageDetail)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, projectId, currentImage?.id, activeLeftNav])

  // Comment pins render on the canvas regardless of which left-nav tab is
  // open, so they're loaded on every image change, not just on "Comments".
  useEffect(() => {
    if (!workspaceId || !projectId || !currentImage) return
    listComments(workspaceId, projectId, currentImage.id).then(setComments)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, projectId, currentImage?.id])

  useEffect(() => {
    if (!workspaceId || !projectId || !currentImage || activeLeftNav !== "history") return
    setLoadingHistory(true)
    getImageHistory(workspaceId, projectId, currentImage.id)
      .then(setHistoryEntries)
      .finally(() => setLoadingHistory(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, projectId, currentImage?.id, activeLeftNav])

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

  async function handleAddMetadata() {
    const key = metaKeyDraft.trim()
    const value = metaValueDraft.trim()
    if (!workspaceId || !projectId || !currentImage || !key) return
    setSavingMeta(true)
    try {
      await addImageMetadata(workspaceId, projectId, currentImage.id, key, value)
      setImageDetail((prev) =>
        prev
          ? { ...prev, metadata: [...prev.metadata.filter((m) => m.key !== key), { key, value }] }
          : prev
      )
      setMetaKeyDraft("")
      setMetaValueDraft("")
    } finally {
      setSavingMeta(false)
    }
  }

  async function handleRemoveMetadata(key: string) {
    if (!workspaceId || !projectId || !currentImage) return
    setImageDetail((prev) => (prev ? { ...prev, metadata: prev.metadata.filter((m) => m.key !== key) } : prev))
    await removeImageMetadata(workspaceId, projectId, currentImage.id, key)
  }

  async function handleAddComment() {
    if (!workspaceId || !projectId || !currentImage || !pendingComment || !commentDraft.trim()) return
    setSavingComment(true)
    try {
      const comment = await createComment(workspaceId, projectId, currentImage.id, {
        x: pendingComment.x, y: pendingComment.y, text: commentDraft.trim(),
      })
      setComments((prev) => [...prev, comment])
      setPendingComment(null)
      setCommentDraft("")
    } finally {
      setSavingComment(false)
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!workspaceId || !projectId || !currentImage) return
    setComments((prev) => prev.filter((c) => c.id !== commentId))
    setOpenCommentId(null)
    await deleteComment(workspaceId, projectId, currentImage.id, commentId)
  }

  function copyJson(value: unknown) {
    navigator.clipboard.writeText(JSON.stringify(value, null, 4))
  }

  // Switching images or tools mid-polygon-draw abandons the in-progress shape
  // rather than carrying stray points onto a different image/tool.
  useEffect(() => {
    setPolygonPoints([])
    setPolygonHoverPos(null)
    setBrushPoints([])
    setIsBrushing(false)
    drawTempIdRef.current = null
    setPendingShape(null)
    setPendingClassName("")
    setPendingSelectedClassId(null)
    setSelectedAnnotationId(null)
    setEditingAnnotationId(null)
    setPendingComment(null)
    setCommentDraft("")
    setOpenCommentId(null)
  }, [currentImage?.id, activeTool])

  // Undo/redo history and per-layer visibility are scoped to a single image.
  useEffect(() => {
    setUndoStack([])
    setRedoStack([])
    setHiddenIds(new Set())
    setHoveredPolygonId(null)
    setHoveredLayerId(null)
  }, [currentImage?.id])

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
        setPendingSelectedClassId(null)
      }
      if (e.key === "Escape" && editingAnnotationId) {
        setEditingAnnotationId(null)
        setPendingClassName("")
        setPendingSelectedClassId(null)
      }
      if (e.key === "Escape" && pendingComment) {
        setPendingComment(null)
        setCommentDraft("")
      }
      if (
        (pendingShape || editingAnnotationId) &&
        e.key >= "1" &&
        e.key <= "9" &&
        document.activeElement?.tagName !== "INPUT"
      ) {
        const filtered = classes.filter((c) =>
          c.name.toLowerCase().includes(pendingClassName.trim().toLowerCase())
        )
        const picked = filtered[Number(e.key) - 1]
        if (picked) {
          if (pendingShape) handleSavePendingShape(picked.id)
          else handleUpdateAnnotationClass(picked.id)
        }
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [polygonPoints.length, pendingShape, editingAnnotationId, classes, pendingClassName, pendingComment])

  // Standard Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z) undo/redo shortcuts, matching
  // the toolbar buttons — most people reach for these before the icons.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || document.activeElement?.tagName === "INPUT") return
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey)) {
        e.preventDefault()
        handleRedo()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [undoStack, redoStack, workspaceId, projectId, currentImage])

  // Space-held → pan mode (grab cursor + drag-to-scroll), same as Figma/Photoshop.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault()
        setSpaceHeld(true)
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") setSpaceHeld(false)
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
    }
  }, [])

  useEffect(() => {
    if (!isPanning) return
    function onMove(e: MouseEvent) {
      const start = panStartRef.current
      if (!start) return
      setPan({ x: start.panX + (e.clientX - start.x), y: start.panY + (e.clientY - start.y) })
    }
    function onUp() {
      panStartRef.current = null
      setIsPanning(false)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [isPanning])

  useEffect(() => {
    if (!contextMenu) return
    function close(e: MouseEvent) {
      if (contextMenuRef.current?.contains(e.target as Node)) return
      setContextMenu(null)
    }
    window.addEventListener("mousedown", close)
    return () => window.removeEventListener("mousedown", close)
  }, [contextMenu])

  useEffect(() => {
    if (!displayOptionsOpen) return
    function close(e: MouseEvent) {
      if (displayOptionsRef.current?.contains(e.target as Node)) return
      setDisplayOptionsOpen(false)
    }
    window.addEventListener("mousedown", close)
    return () => window.removeEventListener("mousedown", close)
  }, [displayOptionsOpen])

  const classCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of annotations) {
      counts.set(a.classId, (counts.get(a.classId) ?? 0) + 1)
    }
    return counts
  }, [annotations])

  const sourceDataJson = useMemo(() => {
    if (!currentImage || !imageDetail) return null
    const classGroups: Record<string, number> = {}
    for (const a of annotations) classGroups[a.className] = (classGroups[a.className] ?? 0) + 1
    return {
      id: currentImage.id,
      name: imageDetail.filename,
      width: imageDetail.width,
      height: imageDetail.height,
      project: project?.name ?? null,
      batch: imageDetail.batch_name,
      classes: classGroups,
      tags: imageTags.map((t) => t.name),
      metadata: Object.fromEntries(imageDetail.metadata.map((m) => [m.key, m.value])),
      updated: imageDetail.updated_at,
    }
  }, [currentImage, imageDetail, annotations, project, imageTags])

  const annotationDataJson = useMemo(() => {
    if (!currentImage || !imageDetail?.width || !imageDetail?.height) return null
    const w = imageDetail.width
    const h = imageDetail.height
    const boxes = annotations
      .filter((a) => a.bbox)
      .map((a) => ({
        id: a.id,
        label: a.className,
        x: Number(((a.bbox!.x / 100) * w).toFixed(2)),
        y: Number(((a.bbox!.y / 100) * h).toFixed(2)),
        width: Number(((a.bbox!.width / 100) * w).toFixed(2)),
        height: Number(((a.bbox!.height / 100) * h).toFixed(2)),
        confidence: null as null,
      }))
    const polygons = annotations
      .filter((a) => a.polygon && a.polygon.length > 0)
      .map((a) => ({
        id: a.id,
        label: a.className,
        points: a.polygon!.map((p) => [
          Number(((p.x / 100) * w).toFixed(2)),
          Number(((p.y / 100) * h).toFixed(2)),
        ]),
        confidence: null as null,
      }))
    return { key: currentImage.filename, width: w, height: h, boxes, polygons }
  }, [currentImage, imageDetail, annotations])

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

  function startPan(e: React.MouseEvent) {
    panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
    setIsPanning(true)
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (spaceHeld) {
      startPan(e)
      return
    }
    // Overlays for existing annotations stop propagation on their own
    // mousedown, so reaching here means the click landed on empty canvas —
    // clear any selection and pan, same as Roboflow's select/drag tool.
    if (activeTool === "select") {
      setSelectedAnnotationId(null)
      startPan(e)
      return
    }
    if (activeTool === "brush") {
      drawTempIdRef.current = crypto.randomUUID()
      setIsBrushing(true)
      setBrushPoints([getRelativePos(e)])
      return
    }
    if (activeTool !== "bbox") return
    drawTempIdRef.current = crypto.randomUUID()
    setDrawStart(getRelativePos(e))
  }

  function handleMouseMove(e: React.MouseEvent) {
    const pos = getRelativePos(e)
    const viewportRect = scrollRef.current?.getBoundingClientRect()
    if (viewportRect) {
      setHoverViewportPos({ x: e.clientX - viewportRect.left, y: e.clientY - viewportRect.top })
    }

    if (activeTool === "polygon" && polygonPoints.length > 0) {
      setPolygonHoverPos(pos)
      const now = Date.now()
      if (drawTempIdRef.current && now - lastPreviewSentRef.current > 60) {
        lastPreviewSentRef.current = now
        sendDragPreview("polygon", { points: polygonPoints }, drawTempIdRef.current)
      }
    }

    if (isBrushing) {
      setBrushPoints((prev) => {
        const last = prev[prev.length - 1]
        if (last && Math.hypot(pos.x - last.x, pos.y - last.y) < BRUSH_MIN_DISTANCE) return prev
        return [...prev, pos]
      })
      const now = Date.now()
      if (drawTempIdRef.current && now - lastPreviewSentRef.current > 60) {
        lastPreviewSentRef.current = now
        sendDragPreview("polygon", { points: brushPoints }, drawTempIdRef.current)
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
    setPendingClassName("")
    setPendingSelectedClassId(activeClassId)
  }

  function handleCanvasClick(e: React.MouseEvent) {
    if (activeTool === "comment") {
      setPendingComment(getRelativePos(e))
      setCommentDraft("")
      return
    }
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
    if (isBrushing) {
      setIsBrushing(false)
      const points = brushPoints
      setBrushPoints([])
      drawTempIdRef.current = null
      if (points.length < 3 || !currentImage) return
      setPendingShape({ shapeType: "polygon", geometry: { points } })
      setPendingClassName("")
      setPendingSelectedClassId(activeClassId)
      return
    }

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
    setPendingClassName("")
    setPendingSelectedClassId(activeClassId)
  }

  async function handleDelete(annotationId: string) {
    if (!workspaceId || !projectId || !currentImage) return
    const ann = annotations.find((a) => a.id === annotationId)
    setDeletingId(annotationId)
    acquireLock(annotationId)
    try {
      await deleteAnnotation(workspaceId, projectId, currentImage.id, annotationId)
      // WS "deleted" broadcast removes it from the store, same as create.
      if (ann) {
        pushHistory({
          type: "delete",
          id: annotationId,
          classId: ann.classId,
          shapeType: ann.bbox ? "bbox" : "polygon",
          geometry: (ann.bbox ?? { points: ann.polygon }) as unknown as Record<string, unknown>,
        })
      }
    } catch {
      addToast({ variant: "error", title: "Couldn't delete annotation", description: "Please try again." })
    } finally {
      releaseLock(annotationId)
      setDeletingId(null)
    }
  }

  async function handleMoveToUnassigned() {
    if (!workspaceId || !projectId || !jobId) return
    setMovingToUnassigned(true)
    try {
      await moveJobToUnassigned(workspaceId, projectId, jobId)
      addToast({ variant: "success", title: "Moved to unassigned" })
      navigate(`/projects/${projectId}/annotate`)
    } catch {
      addToast({ variant: "error", title: "Couldn't move to unassigned", description: "Please try again." })
    } finally {
      setMovingToUnassigned(false)
    }
  }

  async function handleDeleteAllAnnotations() {
    if (!workspaceId || !projectId || !jobId || !currentImage) return
    setDeletingAllAnnotations(true)
    try {
      await deleteJobAnnotations(workspaceId, projectId, jobId)
      const rows = await listAnnotations(workspaceId, projectId, currentImage.id)
      setAnnotations(rows.map(toStoreAnnotation))
      addToast({ variant: "success", title: "Annotations deleted" })
    } catch {
      addToast({ variant: "error", title: "Couldn't delete annotations", description: "Please try again." })
    } finally {
      setDeletingAllAnnotations(false)
    }
  }

  async function handleUndo() {
    const entry = undoStack[undoStack.length - 1]
    if (!entry || !workspaceId || !projectId || !currentImage) return
    setUndoStack((prev) => prev.slice(0, -1))
    try {
      if (entry.type === "create") {
        await deleteAnnotation(workspaceId, projectId, currentImage.id, entry.id)
        setRedoStack((prev) => [...prev, entry])
      } else if (entry.type === "delete") {
        const created = await createAnnotation(workspaceId, projectId, currentImage.id, {
          classId: entry.classId,
          shapeType: entry.shapeType,
          geometry: entry.geometry,
        })
        setRedoStack((prev) => [...prev, { ...entry, id: created.id }])
      } else {
        await updateAnnotation(workspaceId, projectId, currentImage.id, entry.id, { geometry: entry.before })
        setRedoStack((prev) => [...prev, entry])
      }
    } catch (err) {
      console.error("Undo failed:", err)
      setUndoStack((prev) => [...prev, entry])
    }
  }

  async function handleRedo() {
    const entry = redoStack[redoStack.length - 1]
    if (!entry || !workspaceId || !projectId || !currentImage) return
    setRedoStack((prev) => prev.slice(0, -1))
    try {
      if (entry.type === "create") {
        const created = await createAnnotation(workspaceId, projectId, currentImage.id, {
          classId: entry.classId,
          shapeType: entry.shapeType,
          geometry: entry.geometry,
        })
        setUndoStack((prev) => [...prev, { ...entry, id: created.id }])
      } else if (entry.type === "delete") {
        await deleteAnnotation(workspaceId, projectId, currentImage.id, entry.id)
        setUndoStack((prev) => [...prev, entry])
      } else {
        await updateAnnotation(workspaceId, projectId, currentImage.id, entry.id, { geometry: entry.after })
        setUndoStack((prev) => [...prev, entry])
      }
    } catch (err) {
      console.error("Redo failed:", err)
      setRedoStack((prev) => [...prev, entry])
    }
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

  async function handleSavePendingShape(explicitClassId?: string) {
    if (!pendingShape || !workspaceId || !projectId || !currentImage) return
    const preselected = explicitClassId ?? pendingSelectedClassId
    if (!preselected && !pendingClassName.trim()) return
    setSavingPending(true)
    try {
      const classId = preselected ?? (await resolveClassId(pendingClassName))
      if (!classId) return
      const created = await createAnnotation(workspaceId, projectId, currentImage.id, {
        classId,
        shapeType: pendingShape.shapeType,
        geometry: pendingShape.geometry,
      })
      pushHistory({
        type: "create",
        id: created.id,
        classId,
        shapeType: pendingShape.shapeType,
        geometry: pendingShape.geometry as unknown as Record<string, unknown>,
      })
      setActiveClassId(classId)
      setPendingShape(null)
      setPendingClassName("")
      setPendingSelectedClassId(null)
    } catch {
      // ignore — no toast system yet
    } finally {
      setSavingPending(false)
    }
  }

  function handleDiscardPendingShape() {
    setPendingShape(null)
    setPendingClassName("")
    setPendingSelectedClassId(null)
  }

  function openAnnotationEditor(annotationId: string) {
    const ann = annotations.find((a) => a.id === annotationId)
    if (!ann) return
    setEditingAnnotationId(annotationId)
    setPendingClassName("")
    setPendingSelectedClassId(ann.classId)
  }

  function closeAnnotationEditor() {
    setEditingAnnotationId(null)
    setPendingClassName("")
    setPendingSelectedClassId(null)
  }

  async function handleUpdateAnnotationClass(explicitClassId?: string) {
    if (!editingAnnotationId || !workspaceId || !projectId || !currentImage) return
    const targetClassId = explicitClassId ?? pendingSelectedClassId
    if (!targetClassId && !pendingClassName.trim()) return
    setSavingPending(true)
    try {
      const classId = targetClassId ?? (await resolveClassId(pendingClassName))
      if (!classId) return
      await updateAnnotation(workspaceId, projectId, currentImage.id, editingAnnotationId, { classId })
      setActiveClassId(classId)
      closeAnnotationEditor()
    } catch {
      // ignore — no toast system yet
    } finally {
      setSavingPending(false)
    }
  }

  async function handleDeleteEditingAnnotation() {
    if (!editingAnnotationId) return
    const id = editingAnnotationId
    closeAnnotationEditor()
    await handleDelete(id)
  }

  async function handleDuplicate(annotationId: string) {
    const ann = annotations.find((a) => a.id === annotationId)
    if (!ann || !workspaceId || !projectId || !currentImage) return
    const OFFSET = 3
    try {
      if (ann.bbox) {
        const geometry = {
          x: ann.bbox.x + OFFSET, y: ann.bbox.y + OFFSET,
          width: ann.bbox.width, height: ann.bbox.height,
        }
        const created = await createAnnotation(workspaceId, projectId, currentImage.id, {
          classId: ann.classId,
          shapeType: "bbox",
          geometry,
        })
        pushHistory({ type: "create", id: created.id, classId: ann.classId, shapeType: "bbox", geometry })
      } else if (ann.polygon) {
        const geometry = { points: ann.polygon.map((p) => ({ x: p.x + OFFSET, y: p.y + OFFSET })) }
        const created = await createAnnotation(workspaceId, projectId, currentImage.id, {
          classId: ann.classId,
          shapeType: "polygon",
          geometry,
        })
        pushHistory({ type: "create", id: created.id, classId: ann.classId, shapeType: "polygon", geometry })
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
                .then(() => {
                  pushHistory({
                    type: "update",
                    id: current.annotationId,
                    before: current.startBbox as unknown as Record<string, unknown>,
                    after: override.bbox as unknown as Record<string, unknown>,
                  })
                })
                .catch(() => {})
                .finally(() => releaseLock(current.annotationId))
            } else {
              releaseLock(current.annotationId)
              // No actual movement happened — treat this as a plain click on
              // the shape (not a drag) and open its class editor.
              if (current.type === "move") {
                openAnnotationEditor(current.annotationId)
              }
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="More">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={movingToUnassigned} onClick={handleMoveToUnassigned}>
                Move to unassigned
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={deletingAllAnnotations}
                onClick={handleDeleteAllAnnotations}
                className="text-destructive focus:text-destructive"
              >
                Delete all annotations
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left icon rail */}
        <div className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border py-3">
          {leftNavItems.map((item) => {
            const enabled =
              item.key === "labels" ||
              item.key === "attributes" ||
              item.key === "comments" ||
              item.key === "history" ||
              item.key === "raw"
            return (
              <button
                key={item.key}
                disabled={!enabled}
                onClick={() =>
                  enabled && setActiveLeftNav(item.key as "labels" | "attributes" | "comments" | "history" | "raw")
                }
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md px-2 py-2 text-[10px]",
                  enabled
                    ? activeLeftNav === item.key
                      ? "text-brand"
                      : "text-muted-foreground hover:text-foreground"
                    : "cursor-default text-muted-foreground/50"
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </button>
            )
          })}
        </div>

        {/* Classes / Tags panel */}
        <div className="no-scrollbar flex w-64 shrink-0 flex-col overflow-y-auto border-r border-border p-3">
          {activeLeftNav === "attributes" ? (
            <>
              <p className="mb-3 text-xs font-semibold text-foreground">Attributes</p>
              <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border p-3">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                    <ImageIcon className="size-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{currentImage?.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {imageDetail?.width && imageDetail?.height
                        ? `${imageDetail.width}X${imageDetail.height}  ${((imageDetail.width * imageDetail.height) / 1_000_000).toFixed(2)}MP`
                        : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Calendar className="size-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">
                      {imageDetail
                        ? `Updated ${new Date(imageDetail.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                        : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {imageDetail ? new Date(imageDetail.updated_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Folder className="size-3.5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-foreground">{imageDetail?.batch_name ?? "—"}</p>
                </div>
              </div>

              <p className="mb-2 text-xs font-semibold text-foreground">Metadata</p>
              {!imageDetail || imageDetail.metadata.length === 0 ? (
                <div className="mb-3 flex flex-col items-center gap-1 rounded-md border border-dashed border-border py-6 text-center">
                  <TagIcon className="mb-1 size-4 text-muted-foreground" />
                  <p className="text-xs font-medium text-foreground">No Metadata</p>
                  <p className="px-2 text-xs text-muted-foreground">Add key-value pairs to this image</p>
                </div>
              ) : (
                <div className="mb-3 flex flex-col gap-1.5">
                  {imageDetail.metadata.map((m) => (
                    <div
                      key={m.key}
                      className="group flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5"
                    >
                      <span className="truncate text-xs font-medium text-foreground">{m.key}</span>
                      <span className="flex-1 truncate text-xs text-muted-foreground">{m.value}</span>
                      <button
                        onClick={() => handleRemoveMetadata(m.key)}
                        className="text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-1.5">
                <Input
                  placeholder="Key"
                  className="h-8 text-xs"
                  value={metaKeyDraft}
                  onChange={(e) => setMetaKeyDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddMetadata()
                  }}
                />
                <Input
                  placeholder="Value"
                  className="h-8 text-xs"
                  value={metaValueDraft}
                  onChange={(e) => setMetaValueDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddMetadata()
                  }}
                />
                <Button
                  size="sm"
                  variant="brand"
                  onClick={handleAddMetadata}
                  disabled={savingMeta || !metaKeyDraft.trim()}
                >
                  <Plus className="size-3.5" />
                  Add
                </Button>
              </div>
            </>
          ) : activeLeftNav === "comments" ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">Comments</p>
                <MoreHorizontal className="size-4 text-muted-foreground" />
              </div>
              {comments.length === 0 ? (
                <div className="mt-10 flex flex-col items-center gap-1 text-center">
                  <div className="mb-1 flex size-9 items-center justify-center rounded-md bg-muted">
                    <MessageSquare className="size-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No Comments</p>
                  <p className="px-4 text-xs text-muted-foreground">
                    Use the comment tool to add comments to this image.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {comments.map((c) => (
                    <div key={c.id} className="rounded-lg border border-border p-2.5">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-xs font-medium text-foreground">{c.author_name ?? "Someone"}</p>
                        <button
                          onClick={() => handleDeleteComment(c.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                      <p className="whitespace-pre-wrap text-xs text-muted-foreground">{c.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : activeLeftNav === "history" ? (
            <>
              <p className="mb-3 text-xs font-semibold text-foreground">History</p>
              {loadingHistory ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : historyEntries.length === 0 ? (
                <div className="mt-10 flex flex-col items-center gap-1 text-center">
                  <div className="mb-1 flex size-9 items-center justify-center rounded-md bg-muted">
                    <HistoryIcon className="size-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No History</p>
                  <p className="px-4 text-xs text-muted-foreground">
                    Annotation activity on this image will show up here.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {historyEntries.map((h) => (
                    <div key={h.id} className="flex items-start gap-2 rounded-lg border border-border p-2.5">
                      <HistoryIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-xs text-foreground">{h.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {h.user_name ?? "Someone"} · {new Date(h.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : activeLeftNav === "raw" ? (
            <>
              <p className="mb-3 text-xs font-semibold text-foreground">Raw Data</p>

              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Source Data</p>
              <div className="relative mb-4 rounded-lg border border-border bg-muted/40">
                <button
                  onClick={() => copyJson(sourceDataJson)}
                  disabled={!sourceDataJson}
                  className="absolute right-2 top-2 rounded-md bg-background p-1 text-muted-foreground shadow-sm hover:text-foreground"
                  title="Copy"
                >
                  <Copy className="size-3.5" />
                </button>
                <pre className="no-scrollbar max-h-64 overflow-auto p-3 text-[10px] leading-relaxed text-foreground">
                  {sourceDataJson ? JSON.stringify(sourceDataJson, null, 4) : "Loading…"}
                </pre>
              </div>

              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Annotation Data</p>
              <div className="relative rounded-lg border border-border bg-muted/40">
                <button
                  onClick={() => copyJson(annotationDataJson)}
                  disabled={!annotationDataJson}
                  className="absolute right-2 top-2 rounded-md bg-background p-1 text-muted-foreground shadow-sm hover:text-foreground"
                  title="Copy"
                >
                  <Copy className="size-3.5" />
                </button>
                <pre className="no-scrollbar max-h-64 overflow-auto p-3 text-[10px] leading-relaxed text-foreground">
                  {annotationDataJson ? JSON.stringify(annotationDataJson, null, 4) : "Loading…"}
                </pre>
              </div>
            </>
          ) : (
            <>
          <div className="mb-2.5 flex shrink-0 items-center gap-2">
            <p className="text-xs font-semibold text-foreground">Annotations</p>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {annotations.length}
            </span>
          </div>

          {(pendingShape || editingAnnotationId) && (
            <div className="mb-4 shrink-0 overflow-hidden rounded-lg border border-brand/40 bg-brand/5">
              <div className="flex items-center justify-between border-b border-brand/20 px-3 py-2">
                <p className="text-xs font-semibold text-foreground">Annotation Editor</p>
                <div className="flex items-center gap-2">
                  <button title="More" className="text-muted-foreground hover:text-foreground">
                    <MoreVertical className="size-3.5" />
                  </button>
                  <button
                    onClick={pendingShape ? handleDiscardPendingShape : closeAnnotationEditor}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
              <div className="p-3">
                <Input
                  value={pendingClassName}
                  onChange={(e) => {
                    setPendingClassName(e.target.value)
                    setPendingSelectedClassId(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (pendingShape) handleSavePendingShape()
                      else handleUpdateAnnotationClass()
                    }
                    if (e.key === "Escape") {
                      if (pendingShape) handleDiscardPendingShape()
                      else closeAnnotationEditor()
                    }
                  }}
                  placeholder="Search or create a class…"
                  className="h-8 text-sm"
                  autoFocus
                />
                <div className="mt-2.5 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={pendingShape ? handleDiscardPendingShape : handleDeleteEditingAnnotation}
                  >
                    Delete
                  </Button>
                  <Button
                    variant="brand"
                    size="sm"
                    className="flex-1"
                    onClick={() => (pendingShape ? handleSavePendingShape() : handleUpdateAnnotationClass())}
                    disabled={savingPending || (!pendingSelectedClassId && !pendingClassName.trim())}
                  >
                    {savingPending ? "Saving…" : "Save (Enter)"}
                  </Button>
                </div>
                <div className="mt-2.5 flex max-h-48 flex-col gap-0.5 overflow-y-auto">
                  {classes
                    .filter((c) => c.name.toLowerCase().includes(pendingClassName.trim().toLowerCase()))
                    .map((c, i) => (
                      <button
                        key={c.id}
                        onClick={() => (pendingShape ? handleSavePendingShape(c.id) : handleUpdateAnnotationClass(c.id))}
                        className={cn(
                          "flex items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-accent",
                          pendingSelectedClassId === c.id && "bg-brand text-brand-foreground hover:bg-brand"
                        )}
                      >
                        {i < 9 && (
                          <span
                            className={cn(
                              "flex size-4 shrink-0 items-center justify-center rounded border border-border text-[10px] text-muted-foreground",
                              pendingSelectedClassId === c.id && "border-brand-foreground/40 text-brand-foreground"
                            )}
                          >
                            {i + 1}
                          </span>
                        )}
                        <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: c.color }} />
                        <span className="flex-1 truncate">{c.name}</span>
                      </button>
                    ))}
                  {classes.filter((c) =>
                    c.name.toLowerCase().includes(pendingClassName.trim().toLowerCase())
                  ).length === 0 && (
                    <p className="px-1.5 py-1 text-xs text-muted-foreground">No matching classes.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <Tabs
            className="shrink-0"
            value={panelTab}
            onValueChange={(v) => setPanelTab(v as "classes" | "layers")}
          >
            <TabsList className="mb-2.5 h-8 w-full">
              <TabsTrigger value="classes" className="flex-1 text-xs">
                Classes
              </TabsTrigger>
              <TabsTrigger value="layers" className="flex-1 text-xs">
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
                          "flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-accent",
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

              {unusedClasses.length > 0 && (
                <>
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Unused Classes</p>
                  <div className="mb-3 flex flex-col gap-1">
                    {unusedClasses.map((cls) => (
                      <button
                        key={cls.id}
                        onClick={() => setActiveClassId(cls.id)}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-accent",
                          activeClassId === cls.id && "bg-accent"
                        )}
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: cls.color }}
                        />
                        <span className="flex-1 truncate text-muted-foreground italic">{cls.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {classes.length === 0 && (
                <p className="text-xs text-muted-foreground">No classes on this project yet.</p>
              )}
            </TabsContent>

            <TabsContent value="layers">
              {annotations.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">No layers yet.</p>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {annotations.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => {
                        setActiveTool("select")
                        setSelectedAnnotationId(a.id)
                      }}
                      onMouseEnter={() => setHoveredLayerId(a.id)}
                      onMouseLeave={() => setHoveredLayerId((id) => (id === a.id ? null : id))}
                      className={cn(
                        "group flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-accent",
                        selectedAnnotationId === a.id && "bg-accent"
                      )}
                    >
                      <GripVertical className="size-3.5 shrink-0 text-muted-foreground/40" />
                      <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: a.color }} />
                      <span className="flex-1 truncate text-foreground">{a.className}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setHiddenIds((prev) => {
                            const next = new Set(prev)
                            if (next.has(a.id)) next.delete(a.id)
                            else next.add(a.id)
                            return next
                          })
                        }}
                        className="text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
                        title={hiddenIds.has(a.id) ? "Show" : "Hide"}
                      >
                        {hiddenIds.has(a.id) ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setContextMenu({ annotationId: a.id, x: e.clientX, y: e.clientY })
                        }}
                        className="text-muted-foreground hover:text-foreground"
                        title="More"
                      >
                        <MoreHorizontal className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="mt-auto shrink-0 border-t border-border pt-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
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
            </>
          )}
        </div>

        {/* Canvas */}
        <div className={cn("relative flex flex-1 flex-col overflow-hidden", theme === "light" ? "bg-neutral-200" : "bg-neutral-900")}>
          <div ref={scrollRef} className="relative flex flex-1 items-center justify-center overflow-hidden">
            <div
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => setHoverViewportPos(null)}
              onClick={handleCanvasClick}
              onDoubleClick={handleCanvasDoubleClick}
              className="relative select-none"
              style={{
                width: 800,
                height: 560,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                cursor: isPanning
                  ? "grabbing"
                  : spaceHeld || activeTool === "select"
                    ? "grab"
                    : activeTool === "bbox" ||
                        activeTool === "polygon" ||
                        activeTool === "brush" ||
                        activeTool === "comment"
                      ? "crosshair"
                      : "default",
              }}
            >
              <img
                src={currentImage.url}
                alt={currentImage.filename}
                className="size-full rounded object-cover"
                style={{ filter: `contrast(${contrast}%) brightness(${brightness}%)` }}
                draggable={false}
              />
              {bgDarkness > 0 && (
                <div
                  className="pointer-events-none absolute inset-0 rounded"
                  style={{ backgroundColor: `rgba(0,0,0,${bgDarkness / 100})` }}
                />
              )}
              {(activeTool === "select" || hoveredLayerId) && !hideLabels && (
                <svg
                  className="pointer-events-none absolute inset-0 size-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <mask id="annotate-spotlight-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
                      <rect x="0" y="0" width="100" height="100" fill="white" />
                      {annotations
                        .filter((a) => !hiddenIds.has(a.id) && (!hoveredLayerId || a.id === hoveredLayerId))
                        .map((a) => {
                          const bbox = a.bbox && (resizeOverride?.id === a.id ? resizeOverride.bbox : a.bbox)
                          if (bbox) {
                            return (
                              <rect
                                key={a.id}
                                x={bbox.x}
                                y={bbox.y}
                                width={bbox.width}
                                height={bbox.height}
                                fill="black"
                              />
                            )
                          }
                          if (a.polygon && a.polygon.length > 0) {
                            return (
                              <polygon
                                key={a.id}
                                points={a.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
                                fill="black"
                              />
                            )
                          }
                          return null
                        })}
                    </mask>
                  </defs>
                  <rect
                    x="0"
                    y="0"
                    width="100"
                    height="100"
                    fill="black"
                    fillOpacity={0.45}
                    mask="url(#annotate-spotlight-mask)"
                  />
                  {hoveredLayerId &&
                    annotations
                      .filter((a) => a.id === hoveredLayerId)
                      .map((a) => {
                        const bbox = a.bbox && (resizeOverride?.id === a.id ? resizeOverride.bbox : a.bbox)
                        if (bbox) {
                          return (
                            <rect
                              key={a.id}
                              x={bbox.x}
                              y={bbox.y}
                              width={bbox.width}
                              height={bbox.height}
                              fill={a.color}
                              fillOpacity={0.85}
                            />
                          )
                        }
                        if (a.polygon && a.polygon.length > 0) {
                          return (
                            <polygon
                              key={a.id}
                              points={a.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
                              fill={a.color}
                              fillOpacity={0.85}
                            />
                          )
                        }
                        return null
                      })}
                </svg>
              )}
              {!hideLabels &&
                annotations
                  .filter((a) => a.bbox && !hiddenIds.has(a.id))
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
                      alwaysShowLabels={alwaysShowLabels}
                      masked={maskBoxes}
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
                annotations
                  .filter((a) => a.polygon && a.polygon.length > 0 && !hiddenIds.has(a.id))
                  .map((a) => {
                    const minX = Math.min(...a.polygon!.map((p) => p.x))
                    const minY = Math.min(...a.polygon!.map((p) => p.y))
                    return (
                      <span
                        key={a.id}
                        className={cn(
                          "pointer-events-none absolute rounded-t px-1.5 py-0.5 text-[10px] font-medium text-white transition-opacity duration-150",
                          alwaysShowLabels || hoveredPolygonId === a.id ? "opacity-100" : "opacity-0"
                        )}
                        style={{ left: `${minX}%`, top: `${minY}%`, transform: "translateY(-100%)", backgroundColor: a.color }}
                      >
                        {a.className}
                      </span>
                    )
                  })}
              {comments.map((c) => (
                <div key={c.id} className="absolute z-10" style={{ left: `${c.x}%`, top: `${c.y}%` }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenCommentId((id) => (id === c.id ? null : c.id))
                    }}
                    className="flex size-6 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full rounded-bl-none bg-brand text-white shadow-md hover:brightness-110"
                    title={c.text}
                  >
                    <MessageSquare className="size-3.5" />
                  </button>
                  {openCommentId === c.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute left-1/2 top-1 z-20 w-56 -translate-x-1/2 rounded-lg border border-border bg-popover p-3 text-left shadow-lg"
                    >
                      <p className="mb-1 text-xs font-medium text-foreground">{c.author_name ?? "Someone"}</p>
                      <p className="whitespace-pre-wrap text-xs text-muted-foreground">{c.text}</p>
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="mt-2 text-xs text-destructive hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {pendingComment && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute z-20 w-56 -translate-x-1/2 rounded-lg border border-brand/40 bg-popover p-3 shadow-lg"
                  style={{ left: `${pendingComment.x}%`, top: `${pendingComment.y}%` }}
                >
                  <textarea
                    autoFocus
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setPendingComment(null)
                        setCommentDraft("")
                      }
                    }}
                    placeholder="Leave a comment…"
                    className="h-16 w-full resize-none rounded-md border border-input bg-background p-1.5 text-xs outline-none"
                  />
                  <div className="mt-1.5 flex justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setPendingComment(null)
                        setCommentDraft("")
                      }}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" variant="brand" onClick={handleAddComment} disabled={savingComment || !commentDraft.trim()}>
                      {savingComment ? "Posting…" : "Post"}
                    </Button>
                  </div>
                </div>
              )}
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
              {!hideLabels && pendingShape?.shapeType === "bbox" && (
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
                {!hideLabels && pendingShape?.shapeType === "polygon" && (
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
                    .filter((a) => a.polygon && a.polygon.length > 0 && !hiddenIds.has(a.id))
                    .map((a) => (
                      <polygon
                        key={a.id}
                        onClick={() => {
                          if (activeTool === "select") openAnnotationEditor(a.id)
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          setContextMenu({ annotationId: a.id, x: e.clientX, y: e.clientY })
                        }}
                        onMouseEnter={() => setHoveredPolygonId(a.id)}
                        onMouseLeave={() => setHoveredPolygonId((id) => (id === a.id ? null : id))}
                        style={{
                          pointerEvents: "auto",
                          cursor: activeTool === "select" ? "pointer" : "context-menu",
                        }}
                        points={a.polygon!.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill={maskBoxes ? a.color : `${a.color}33`}
                        fillOpacity={maskBoxes ? 0.85 : 1}
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
                {isBrushing && brushPoints.length > 0 && (
                  <polyline
                    points={brushPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke="var(--brand)"
                    strokeWidth={0.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
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
            {hoverViewportPos && !isPanning && !spaceHeld && (
              <>
                <div
                  className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed"
                  style={{ top: `${hoverViewportPos.y}px`, borderColor: "rgba(255,255,255,0.9)" }}
                />
                <div
                  className="pointer-events-none absolute inset-y-0 border-l-2 border-dashed"
                  style={{ left: `${hoverViewportPos.x}px`, borderColor: "rgba(255,255,255,0.9)" }}
                />
              </>
            )}
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setZoom(1)
                setPan({ x: 0, y: 0 })
              }}
            >
              RESET
            </Button>
            <div className="relative" ref={displayOptionsRef}>
              <button
                onClick={() => setDisplayOptionsOpen((v) => !v)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground",
                  displayOptionsOpen && "bg-accent text-brand"
                )}
                title="Display options"
              >
                <SunMedium className="size-4" />
              </button>
              {displayOptionsOpen && (
                <div className="absolute bottom-full right-0 z-30 mb-2 w-64 rounded-lg border border-border bg-popover p-4 shadow-lg">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-popover-foreground">Display Options</p>
                    <button
                      title="Reset"
                      onClick={() => {
                        setContrast(100)
                        setBrightness(100)
                        setBgDarkness(0)
                        setAlwaysShowLabels(false)
                        setMaskBoxes(false)
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="size-3.5" />
                    </button>
                  </div>

                  <div className="mb-3">
                    <p className="mb-1.5 text-xs text-muted-foreground">Contrast</p>
                    <Slider value={[contrast]} min={0} max={200} step={5} onValueChange={(v) => setContrast(v[0])} />
                  </div>
                  <div className="mb-3">
                    <p className="mb-1.5 text-xs text-muted-foreground">Brightness</p>
                    <Slider value={[brightness]} min={0} max={200} step={5} onValueChange={(v) => setBrightness(v[0])} />
                  </div>
                  <div className="mb-4">
                    <p className="mb-1.5 text-xs text-muted-foreground">Background Darkness</p>
                    <Slider value={[bgDarkness]} min={0} max={100} step={5} onValueChange={(v) => setBgDarkness(v[0])} />
                  </div>

                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="text-xs text-popover-foreground">Always Show Labels</p>
                    <Switch checked={alwaysShowLabels} onCheckedChange={setAlwaysShowLabels} />
                  </div>
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="text-xs text-popover-foreground">Mask Boxes</p>
                    <Switch checked={maskBoxes} onCheckedChange={setMaskBoxes} />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-popover-foreground">Display Mode</p>
                    <Switch
                      checked={theme === "light"}
                      onCheckedChange={(v) => setTheme(v ? "light" : "dark")}
                    />
                  </div>
                </div>
              )}
            </div>
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
          <Button
            variant={activeTool === "brush" ? "brand" : "ghost"}
            size="icon"
            title="Brush — freehand outline"
            onClick={() => setActiveTool("brush")}
          >
            <Brush className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" disabled title="Magic select (coming soon)">
            <Wand2 className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" disabled title="Smart polygon (coming soon)">
            <Sparkles className="size-4" />
          </Button>
          <div className="my-1.5 h-px w-8 bg-border" />
          <Button
            variant={activeTool === "comment" ? "brand" : "ghost"}
            size="icon"
            title="Comment"
            onClick={() => setActiveTool("comment")}
          >
            <MessageSquare className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            title="Undo"
          >
            <Undo2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title="Redo"
          >
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
