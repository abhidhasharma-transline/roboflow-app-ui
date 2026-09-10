import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useParams, useNavigate, useSearchParams } from "react-router-dom"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  MoreHorizontal,
  MoreVertical,
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
  BringToFront,
  SendToBack,
  Layers2,
  LayersMinus,
  WandSparkles,
  VenetianMask,
  Repeat,
  Check,
  Search,
  Download,
  Star,
  FolderMinus,
  RefreshCcw,
  ScanSearch,
  ArrowUp,
  AtSign,
  Loader2,
  Send,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageLoader } from "@/components/shared/PageLoader"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { cn, extractErrorMessage } from "@/lib/utils"
import { useAnnotationStore } from "@/stores/annotationStore"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useAuthStore } from "@/stores/authStore"
import { useThemeStore } from "@/stores/themeStore"
import { useToastStore } from "@/stores/toastStore"
import { useProject } from "@/hooks/useProjects"
import { useAnnotationSocket } from "@/hooks/useAnnotationSocket"
import { getJobImages, moveJobToUnassigned, deleteJobAnnotations } from "@/lib/jobApi"
import { listClasses, quickCreateClass, updateClass, type ProjectClass } from "@/lib/classApi"
import { listAnnotations, createAnnotation, updateAnnotation, deleteAnnotation, toStoreAnnotation } from "@/lib/annotationApi"
import {
  listImageTags, addImageTag, removeImageTag, addImageMetadata, removeImageMetadata,
  type ImageTag,
} from "@/lib/tagApi"
import { getImage, getImageUrl, type ImageDetail } from "@/lib/imageApi"
import {
  listComments, createComment, deleteComment, getImageHistory,
  removeImageFromProject, setAsCoverPhoto, addImageToDataset, sendImageToUnannotated,
  type ImageComment, type ImageHistoryEntry,
} from "@/lib/commentApi"
import { listProjectMembers } from "@/lib/projectApi"
import { fullName, initials } from "@/lib/userDisplay"
import type { ProjectMember } from "@/types/project"
import type { JobImageSummary } from "@/types/job"
import type { BoundingBox, Point } from "@/types/annotation"

import type { ResizeHandle } from "./annotationCanvasTypes"
import { NEW_CLASS_COLORS, tools, SHORTCUT_GROUPS, leftNavItems } from "./annotationToolConstants"
import { clamp, isTypingInField } from "./annotationToolUtils"
import { AnnotationBoxOverlay } from "./AnnotationBoxOverlay"
import { ClassRow } from "./ClassRow"
import { SubmitForReviewDialog } from "./SubmitForReviewDialog"


export function AnnotationToolPage() {
  const { projectId, jobId } = useParams<{ projectId: string; jobId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialImageId = useRef(searchParams.get("image"))
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const canvasRef = useRef<HTMLDivElement>(null)
  // Tracks which image's annotations were most recently requested, so a
  // slower, older fetch that resolves after a newer one can recognize
  // it's stale and skip applying its (now-wrong) result.
  const pendingImageIdRef = useRef<string | null>(null)

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
  const [downloadingImage, setDownloadingImage] = useState(false)
  const [settingCover, setSettingCover] = useState(false)
  const [removingFromProject, setRemovingFromProject] = useState(false)
  const [togglingDatasetStatus, setTogglingDatasetStatus] = useState(false)
  const [submitReviewOpen, setSubmitReviewOpen] = useState(false)
  const [projectHasReviewers, setProjectHasReviewers] = useState(false)

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
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([])
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null)

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
  const clipboardRef = useRef<{ classId: string; shapeType: "bbox" | "polygon"; geometry: Record<string, unknown> } | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [shortcutSearch, setShortcutSearch] = useState("")

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
  const [repeatingPrevious, setRepeatingPrevious] = useState(false)

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

  // Floating position for the Annotation Editor card — anchored to whatever
  // shape is actually being edited instead of living in a fixed sidebar
  // slot, so there's no round trip back to a corner of the screen every
  // time you draw or select a box.
  const EDITOR_WIDTH = 288
  const EDITOR_MARGIN = 12
  const [editorPos, setEditorPos] = useState<{ left: number; top: number } | null>(null)

  const [hoverViewportPos, setHoverViewportPos] = useState<Point | null>(null)
  const [spaceHeld, setSpaceHeld] = useState(false)
  // Mirrors `spaceHeld`, read synchronously by handleMouseDown instead of the
  // state value — avoids any doubt about whether a just-set piece of React
  // state has actually re-rendered by the time a native mousedown fires.
  const spaceHeldRef = useRef(false)
  const [isPanning, setIsPanning] = useState(false)
  // Pan is a CSS translate on the canvas stage (not scrollLeft/scrollTop) so the
  // viewport never grows a scrollbar and the crosshair guides can extend past
  // the image edges into the surrounding canvas, matching Roboflow's feel.
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  // One-shot: set when a pan-drag ends, consumed by the very next
  // handleCanvasClick (the native "click" a pointerup always fires,
  // regardless of drag distance) so it doesn't misread that as a real click.
  const justPannedRef = useRef(false)
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
  const isInDataset = currentImage?.status === "dataset"

  // The job-wide image list (tab="all", fetched below) no longer carries
  // presigned URLs — see get_job_images — so the actual url/thumbnail_url
  // for whichever ONE image is on screen is resolved here instead, one at
  // a time, and cached by id so paging back to an already-visited image
  // is instant rather than re-fetching it.
  const [resolvedImageUrls, setResolvedImageUrls] = useState<Record<string, string>>({})
  const [loadingImageUrl, setLoadingImageUrl] = useState(false)
  const currentImageUrl = currentImage ? resolvedImageUrls[currentImage.id] : undefined

  useEffect(() => {
    if (!workspaceId || !projectId || !currentImage || resolvedImageUrls[currentImage.id]) return
    let cancelled = false
    setLoadingImageUrl(true)
    getImageUrl(workspaceId, projectId, currentImage.id)
      .then((res) => {
        if (cancelled) return
        setResolvedImageUrls((prev) => ({ ...prev, [currentImage.id]: res.url }))
      })
      .finally(() => {
        if (!cancelled) setLoadingImageUrl(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, projectId, currentImage?.id])

  // Prefetch the next image's URL a beat after the current one settles, so
  // paging forward through a job feels instant instead of a fresh fetch
  // every single time — a nice-to-have, not something correctness depends
  // on (the effect above still covers it if this hasn't resolved yet).
  useEffect(() => {
    if (!workspaceId || !projectId) return
    const next = images[currentIndex + 1]
    if (!next || resolvedImageUrls[next.id]) return
    const timer = setTimeout(() => {
      getImageUrl(workspaceId, projectId, next.id).then((res) => {
        setResolvedImageUrls((prev) => (prev[next.id] ? prev : { ...prev, [next.id]: res.url }))
      })
    }, 200)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, projectId, currentIndex, images])

  // The canvas box used to be a fixed 800x560 (10:7) regardless of the
  // actual image's aspect ratio, so `object-cover` silently cropped
  // whatever didn't fit (e.g. a real 1920x1080 / 16:9 frame lost ~20% off
  // the top and bottom). Every box drawn was then a percentage of that
  // CROPPED view, not the full stored image — correct on this canvas, but
  // visibly wrong wherever else the same coordinates get rendered against
  // the uncropped original (Dataset grid/lightbox, exports, versions).
  // Sizing the box to the image's own aspect ratio removes the crop
  // entirely, so "percent of canvas" and "percent of the real image" are
  // finally the same number.
  const [imageAspect, setImageAspect] = useState<number | null>(null)
  useEffect(() => {
    setImageAspect(null)
  }, [currentImage?.id])
  const CANVAS_MAX_WIDTH = 900
  const CANVAS_MAX_HEIGHT = 700
  const canvasBoxSize = useMemo(() => {
    const aspect = imageAspect ?? 800 / 560
    let width = CANVAS_MAX_WIDTH
    let height = width / aspect
    if (height > CANVAS_MAX_HEIGHT) {
      height = CANVAS_MAX_HEIGHT
      width = height * aspect
    }
    return { width, height }
  }, [imageAspect])

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
  //
  // The image itself swaps instantly (just a src change), but this fetch is
  // a real network round-trip — without clearing `annotations` first, the
  // PREVIOUS image's boxes stayed rendered, now overlaid on the NEW image,
  // until the fetch resolved and replaced them (often with none at all, if
  // you'd paged to an unannotated image) — a flash of someone else's boxes
  // on your image for however long the request took.
  //
  // pendingImageIdRef guards the reverse problem: paging quickly (several
  // arrow presses before earlier requests land) fires overlapping fetches
  // that can resolve out of order — without this, an older image's
  // annotations could land last and overwrite the image you're actually on.
  useEffect(() => {
    if (!workspaceId || !projectId || !currentImage) return
    const imageId = currentImage.id
    pendingImageIdRef.current = imageId
    setAnnotations([])
    listAnnotations(workspaceId, projectId, imageId).then((rows) => {
      if (pendingImageIdRef.current !== imageId) return
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

  // Loaded once (not re-fetched per comment) — the @mention list.
  useEffect(() => {
    if (!workspaceId || !projectId) return
    listProjectMembers(workspaceId, projectId).then(setProjectMembers).catch(() => {})
  }, [workspaceId, projectId])

  // Same project-wide "does review apply here at all" check JobPage uses to
  // gate its own Submit for Review / Add to Dataset buttons — drives the
  // "Send Job for Review" menu item below so it only shows up when it'd
  // actually do something.
  useEffect(() => {
    if (!workspaceId || !projectId) return
    listProjectMembers(workspaceId, projectId, "reviewer")
      .then((members) => setProjectHasReviewers(members.length > 0))
      .catch(() => {})
  }, [workspaceId, projectId])

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
      setMentionQuery(null)
    } finally {
      setSavingComment(false)
    }
  }

  // Matches an "@partial" run right before the cursor — not preceded by a
  // non-space character, so "user@x.com" doesn't trigger it mid-word.
  const MENTION_PATTERN = /(?:^|\s)@([\w.]*)$/

  function handleCommentDraftChange(value: string, cursor: number) {
    setCommentDraft(value)
    const match = value.slice(0, cursor).match(MENTION_PATTERN)
    setMentionQuery(match ? match[1] : null)
  }

  function insertMention(member: ProjectMember) {
    const el = commentTextareaRef.current
    const cursor = el?.selectionStart ?? commentDraft.length
    const uptoCursor = commentDraft.slice(0, cursor)
    const match = uptoCursor.match(MENTION_PATTERN)
    if (!match) return
    const mentionStart = cursor - match[0].length + (match[0].startsWith(" ") ? 1 : 0)
    const inserted = `@${member.username} `
    const newValue = commentDraft.slice(0, mentionStart) + inserted + commentDraft.slice(cursor)
    setCommentDraft(newValue)
    setMentionQuery(null)
    requestAnimationFrame(() => {
      const pos = mentionStart + inserted.length
      el?.focus()
      el?.setSelectionRange(pos, pos)
    })
  }

  const filteredMentionMembers = useMemo(() => {
    if (mentionQuery === null) return []
    const q = mentionQuery.toLowerCase()
    return projectMembers.filter(
      (m) => m.username.toLowerCase().includes(q) || fullName(m).toLowerCase().includes(q)
    )
  }, [mentionQuery, projectMembers])

  async function handleDeleteComment(commentId: string) {
    if (!workspaceId || !projectId || !currentImage) return
    setComments((prev) => prev.filter((c) => c.id !== commentId))
    setOpenCommentId(null)
    await deleteComment(workspaceId, projectId, currentImage.id, commentId)
  }

  const [copiedKey, setCopiedKey] = useState<"source" | "annotation" | null>(null)

  function copyJson(value: unknown, key: "source" | "annotation") {
    navigator.clipboard.writeText(JSON.stringify(value, null, 4))
    setCopiedKey(key)
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500)
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
    // A switch triggered by leaving the image is already covered by the
    // socket's own reconnect-cleanup (see useAnnotationSocket), but an
    // in-place TOOL switch never closes that socket — without this, the
    // lock from a still-open class editor stayed held (and "X editing…"
    // kept showing to everyone else) even after the editor itself closed.
    if (editingAnnotationId) releaseLock(editingAnnotationId)
    setEditingAnnotationId(null)
    setPendingComment(null)
    setCommentDraft("")
    setOpenCommentId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // Releases the lock the editor acquired on open — previously this
        // inlined the same three setState calls without releasing it, so
        // canceling out of the editor with Escape left it showing "X
        // editing…" to everyone else until the image/tool changed.
        closeAnnotationEditor()
      }
      if (e.key === "Escape" && pendingComment) {
        setPendingComment(null)
        setCommentDraft("")
      }
      if (e.key === "Escape" && shortcutsOpen) {
        setShortcutsOpen(false)
      }
      if (
        (pendingShape || editingAnnotationId) &&
        e.key >= "1" &&
        e.key <= "9" &&
        !isTypingInField()
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
  }, [polygonPoints.length, pendingShape, editingAnnotationId, classes, pendingClassName, pendingComment, shortcutsOpen])

  // Standard Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z) undo/redo shortcuts, matching
  // the toolbar buttons — most people reach for these before the icons.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || isTypingInField() || shortcutsOpen) return
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
  }, [undoStack, redoStack, workspaceId, projectId, currentImage, shortcutsOpen])

  // "R" → Repeat Previous, matching Roboflow's shortcut for copying the
  // prior image's annotations onto this one.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isTypingInField() || shortcutsOpen) return
      if (e.key.toLowerCase() === "r") {
        e.preventDefault()
        handleRepeatPrevious()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [repeatingPrevious, currentIndex, images, workspaceId, projectId, currentImage, shortcutsOpen])

  // General shortcuts: tool switching, zoom, image navigation.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isTypingInField() || shortcutsOpen) return
      const key = e.key.toLowerCase()
      if (key === "b") setActiveTool("bbox")
      else if (key === "p") setActiveTool("polygon")
      else if (key === "d") setActiveTool("select")
      else if (key === "+" || key === "=") setZoom(Math.min(zoom + 0.2, 3))
      else if (key === "-") setZoom(Math.max(zoom - 0.2, 0.4))
      else if (key === "0") setZoom(1)
      else if (e.key === "ArrowLeft" && polygonPoints.length === 0 && !isBrushing) goPrev()
      else if (e.key === "ArrowRight" && polygonPoints.length === 0 && !isBrushing) goNext()
      else if (e.shiftKey && key === "a" && isInDataset) handleSendToUnannotated()
      else if (e.shiftKey && key === "a" && !isInDataset && annotations.length > 0) handleAddImageToDataset()
      else return
      e.preventDefault()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [zoom, polygonPoints.length, isBrushing, shortcutsOpen, isInDataset, annotations, workspaceId, projectId, currentImage])

  // With an annotation selected or being edited: cycle classes, delete, copy/paste.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingInField() || shortcutsOpen) return

      if ((pendingShape || editingAnnotationId) && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault()
        const filtered = classes.filter((c) =>
          c.name.toLowerCase().includes(pendingClassName.trim().toLowerCase())
        )
        if (filtered.length === 0) return
        const i = filtered.findIndex((c) => c.id === pendingSelectedClassId)
        const next =
          e.key === "ArrowUp"
            ? filtered[i <= 0 ? filtered.length - 1 : i - 1]
            : filtered[i < 0 || i >= filtered.length - 1 ? 0 : i + 1]
        setPendingSelectedClassId(next.id)
        return
      }

      if (e.key === "Backspace" || e.key === "Delete") {
        if (pendingShape) {
          e.preventDefault()
          handleDiscardPendingShape()
          return
        }
        if (editingAnnotationId) {
          e.preventDefault()
          handleDelete(editingAnnotationId)
          closeAnnotationEditor()
          return
        }
        if (selectedAnnotationId) {
          e.preventDefault()
          handleDelete(selectedAnnotationId)
          setSelectedAnnotationId(null)
          return
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && selectedAnnotationId) {
        const ann = annotations.find((a) => a.id === selectedAnnotationId)
        if (!ann) return
        e.preventDefault()
        clipboardRef.current = ann.bbox
          ? { classId: ann.classId, shapeType: "bbox", geometry: ann.bbox as unknown as Record<string, unknown> }
          : { classId: ann.classId, shapeType: "polygon", geometry: { points: ann.polygon } }
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v" && clipboardRef.current) {
        if (!workspaceId || !projectId || !currentImage) return
        e.preventDefault()
        const clip = clipboardRef.current
        createAnnotation(workspaceId, projectId, currentImage.id, clip).then((created) => {
          pushHistory({ type: "create", id: created.id, classId: clip.classId, shapeType: clip.shapeType, geometry: clip.geometry })
        })
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [
    pendingShape, editingAnnotationId, classes, pendingClassName, pendingSelectedClassId,
    selectedAnnotationId, annotations, workspaceId, projectId, currentImage, shortcutsOpen,
  ])

  // Space-held → pan mode (grab cursor + drag-to-scroll), same as Figma/Photoshop.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" && !isTypingInField() && !shortcutsOpen) {
        e.preventDefault()
        spaceHeldRef.current = true
        setSpaceHeld(true)
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") {
        spaceHeldRef.current = false
        setSpaceHeld(false)
      }
    }
    // Space held while the window/tab itself loses focus (alt-tab, devtools
    // click) never gets a matching keyup — left stuck, a later click-drag
    // anywhere would silently start panning with no way to have known why.
    function onWindowBlur() {
      spaceHeldRef.current = false
      setSpaceHeld(false)
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", onWindowBlur)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", onWindowBlur)
    }
  }, [shortcutsOpen])

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

  async function handleRenameClass(classId: string, name: string) {
    if (!workspaceId || !projectId) return
    try {
      const updated = await updateClass(workspaceId, projectId, classId, { name })
      setClasses((prev) => prev.map((c) => (c.id === classId ? updated : c)))
    } catch {
      addToast({ variant: "error", title: "Couldn't rename class", description: "Please try again." })
    }
  }

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

  /** Percent-of-canvas bounding box of whichever shape the editor is
   *  currently open for — a freshly drawn one, or an existing annotation
   *  being edited (resize-in-progress override taking priority so the
   *  editor tracks a live drag, not last commit's position). */
  function getActiveShapeBBoxPercent(): BoundingBox | null {
    if (pendingShape) {
      if (pendingShape.shapeType === "bbox") return pendingShape.geometry
      const pts = pendingShape.geometry.points
      if (!pts.length) return null
      const xs = pts.map((p) => p.x)
      const ys = pts.map((p) => p.y)
      const x = Math.min(...xs)
      const y = Math.min(...ys)
      return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
    }
    if (editingAnnotationId) {
      if (resizeOverride?.id === editingAnnotationId) return resizeOverride.bbox
      const ann = annotations.find((a) => a.id === editingAnnotationId)
      if (!ann) return null
      if (ann.bbox) return ann.bbox
      if (ann.polygon?.length) {
        const xs = ann.polygon.map((p) => p.x)
        const ys = ann.polygon.map((p) => p.y)
        const x = Math.min(...xs)
        const y = Math.min(...ys)
        return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
      }
    }
    return null
  }

  // Recomputed synchronously after layout (not a plain effect) so the
  // popup doesn't visibly lag a frame behind the shape while dragging/
  // resizing or panning/zooming the canvas.
  useLayoutEffect(() => {
    const box = getActiveShapeBBoxPercent()
    const canvasEl = canvasRef.current
    if (!box || !canvasEl) {
      setEditorPos(null)
      return
    }
    const rect = canvasEl.getBoundingClientRect()
    const shapeRight = rect.left + ((box.x + box.width) / 100) * rect.width
    const shapeLeft = rect.left + (box.x / 100) * rect.width
    const shapeTop = rect.top + (box.y / 100) * rect.height

    // Prefer opening to the right of the shape; flip to the left if there's
    // not enough room on the right but there is on the left.
    const spaceRight = window.innerWidth - shapeRight
    const placeLeft = spaceRight < EDITOR_WIDTH + EDITOR_MARGIN && shapeLeft > EDITOR_WIDTH + EDITOR_MARGIN
    const rawLeft = placeLeft ? shapeLeft - EDITOR_WIDTH - EDITOR_MARGIN : shapeRight + EDITOR_MARGIN
    const left = Math.max(8, Math.min(rawLeft, window.innerWidth - EDITOR_WIDTH - 8))
    const top = Math.max(8, Math.min(shapeTop, window.innerHeight - 8))
    setEditorPos({ left, top })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingShape, editingAnnotationId, annotations, resizeOverride, zoom, pan.x, pan.y])

  function startPan(e: React.PointerEvent) {
    // Pointer capture keeps this exact element receiving move/up events for
    // the rest of the gesture even if the cursor ends up somewhere else
    // (another overlay, outside the canvas, even outside the window) —
    // the previous approach (plain mousedown + separate window-level
    // mousemove/mouseup listeners) had no such guarantee.
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
    setIsPanning(true)
  }

  function handleMouseDown(e: React.PointerEvent) {
    // Read the ref, not the `spaceHeld` state closure — synchronous, so
    // there's no dependence on a re-render having landed before this fires.
    if (spaceHeldRef.current) {
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

  function handleMouseMove(e: React.PointerEvent) {
    if (isPanning) {
      const start = panStartRef.current
      if (start) setPan({ x: start.panX + (e.clientX - start.x), y: start.panY + (e.clientY - start.y) })
      return
    }
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
    // A pan-drag ends with a pointerup on this same element, which still
    // fires a native "click" right afterward regardless of how far the drag
    // moved — by then isPanning is already back to false (handleMouseUp
    // clears it first), so this checks the one-shot flag it leaves behind
    // instead. Without it, panning while the Polygon tool is active drops a
    // stray point wherever the drag happened to end.
    if (justPannedRef.current) {
      justPannedRef.current = false
      return
    }
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

  function handleMouseUp(e: React.PointerEvent) {
    if (isPanning) {
      ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
      panStartRef.current = null
      justPannedRef.current = true
      setIsPanning(false)
      return
    }
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
    // Guards against a duplicate delete for the same annotation — e.g. the
    // Backspace/Delete key auto-repeating while held, or two triggers firing
    // for one user action — hitting the same already-gone row and 404ing.
    if (deletingId === annotationId) return
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
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        addToast({ variant: "error", title: "Couldn't delete annotation", description: extractErrorMessage(err) })
      } else if (status !== 404) {
        addToast({ variant: "error", title: "Couldn't delete annotation", description: "Please try again." })
      }
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

  async function handleDownloadImage() {
    if (!currentImage || !workspaceId || !projectId) return
    setDownloadingImage(true)
    try {
      const url = currentImageUrl ?? (await getImageUrl(workspaceId, projectId, currentImage.id)).url
      const res = await fetch(url)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objectUrl
      a.download = currentImage.filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    } catch {
      addToast({ variant: "error", title: "Couldn't download image", description: "Please try again." })
    } finally {
      setDownloadingImage(false)
    }
  }

  async function handleSetAsCoverPhoto() {
    if (!workspaceId || !projectId || !currentImage) return
    setSettingCover(true)
    try {
      await setAsCoverPhoto(workspaceId, projectId, currentImage.id)
      addToast({ variant: "success", title: "Cover photo updated", description: currentImage.filename })
    } catch {
      addToast({ variant: "error", title: "Couldn't set cover photo", description: "Please try again." })
    } finally {
      setSettingCover(false)
    }
  }

  async function handleRemoveFromProject() {
    if (!workspaceId || !projectId || !currentImage || removingFromProject) return
    setRemovingFromProject(true)
    try {
      await removeImageFromProject(workspaceId, projectId, currentImage.id)
      addToast({ variant: "success", title: "Removed from project", description: currentImage.filename })
      if (images.length <= 1) {
        navigate(`/projects/${projectId}/annotate`)
        return
      }
      setImages((prev) => prev.filter((img) => img.id !== currentImage.id))
      setCurrentIndex((i) => Math.min(i, images.length - 2))
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status !== 404) {
        addToast({ variant: "error", title: "Couldn't remove image", description: "Please try again." })
      }
    } finally {
      setRemovingFromProject(false)
    }
  }

  // Promoting/reverting actually moves this image out of the job whose
  // pager we're currently in (it's re-homed into a dataset-stage job, or
  // orphaned from one on revert) — so it must come out of the local `images`
  // list too, not just have its status flipped in place, or the pager would
  // keep counting/showing an image that no longer belongs to this job.
  function dropCurrentImageFromPager() {
    if (images.length <= 1) {
      navigate(`/projects/${projectId}/annotate`)
      return
    }
    const removedId = currentImage!.id
    setImages((prev) => prev.filter((img) => img.id !== removedId))
    setCurrentIndex((i) => Math.min(i, images.length - 2))
  }

  async function handleAddImageToDataset() {
    if (!workspaceId || !projectId || !currentImage || togglingDatasetStatus) return
    if (annotations.length === 0) return
    setTogglingDatasetStatus(true)
    try {
      await addImageToDataset(workspaceId, projectId, currentImage.id)
      addToast({ variant: "success", title: "Added to dataset" })
      dropCurrentImageFromPager()
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 404) {
        dropCurrentImageFromPager()
      } else if (status === 400) {
        // The project has a reviewer and this image hasn't been approved
        // yet (_dataset_blocked_image_ids on the backend) — the generic
        // "please try again" was a dead end here, since retrying the exact
        // same action fails the exact same way every time. Surface the
        // real reason and offer the actual way forward right in the toast.
        addToast({
          variant: "error",
          title: "Couldn't add to dataset",
          description: extractErrorMessage(err),
          actionLabel: "Send for Review",
          onAction: () => setSubmitReviewOpen(true),
        })
      } else {
        addToast({ variant: "error", title: "Couldn't add to dataset", description: "Please try again." })
      }
    } finally {
      setTogglingDatasetStatus(false)
    }
  }

  async function handleSendToUnannotated() {
    if (!workspaceId || !projectId || !currentImage || togglingDatasetStatus) return
    setTogglingDatasetStatus(true)
    try {
      await sendImageToUnannotated(workspaceId, projectId, currentImage.id)
      addToast({ variant: "success", title: "Sent to unannotated" })
      dropCurrentImageFromPager()
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 404) {
        dropCurrentImageFromPager()
      } else {
        addToast({ variant: "error", title: "Couldn't send to unannotated", description: "Please try again." })
      }
    } finally {
      setTogglingDatasetStatus(false)
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
   * we already have the answer locally. Creating is blocked server-side
   * when the project has Lock Classes on (Classes & Tags page). */
  async function resolveClassId(name: string): Promise<string | null> {
    if (!workspaceId || !projectId) return null
    const trimmed = name.trim()
    if (!trimmed) return null

    const existing = classes.find((c) => c.name.toLowerCase() === trimmed.toLowerCase())
    if (existing) return existing.id

    try {
      const cls = await quickCreateClass(workspaceId, projectId, {
        name: trimmed,
        color: NEW_CLASS_COLORS[classes.length % NEW_CLASS_COLORS.length],
      })
      setClasses((prev) => (prev.some((c) => c.id === cls.id) ? prev : [...prev, cls]))
      return cls.id
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 400) {
        addToast({
          variant: "error",
          title: "Classes are locked",
          description: "Pick an existing class — new ones are locked for this project.",
        })
      } else {
        addToast({ variant: "error", title: "Couldn't create class", description: "Please try again." })
      }
      return null
    }
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
    // The drag/resize path already acquires a lock when it starts moving a
    // box — this editor is a second, previously unguarded way to change an
    // annotation (its class), so it needs the same signal, or a concurrent
    // drag elsewhere could freely start on a box someone's mid-edit here.
    acquireLock(annotationId)
  }

  function closeAnnotationEditor() {
    if (editingAnnotationId) releaseLock(editingAnnotationId)
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
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      addToast({
        variant: "error",
        title: "Couldn't update the class",
        description: status === 409 ? extractErrorMessage(err) : "Please try again.",
      })
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

  // Stacking order among this image's annotations — higher zIndex renders on
  // top. Computed from the current in-memory list, committed via the same
  // PATCH endpoint other edits use; its WS "updated" broadcast lands the
  // reordered value in the store.
  async function setZIndex(annotationId: string, zIndex: number) {
    if (!workspaceId || !projectId || !currentImage) return
    try {
      await updateAnnotation(workspaceId, projectId, currentImage.id, annotationId, { zIndex })
    } catch {
      // ignore — no toast system yet
    }
  }

  function handleBringToFront(annotationId: string) {
    const top = Math.max(0, ...annotations.map((a) => a.zIndex))
    setZIndex(annotationId, top + 1)
  }

  function handleSendToBack(annotationId: string) {
    const bottom = Math.min(0, ...annotations.map((a) => a.zIndex))
    setZIndex(annotationId, bottom - 1)
  }

  function handleBringForward(annotationId: string) {
    const sorted = [...annotations].sort((a, b) => a.zIndex - b.zIndex)
    const i = sorted.findIndex((a) => a.id === annotationId)
    const above = sorted[i + 1]
    if (i < 0 || !above) return
    setZIndex(annotationId, above.zIndex + 1)
  }

  function handleSendBackward(annotationId: string) {
    const sorted = [...annotations].sort((a, b) => a.zIndex - b.zIndex)
    const i = sorted.findIndex((a) => a.id === annotationId)
    const below = sorted[i - 1]
    if (i <= 0 || !below) return
    setZIndex(annotationId, below.zIndex - 1)
  }

  // Copies every annotation from the previous image in this job onto the
  // current one — useful for video frames where objects barely move between
  // consecutive frames. Additive: doesn't touch what's already here.
  async function handleRepeatPrevious() {
    if (repeatingPrevious || currentIndex === 0 || !workspaceId || !projectId || !currentImage) return
    const prevImage = images[currentIndex - 1]
    if (!prevImage) return
    setRepeatingPrevious(true)
    try {
      const prevRows = await listAnnotations(workspaceId, projectId, prevImage.id)
      for (const row of prevRows) {
        const created = await createAnnotation(workspaceId, projectId, currentImage.id, {
          classId: row.class_id,
          shapeType: row.shape_type,
          geometry: row.geometry,
        })
        pushHistory({ type: "create", id: created.id, classId: row.class_id, shapeType: row.shape_type, geometry: row.geometry })
      }
    } catch {
      // ignore — no toast system yet
    } finally {
      setRepeatingPrevious(false)
    }
  }

  function startBoxDrag(kind: "move" | "resize", annotationId: string, handle: ResizeHandle | undefined, e: React.MouseEvent) {
    if (activeTool !== "select") return
    e.stopPropagation()
    if (e.button !== 0) return
    // Belt-and-suspenders on top of AnnotationBoxOverlay already not wiring
    // up its mousedown handler when locked — this is the one place every
    // drag actually starts from, so it's the safest single spot to also
    // check the real lock state directly rather than trust every caller
    // got the UI gating right.
    const lock = locks[annotationId]
    if (lock && lock.userId !== currentUser?.id) return
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
                .catch((err) => {
                  // resizeOverride is already cleared below regardless of
                  // outcome, so a failed save has already visually snapped
                  // the box back to its last-committed position — this is
                  // just telling the user WHY that happened instead of it
                  // looking like their drag was silently ignored.
                  const status = (err as { response?: { status?: number } })?.response?.status
                  addToast({
                    variant: "error",
                    title: "Couldn't save the change",
                    description: status === 409 ? extractErrorMessage(err) : "Please try again.",
                  })
                })
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
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <div className="relative flex size-16 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-brand/15" />
          <span className="absolute inset-0 rounded-full border-2 border-brand/20" />
          <ImageIcon className="size-6 text-brand" />
        </div>
        <p className="text-sm text-muted-foreground">Opening job…</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div>
          <button
            onClick={() => navigate(jobId ? `/projects/${projectId}/annotate/job/${jobId}` : `/projects/${projectId}/annotate`)}
            title="Back to this job's Unannotated/Annotated view"
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
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {currentIndex + 1} / {images.length}
            {loadingImageUrl && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={goNext}
            disabled={currentIndex === images.length - 1}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant={isInDataset ? "brand" : "outline"}
            size="icon"
            className="rounded-full"
            onClick={handleSendToUnannotated}
            disabled={togglingDatasetStatus || !isInDataset}
            title={isInDataset ? "Send to Unannotated (Shift+A)" : "This image isn't in the dataset yet"}
          >
            <RotateCcw className="size-4" />
          </Button>
          <Button
            variant={!isInDataset && annotations.length > 0 ? "outline" : "ghost"}
            size="icon"
            className="rounded-full"
            onClick={handleAddImageToDataset}
            disabled={togglingDatasetStatus || isInDataset || annotations.length === 0}
            title={
              isInDataset
                ? "Already in the dataset"
                : annotations.length === 0
                  ? "Annotate this image first"
                  : "Add Image to Dataset (Shift+A)"
            }
          >
            <Check className="size-4" />
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
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem
                disabled
                title="Coming soon — needs an AI segmentation model we haven't wired up yet"
              >
                <RefreshCcw className="size-3.5" />
                Convert …
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled
                title="Coming soon — needs image-similarity search (embeddings) we haven't built yet"
              >
                <ScanSearch className="size-3.5" />
                Find Similar Unassigned Images To Label
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled
                title="Coming soon — needs image-similarity search (embeddings) we haven't built yet"
              >
                <Search className="size-3.5" />
                Find Similar Images In Dataset
              </DropdownMenuItem>
              <DropdownMenuItem disabled={downloadingImage} onClick={handleDownloadImage}>
                <Download className="size-3.5" />
                {downloadingImage ? "Downloading…" : "Download Image"}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={settingCover} onClick={handleSetAsCoverPhoto}>
                <Star className="size-3.5" />
                Use As Cover Photo
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={removingFromProject}
                onClick={handleRemoveFromProject}
                className="text-destructive focus:text-destructive"
              >
                <FolderMinus className="size-3.5" />
                Remove From Project
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {projectHasReviewers && (
                <DropdownMenuItem onClick={() => setSubmitReviewOpen(true)}>
                  <Send className="size-3.5" />
                  Send Job for Review
                </DropdownMenuItem>
              )}
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
                <PageLoader />
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
                  onClick={() => copyJson(sourceDataJson, "source")}
                  disabled={!sourceDataJson}
                  className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-background px-1.5 py-1 text-muted-foreground shadow-sm hover:text-foreground"
                  title={copiedKey === "source" ? "Copied!" : "Copy"}
                >
                  {copiedKey === "source" ? (
                    <>
                      <Check className="size-3.5 text-green-500" />
                      <span className="text-[10px] text-green-500">Copied</span>
                    </>
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
                <pre className="no-scrollbar max-h-64 overflow-auto p-3 text-[10px] leading-relaxed text-foreground">
                  {sourceDataJson ? JSON.stringify(sourceDataJson, null, 4) : "Loading…"}
                </pre>
              </div>

              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Annotation Data</p>
              <div className="relative rounded-lg border border-border bg-muted/40">
                <button
                  onClick={() => copyJson(annotationDataJson, "annotation")}
                  disabled={!annotationDataJson}
                  className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-background px-1.5 py-1 text-muted-foreground shadow-sm hover:text-foreground"
                  title={copiedKey === "annotation" ? "Copied!" : "Copy"}
                >
                  {copiedKey === "annotation" ? (
                    <>
                      <Check className="size-3.5 text-green-500" />
                      <span className="text-[10px] text-green-500">Copied</span>
                    </>
                  ) : (
                    <Copy className="size-3.5" />
                  )}
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

          {(pendingShape || editingAnnotationId) && editorPos && createPortal(
            <div
              style={{ position: "fixed", left: editorPos.left, top: editorPos.top, width: EDITOR_WIDTH }}
              className="z-40 max-h-[80vh] overflow-y-auto rounded-lg border border-brand/40 bg-popover shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-brand/20 px-3 py-2">
                <p className="text-xs font-semibold text-foreground">Annotation Editor</p>
                <div className="flex items-center gap-2">
                  {editingAnnotationId && (
                    <button
                      onClick={(e) =>
                        setContextMenu({ annotationId: editingAnnotationId, x: e.clientX, y: e.clientY })
                      }
                      title="More"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <MoreVertical className="size-3.5" />
                    </button>
                  )}
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
                    // This box auto-focuses the instant the editor opens, so
                    // the page-level Backspace/Delete shortcut (which
                    // deliberately backs off while any <input> is focused,
                    // so it doesn't eat keystrokes while someone's typing a
                    // class name) never gets a chance to fire — Delete would
                    // silently do nothing for as long as the editor stayed
                    // open. Only step in when there's no search text to
                    // edit, so backspacing through an actual query still
                    // behaves normally.
                    if ((e.key === "Backspace" || e.key === "Delete") && pendingClassName.trim() === "") {
                      e.preventDefault()
                      if (pendingShape) {
                        handleDiscardPendingShape()
                      } else if (editingAnnotationId) {
                        handleDelete(editingAnnotationId)
                        closeAnnotationEditor()
                      }
                    }
                    // Same reasoning as Backspace/Delete above — this box
                    // auto-focuses the moment the editor opens, so the
                    // page-level ArrowUp/ArrowDown (cycle class) and 1-9
                    // (jump to class) shortcuts never get a chance to fire;
                    // without this they'd silently do nothing for as long as
                    // the editor stayed open, which is effectively always.
                    // Single-line inputs don't use Up/Down for anything, so
                    // that one's a free intercept; digits could theoretically
                    // be part of a real class name search, but the shortcut
                    // is documented to just work whenever the editor's open,
                    // so it wins here the same way it does globally.
                    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                      e.preventDefault()
                      const filtered = classes.filter((c) =>
                        c.name.toLowerCase().includes(pendingClassName.trim().toLowerCase())
                      )
                      if (filtered.length === 0) return
                      const i = filtered.findIndex((c) => c.id === pendingSelectedClassId)
                      const next =
                        e.key === "ArrowUp"
                          ? filtered[i <= 0 ? filtered.length - 1 : i - 1]
                          : filtered[i < 0 || i >= filtered.length - 1 ? 0 : i + 1]
                      setPendingSelectedClassId(next.id)
                      return
                    }
                    if (e.key >= "1" && e.key <= "9") {
                      const filtered = classes.filter((c) =>
                        c.name.toLowerCase().includes(pendingClassName.trim().toLowerCase())
                      )
                      const picked = filtered[Number(e.key) - 1]
                      if (picked) {
                        e.preventDefault()
                        if (pendingShape) handleSavePendingShape(picked.id)
                        else handleUpdateAnnotationClass(picked.id)
                      }
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
            </div>,
            document.body
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
                      <ClassRow
                        key={cls.id}
                        cls={cls}
                        count={classCounts.get(cls.id)}
                        active={activeClassId === cls.id}
                        onSelect={() => setActiveClassId(cls.id)}
                        onRename={(name) => handleRenameClass(cls.id, name)}
                      />
                    ))}
                  </div>
                </>
              )}

              {unusedClasses.length > 0 && (
                <>
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Unused Classes</p>
                  <div className="mb-3 flex flex-col gap-1">
                    {unusedClasses.map((cls) => (
                      <ClassRow
                        key={cls.id}
                        cls={cls}
                        muted
                        active={activeClassId === cls.id}
                        onSelect={() => setActiveClassId(cls.id)}
                        onRename={(name) => handleRenameClass(cls.id, name)}
                      />
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
              onPointerDown={handleMouseDown}
              onPointerMove={handleMouseMove}
              onPointerUp={handleMouseUp}
              onMouseLeave={() => setHoverViewportPos(null)}
              onClick={handleCanvasClick}
              onDoubleClick={handleCanvasDoubleClick}
              className="relative select-none"
              style={{
                width: canvasBoxSize.width,
                height: canvasBoxSize.height,
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
              {currentImageUrl ? (
                <img
                  src={currentImageUrl}
                  alt={currentImage.filename}
                  className="size-full rounded object-cover"
                  style={{ filter: `contrast(${contrast}%) brightness(${brightness}%)` }}
                  draggable={false}
                  onLoad={(e) => {
                    const { naturalWidth, naturalHeight } = e.currentTarget
                    if (naturalWidth && naturalHeight) setImageAspect(naturalWidth / naturalHeight)
                  }}
                />
              ) : (
                <div className="flex size-full items-center justify-center rounded bg-muted/30">
                  <div className="relative flex size-12 items-center justify-center">
                    <span className="absolute inset-0 animate-ping rounded-full bg-brand/20" />
                    <Loader2 className="size-5 animate-spin text-brand" />
                  </div>
                </div>
              )}
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
                  .sort((a, b) => a.zIndex - b.zIndex)
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
                        e.stopPropagation()
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
                  className="absolute z-20 w-64 -translate-x-1/2 rounded-lg border border-brand/40 bg-popover p-3 shadow-lg"
                  style={{ left: `${pendingComment.x}%`, top: `${pendingComment.y}%` }}
                >
                  <div className="relative">
                    <textarea
                      ref={commentTextareaRef}
                      autoFocus
                      value={commentDraft}
                      onChange={(e) => handleCommentDraftChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          if (mentionQuery !== null) {
                            setMentionQuery(null)
                            return
                          }
                          setPendingComment(null)
                          setCommentDraft("")
                        }
                      }}
                      placeholder="Leave a comment…"
                      className="h-16 w-full resize-none rounded-md border border-input bg-background p-1.5 text-xs outline-none"
                    />
                    {mentionQuery !== null && filteredMentionMembers.length > 0 && (
                      <div className="absolute bottom-full left-0 z-30 mb-1 max-h-40 w-full overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-lg">
                        {filteredMentionMembers.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => insertMention(m)}
                            className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-accent"
                          >
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[10px] font-medium text-brand">
                              {initials(m)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-foreground">{fullName(m)}</p>
                              <p className="truncate text-[10px] text-muted-foreground">{m.email}</p>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <button
                      type="button"
                      title="Mention someone"
                      onClick={() => {
                        const el = commentTextareaRef.current
                        const cursor = el?.selectionStart ?? commentDraft.length
                        const newValue = commentDraft.slice(0, cursor) + "@" + commentDraft.slice(cursor)
                        handleCommentDraftChange(newValue, cursor + 1)
                        requestAnimationFrame(() => {
                          el?.focus()
                          el?.setSelectionRange(cursor + 1, cursor + 1)
                        })
                      }}
                      className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <AtSign className="size-3.5" />
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Cancel"
                        onClick={() => {
                          setPendingComment(null)
                          setCommentDraft("")
                          setMentionQuery(null)
                        }}
                        className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Post comment"
                        onClick={handleAddComment}
                        disabled={savingComment || !commentDraft.trim()}
                        className="flex size-6 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-sm hover:brightness-110 disabled:opacity-40"
                      >
                        <ArrowUp className="size-3.5" />
                      </button>
                    </div>
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
                    .sort((a, b) => a.zIndex - b.zIndex)
                    .map((a) => (
                      <polygon
                        key={a.id}
                        onClick={() => {
                          if (activeTool === "select") openAnnotationEditor(a.id)
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
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
            <button
              onClick={() => setShortcutsOpen(true)}
              className="text-muted-foreground hover:text-foreground"
              title="Keyboard shortcuts"
            >
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
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRepeatPrevious}
            disabled={repeatingPrevious || currentIndex === 0}
            title="Repeat Previous (R) — copies every annotation from the last image onto this one. Useful for video frames."
          >
            <Repeat className="size-4" />
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
          className="fixed z-50 w-56 overflow-hidden rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            disabled
            title="Coming soon — needs an AI segmentation model we haven't wired up yet"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-muted-foreground/50"
          >
            <Wand2 className="size-3.5" />
            Convert to Smart Polygon
          </button>
          <button
            disabled
            title="Coming soon — needs an AI segmentation model we haven't wired up yet"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-muted-foreground/50"
          >
            <WandSparkles className="size-3.5" />
            Convert to Smart Mask
          </button>
          <button
            disabled
            title="Coming soon — pixel-level masks aren't supported yet"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-muted-foreground/50"
          >
            <VenetianMask className="size-3.5" />
            Convert to Mask
          </button>
          <div className="my-1 h-px bg-border" />
          <button
            onClick={() => {
              handleBringToFront(contextMenu.annotationId)
              setContextMenu(null)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
          >
            <BringToFront className="size-3.5" />
            Bring to Front
          </button>
          <button
            onClick={() => {
              handleSendToBack(contextMenu.annotationId)
              setContextMenu(null)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
          >
            <SendToBack className="size-3.5" />
            Send to Back
          </button>
          <button
            onClick={() => {
              handleBringForward(contextMenu.annotationId)
              setContextMenu(null)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
          >
            <Layers2 className="size-3.5" />
            Bring Forward
          </button>
          <button
            onClick={() => {
              handleSendBackward(contextMenu.annotationId)
              setContextMenu(null)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
          >
            <LayersMinus className="size-3.5" />
            Send Backward
          </button>
          <div className="my-1 h-px bg-border" />
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

      {shortcutsOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-6 backdrop-blur-[2px]"
          onClick={() => setShortcutsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-xl bg-popover text-popover-foreground shadow-2xl"
          >
            <div className="relative flex flex-col items-center gap-2 border-b border-border px-6 pb-5 pt-6">
              <button
                onClick={() => setShortcutsOpen(false)}
                className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
              <div className="flex size-9 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Keyboard className="size-4" />
              </div>
              <p className="text-base font-semibold text-foreground">Keyboard Shortcuts</p>
              <div className="relative mt-1 w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={shortcutSearch}
                  onChange={(e) => setShortcutSearch(e.target.value)}
                  placeholder="Search shortcuts…"
                  className="h-9 pl-8 text-sm"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
              {SHORTCUT_GROUPS.map((group) => {
                const items = group.items.filter((item) =>
                  item.label.toLowerCase().includes(shortcutSearch.trim().toLowerCase())
                )
                if (items.length === 0) return null
                return (
                  <div key={group.title} className="mb-5 last:mb-0">
                    <p className="mb-2 text-xs font-semibold text-foreground">{group.title}</p>
                    <div className="flex flex-col gap-2.5">
                      {items.map((item) => (
                        <div key={item.label} className="flex items-start gap-3">
                          <div className="flex w-24 shrink-0 flex-wrap items-center gap-1 pt-0.5">
                            {item.keys.map((k, i) => (
                              <kbd
                                key={i}
                                className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                              >
                                {k}
                              </kbd>
                            ))}
                          </div>
                          <div>
                            <p className="text-sm text-foreground">{item.label}</p>
                            {item.hint && <p className="text-xs text-muted-foreground">{item.hint}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              {SHORTCUT_GROUPS.every(
                (group) =>
                  group.items.filter((item) =>
                    item.label.toLowerCase().includes(shortcutSearch.trim().toLowerCase())
                  ).length === 0
              ) && <p className="py-6 text-center text-sm text-muted-foreground">No matching shortcuts.</p>}
            </div>
          </div>
        </div>
      )}

      {workspaceId && projectId && jobId && (
        <SubmitForReviewDialog
          workspaceId={workspaceId}
          projectId={projectId}
          jobId={jobId}
          open={submitReviewOpen}
          onOpenChange={setSubmitReviewOpen}
          onSubmitted={() => addToast({ variant: "success", title: "Sent for review" })}
        />
      )}
    </div>
  )
}
