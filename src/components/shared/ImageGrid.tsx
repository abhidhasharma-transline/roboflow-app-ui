import { useState } from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ImageItem } from "@/types/image"

interface ImageGridProps {
  images: ImageItem[]
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  onImageClick?: (image: ImageItem) => void
}

export function ImageGrid({
  images,
  selectable = false,
  selectedIds,
  onSelectionChange,
  onImageClick,
}: ImageGridProps) {
  const [internalSelected, setInternalSelected] = useState<Set<string>>(
    new Set()
  )
  const selected = selectedIds ?? internalSelected
  const setSelected = onSelectionChange ?? setInternalSelected

  function toggle(id: string) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  if (images.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
        <p className="text-sm font-medium text-foreground">No images yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload images to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {images.map((image) => {
        const isSelected = selected.has(image.id)
        return (
          <button
            key={image.id}
            onClick={() =>
              selectable ? toggle(image.id) : onImageClick?.(image)
            }
            className={cn(
              "group relative aspect-[4/3] overflow-hidden rounded-md border border-border bg-muted transition-all",
              isSelected && "ring-2 ring-brand ring-offset-2 ring-offset-background"
            )}
          >
            <img
              src={image.thumbnailUrl}
              alt={image.fileName}
              className="size-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
            {selectable && (
              <div
                className={cn(
                  "absolute top-1.5 left-1.5 flex size-5 items-center justify-center rounded-full border-2 border-white bg-black/30 backdrop-blur-sm",
                  isSelected && "bg-brand border-brand"
                )}
              >
                {isSelected && <Check className="size-3 text-white" />}
              </div>
            )}
            {image.annotationCount > 0 && (
              <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {image.annotationCount} box{image.annotationCount !== 1 && "es"}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
