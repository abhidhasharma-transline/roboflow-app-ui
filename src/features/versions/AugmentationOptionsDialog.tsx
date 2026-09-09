import { ImageIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export interface AugmentationType {
  id: string
  label: string
  style: React.CSSProperties
  /** Only present for the types that have their own configuration dialog
   *  (Flip, Hue, Rotation, Saturation, Exposure, Brightness, Blur) — the
   *  actual chosen slider value / checkboxes, read by the backend
   *  (app/versions/augment.py) instead of its old fixed-range default. */
  params?: Record<string, number | boolean>
}

export const IMAGE_LEVEL_AUGMENTATIONS: AugmentationType[] = [
  { id: "flip", label: "Flip", style: { transform: "scaleX(-1)" } },
  { id: "rotate90", label: "90° Rotate", style: { transform: "rotate(90deg) scale(0.7)" } },
  { id: "crop", label: "Crop", style: { transform: "scale(1.4)" } },
  { id: "rotation", label: "Rotation", style: { transform: "rotate(15deg) scale(1.2)" } },
  { id: "shear", label: "Shear", style: { transform: "skew(-10deg, 0deg) scale(1.1)" } },
  { id: "grayscale", label: "Grayscale", style: { filter: "grayscale(1)" } },
  { id: "hue", label: "Hue", style: { filter: "hue-rotate(140deg) saturate(1.5)" } },
  { id: "saturation", label: "Saturation", style: { filter: "saturate(3)" } },
  { id: "brightness", label: "Brightness", style: { filter: "brightness(1.6)" } },
  { id: "exposure", label: "Exposure", style: { filter: "brightness(1.3) contrast(1.15)" } },
  { id: "blur", label: "Blur", style: { filter: "blur(2.5px)" } },
  { id: "noise", label: "Noise", style: { filter: "contrast(1.4) saturate(0.6)" } },
]

function Tile({
  label,
  thumbnailUrl,
  style,
  onClick,
}: {
  label: string
  thumbnailUrl: string | null
  style?: React.CSSProperties
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-md p-1.5 text-center hover:bg-accent"
    >
      <div className="relative size-20 overflow-hidden rounded-md bg-muted">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" className="size-full object-cover" style={style} />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageIcon className="size-6" />
          </div>
        )}
      </div>
      <span className="text-xs text-foreground">{label}</span>
    </button>
  )
}

export function AugmentationOptionsDialog({
  open,
  onOpenChange,
  thumbnailUrl,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  thumbnailUrl: string | null
  onSelect: (aug: AugmentationType) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Augmentation Options</DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-sm text-muted-foreground">
          Augmentations create new training examples for your model to learn from.
        </p>

        {/* Deliberately just each type's own effect, NOT composed with
         *  whatever preprocessing was chosen earlier — this is a picker for
         *  "what kind of augmentation is this", so a recognizable, isolated
         *  preview reads clearer here than a combined one would. The actual
         *  configuration dialog each of these opens into (Flip, Hue,
         *  Rotation, Saturation, Exposure, Brightness, Blur) DOES compose
         *  the two, since that view is about the real combined result. */}
        <div className="grid grid-cols-5 gap-2">
          {IMAGE_LEVEL_AUGMENTATIONS.map((aug) => (
            <Tile
              key={aug.id}
              label={aug.label}
              thumbnailUrl={thumbnailUrl}
              style={aug.style}
              onClick={() => {
                onSelect(aug)
                onOpenChange(false)
              }}
            />
          ))}
        </div>

        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  )
}
