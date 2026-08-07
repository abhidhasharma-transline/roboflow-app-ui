import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
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
import { listAnnotations, createAnnotation, deleteAnnotation, toStoreAnnotation } from "@/lib/annotationApi"
import type { JobImageSummary } from "@/types/job"
import type { Annotation, Point } from "@/types/annotation"

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
  lockedBy,
  currentUserId,
  deleting,
  onDelete,
}: {
  annotation: Annotation
  lockedBy?: LockInfo
  currentUserId?: string
  deleting: boolean
  onDelete: () => void
}) {
  if (!annotation.bbox) return null
  const lockedByOther = Boolean(lockedBy && lockedBy.userId !== currentUserId)

  return (
    <div
      className="group absolute border-2"
      style={{
        left: `${annotation.bbox.x}%`,
        top: `${annotation.bbox.y}%`,
        width: `${annotation.bbox.width}%`,
        height: `${annotation.bbox.height}%`,
        borderColor: annotation.color,
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
    </div>
  )
}

export function AnnotationToolPage() {
  const { projectId, jobId } = useParams<{ projectId: string; jobId: string }>()
  const navigate = useNavigate()
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

  const currentImage = images[currentIndex]

  const { remoteDrafts, locks, sendDragPreview, acquireLock, releaseLock } = useAnnotationSocket(
    workspaceId ?? undefined,
    projectId,
    currentImage?.id
  )

  useEffect(() => {
    if (!workspaceId || !projectId || !jobId) return
    getJobImages(workspaceId, projectId, jobId, "all").then((res) => setImages(res.images))
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

  // Switching images or tools mid-polygon-draw abandons the in-progress shape
  // rather than carrying stray points onto a different image/tool.
  useEffect(() => {
    setPolygonPoints([])
    setPolygonHoverPos(null)
    drawTempIdRef.current = null
  }, [currentImage?.id, activeTool])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && polygonPoints.length > 0) {
        setPolygonPoints([])
        setPolygonHoverPos(null)
        drawTempIdRef.current = null
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [polygonPoints.length])

  const classCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of annotations) {
      counts.set(a.classId, (counts.get(a.classId) ?? 0) + 1)
    }
    return counts
  }, [annotations])

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

  function handleCanvasClick(e: React.MouseEvent) {
    if (activeTool !== "polygon") return
    const pos = getRelativePos(e)
    if (polygonPoints.length === 0) {
      drawTempIdRef.current = crypto.randomUUID()
    }
    setPolygonPoints((prev) => [...prev, pos])
  }

  async function handleCanvasDoubleClick() {
    if (activeTool !== "polygon") return
    // The click immediately preceding this dblclick already appended a point
    // at ~the same spot — drop it before closing the shape.
    const points = polygonPoints.slice(0, -1)
    setPolygonPoints([])
    setPolygonHoverPos(null)
    drawTempIdRef.current = null

    if (points.length < 3 || !activeClassId || !currentImage || !workspaceId || !projectId) return
    try {
      await createAnnotation(workspaceId, projectId, currentImage.id, {
        classId: activeClassId,
        shapeType: "polygon",
        geometry: { points },
      })
    } catch {
      // ignore — no toast system yet
    }
  }

  async function handleMouseUp() {
    const start = drawStart
    const current = drawCurrent
    setDrawStart(null)
    setDrawCurrent(null)
    drawTempIdRef.current = null

    if (!start || !current || !activeClassId || !currentImage || !workspaceId || !projectId) return
    const x = Math.min(start.x, current.x)
    const y = Math.min(start.y, current.y)
    const width = Math.abs(current.x - start.x)
    const height = Math.abs(current.y - start.y)
    if (width <= 1 || height <= 1) return

    try {
      await createAnnotation(workspaceId, projectId, currentImage.id, {
        classId: activeClassId,
        shapeType: "bbox",
        geometry: { x, y, width, height },
      })
      // The store updates via this connection's own WS "created" broadcast —
      // no local optimistic add, so there's nothing to reconcile.
    } catch {
      // No toast system in this app yet — silently drop, matching existing
      // error-handling elsewhere in the annotate flow.
    }
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

  async function handleCreateClass() {
    if (!workspaceId || !projectId || !newClassName.trim()) return
    setCreatingClass(true)
    try {
      const cls = await createClass(workspaceId, projectId, {
        name: newClassName.trim(),
        color: NEW_CLASS_COLORS[classes.length % NEW_CLASS_COLORS.length],
      })
      setClasses((prev) => [...prev, cls])
      setActiveClassId(cls.id)
      setNewClassName("")
      setNewClassOpen(false)
    } catch {
      // ignore — no toast system yet
    } finally {
      setCreatingClass(false)
    }
  }

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
            <div className="mb-2 flex flex-col items-center gap-1 rounded-md border border-dashed border-border py-4 text-center">
              <p className="text-xs font-medium text-foreground">No Tags Applied</p>
              <p className="px-2 text-xs text-muted-foreground">
                Type and select tags below to add them to the image.
              </p>
            </div>
            <div className="flex gap-1.5">
              <Input placeholder="Add tag…" className="h-8 text-xs" disabled />
              <Button size="sm" variant="outline" disabled>
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
                annotations.map((ann) => (
                  <AnnotationBoxOverlay
                    key={ann.id}
                    annotation={ann}
                    lockedBy={locks[ann.id]}
                    currentUserId={currentUser?.id}
                    deleting={deletingId === ann.id}
                    onDelete={() => handleDelete(ann.id)}
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
              <svg
                className="pointer-events-none absolute inset-0 size-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {!hideLabels &&
                  annotations
                    .filter((a) => a.polygon && a.polygon.length > 0)
                    .map((a) => (
                      <polygon
                        key={a.id}
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
                  polygonPoints.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={0.6} fill="white" stroke="black" strokeWidth={0.1} />
                  ))}
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
    </div>
  )
}
