import { useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, MousePointer2, Square, Spline, ZoomIn, ZoomOut, Trash2 } from "lucide-react"
import { Topbar } from "@/components/layout/Topbar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAnnotationStore, type AnnotationTool } from "@/stores/annotationStore"
import { mockGetClasses } from "@/lib/mockApi"
import { useEffect } from "react"
import type { ClassLabel } from "@/types/annotation"

const tools: { key: AnnotationTool; icon: typeof MousePointer2; label: string }[] = [
  { key: "select", icon: MousePointer2, label: "Select (V)" },
  { key: "bbox", icon: Square, label: "Bounding box (B)" },
  { key: "polygon", icon: Spline, label: "Polygon (P)" },
]

export function AnnotationToolPage() {
  const { projectId, jobId } = useParams()
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLDivElement>(null)
  const {
    activeTool,
    setActiveTool,
    activeClassId,
    setActiveClassId,
    annotations,
    addAnnotation,
    removeAnnotation,
    zoom,
    setZoom,
  } = useAnnotationStore()

  const [classes, setClasses] = useState<ClassLabel[]>([])
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    mockGetClasses(projectId ?? "").then((c) => {
      setClasses(c)
      if (c[0]) setActiveClassId(c[0].id)
    })
  }, [projectId, setActiveClassId])

  const imageUrl = "https://picsum.photos/seed/annotate/1000/700"

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
    setDrawStart(getRelativePos(e))
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!drawStart) return
    setDrawCurrent(getRelativePos(e))
  }

  function handleMouseUp() {
    if (!drawStart || !drawCurrent || !activeClassId) {
      setDrawStart(null)
      setDrawCurrent(null)
      return
    }
    const activeClass = classes.find((c) => c.id === activeClassId)
    const x = Math.min(drawStart.x, drawCurrent.x)
    const y = Math.min(drawStart.y, drawCurrent.y)
    const width = Math.abs(drawCurrent.x - drawStart.x)
    const height = Math.abs(drawCurrent.y - drawStart.y)

    if (width > 1 && height > 1 && activeClass) {
      addAnnotation({
        id: crypto.randomUUID(),
        imageId: jobId ?? "current",
        classId: activeClass.id,
        className: activeClass.name,
        color: activeClass.color,
        bbox: { x, y, width, height },
        createdBy: "current-user",
        createdAt: new Date().toISOString(),
      })
    }
    setDrawStart(null)
    setDrawCurrent(null)
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

  return (
    <>
      <Topbar>
        <button
          onClick={() => navigate(`/projects/${projectId}/annotate`)}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Exit
        </button>
        <span className="text-muted-foreground">/</span>
        <span>Annotation tool</span>
      </Topbar>

      <div className="flex flex-1 overflow-hidden">
        {/* Toolbar */}
        <div className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-muted/20 py-3">
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
          <div className="my-2 h-px w-8 bg-border" />
          <Button variant="ghost" size="icon" onClick={() => setZoom(Math.min(zoom + 0.2, 3))}>
            <ZoomIn className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setZoom(Math.max(zoom - 0.2, 0.4))}>
            <ZoomOut className="size-4" />
          </Button>
        </div>

        {/* Canvas */}
        <div className="flex flex-1 items-center justify-center overflow-auto bg-neutral-900 p-8">
          <div
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="relative select-none"
            style={{
              width: 800 * zoom,
              height: 560 * zoom,
              cursor: activeTool === "bbox" ? "crosshair" : "default",
            }}
          >
            <img
              src={imageUrl}
              alt="Annotation target"
              className="size-full rounded object-cover"
              draggable={false}
            />
            {annotations.map((ann) =>
              ann.bbox ? (
                <div
                  key={ann.id}
                  className="group absolute border-2"
                  style={{
                    left: `${ann.bbox.x}%`,
                    top: `${ann.bbox.y}%`,
                    width: `${ann.bbox.width}%`,
                    height: `${ann.bbox.height}%`,
                    borderColor: ann.color,
                  }}
                >
                  <span
                    className="absolute -top-5 left-0 rounded-t px-1.5 py-0.5 text-[10px] font-medium text-white"
                    style={{ backgroundColor: ann.color }}
                  >
                    {ann.className}
                  </span>
                  <button
                    onClick={() => removeAnnotation(ann.id)}
                    className="absolute -top-5 right-0 hidden rounded bg-black/60 p-0.5 text-white group-hover:block"
                  >
                    <Trash2 className="size-3" />
                  </button>
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
          </div>
        </div>

        {/* Classes panel */}
        <div className="w-64 shrink-0 border-l border-border bg-muted/10 p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Classes</h3>
          <div className="flex flex-col gap-1">
            {classes.map((cls) => (
              <button
                key={cls.id}
                onClick={() => setActiveClassId(cls.id)}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                  activeClassId === cls.id && "bg-accent"
                )}
              >
                <span
                  className="size-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: cls.color }}
                />
                <span className="flex-1 truncate">{cls.name}</span>
                <span className="text-xs text-muted-foreground">{cls.count}</span>
              </button>
            ))}
          </div>

          <h3 className="mt-6 mb-3 text-sm font-semibold text-foreground">
            Annotations on image ({annotations.length})
          </h3>
          <div className="flex flex-col gap-1">
            {annotations.map((ann) => (
              <div
                key={ann.id}
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm"
              >
                <span
                  className="size-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: ann.color }}
                />
                <span className="flex-1 truncate">{ann.className}</span>
                <button onClick={() => removeAnnotation(ann.id)}>
                  <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
