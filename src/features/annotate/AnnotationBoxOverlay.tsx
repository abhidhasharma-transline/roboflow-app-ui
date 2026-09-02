import { Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LockInfo } from "@/hooks/useAnnotationSocket"
import type { Annotation, BoundingBox } from "@/types/annotation"
import type { ResizeHandle } from "./annotationCanvasTypes"
import { RESIZE_HANDLES } from "./annotationToolConstants"

export function AnnotationBoxOverlay({
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
      onMouseDown={selectable && !lockedByOther ? onBodyMouseDown : undefined}
      className="group absolute border-2"
      style={{
        left: `${bbox.x}%`,
        top: `${bbox.y}%`,
        width: `${bbox.width}%`,
        height: `${bbox.height}%`,
        borderColor: annotation.color,
        backgroundColor: masked ? annotation.color : undefined,
        cursor: selectable && !lockedByOther ? "move" : undefined,
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
      {selectable && !lockedByOther && (
        <button
          onClick={onDelete}
          disabled={deleting}
          title="Delete"
          className="absolute -top-5 right-0 hidden rounded bg-black/60 p-0.5 text-white group-hover:block disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="size-3" />
        </button>
      )}
      {selected && !lockedByOther &&
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
