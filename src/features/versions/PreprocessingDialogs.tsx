import { useState } from "react"
import { ImageIcon, Contrast, Shuffle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import type { ResizeMode } from "@/lib/versionApi"

const RESIZE_MODE_LABELS: Record<ResizeMode, string> = {
  stretch: "Stretch to",
  fill_center_crop: "Fill (with center crop) in",
  fit_within: "Fit within",
  fit_reflect: "Fit (reflect edges) in",
  fit_black_edges: "Fit (black edges) in",
  fit_white_edges: "Fit (white edges) in",
}

function InfoCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-blue-50 p-3 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
      {children}
    </div>
  )
}

export function AutoOrientDialog({
  open,
  onOpenChange,
  thumbnailUrl,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  thumbnailUrl: string | null
  onApply: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Auto-Orient</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-[1fr_auto] gap-6">
          <div>
            <div className="grid grid-cols-2 gap-1 overflow-hidden rounded-md">
              {[
                { rotate: "rotate-90", ok: false },
                { rotate: "rotate-180", ok: false },
                { rotate: "-rotate-90", ok: false },
                { rotate: "rotate-0", ok: true },
              ].map((cell, i) => (
                <div
                  key={i}
                  className={`relative aspect-square overflow-hidden bg-muted ring-2 ${
                    cell.ok ? "ring-green-500" : "ring-destructive"
                  }`}
                >
                  {thumbnailUrl && (
                    <img
                      src={thumbnailUrl}
                      alt=""
                      className={`size-full object-cover ${cell.rotate}`}
                    />
                  )}
                </div>
              ))}
            </div>
            {/* <p className="mt-2 text-xs text-muted-foreground">(A live preview is not available for this action.)</p> */}
          </div>
          <div className="w-56 space-y-4">
            <p className="text-sm text-foreground">Discard EXIF rotations and standardize pixel ordering.</p>
            <InfoCallout>
              <p className="mb-1 font-medium">When should I auto-orient my images?</p>
              <p>The short answer: almost always.</p>
            </InfoCallout>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="brand"
            onClick={() => {
              onApply()
              onOpenChange(false)
            }}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ResizeDialog({
  open,
  onOpenChange,
  thumbnailUrl,
  initialMode,
  initialWidth,
  initialHeight,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  thumbnailUrl: string | null
  initialMode: ResizeMode
  initialWidth: number
  initialHeight: number
  onApply: (config: { mode: ResizeMode; width: number; height: number }) => void
}) {
  const [mode, setMode] = useState<ResizeMode>(initialMode)
  const [width, setWidth] = useState(initialWidth)
  const [height, setHeight] = useState(initialHeight)
  // Separate "what's on screen while typing" from the committed number that
  // drives the preview's aspect-ratio. Digit-by-digit edits (e.g. clearing
  // "640" to type "512") pass through momentary states like "6" or "" —
  // feeding those straight into aspectRatio produced a near-zero ratio,
  // which blew the preview box up to a huge sliver (unbounded CSS
  // aspect-ratio height) instead of just looking odd for a frame.
  const [widthInput, setWidthInput] = useState(String(initialWidth))
  const [heightInput, setHeightInput] = useState(String(initialHeight))

  function commitWidth(raw: string) {
    const n = Number(raw)
    if (raw.trim() !== "" && Number.isFinite(n) && n >= 32) setWidth(n)
  }
  function commitHeight(raw: string) {
    const n = Number(raw)
    if (raw.trim() !== "" && Number.isFinite(n) && n >= 32) setHeight(n)
  }

  const objectFit = mode === "stretch" ? "fill" : mode === "fill_center_crop" ? "cover" : "contain"
  const previewBg =
    mode === "fit_black_edges" ? "bg-black" : mode === "fit_white_edges" ? "bg-white" : "bg-muted"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Resize</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-[1fr_auto] gap-6">
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">original</p>
              <div className="aspect-video overflow-hidden rounded-md bg-muted">
                {thumbnailUrl && <img src={thumbnailUrl} alt="" className="size-full object-contain" />}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">resized</p>
              <div
                className={`overflow-hidden rounded-md ${previewBg}`}
                style={{ aspectRatio: `${width} / ${height}` }}
              >
                {thumbnailUrl && (
                  <img src={thumbnailUrl} alt="" className="size-full" style={{ objectFit }} />
                )}
              </div>
            </div>
          </div>
          <div className="w-64 space-y-4">
            <p className="text-sm text-foreground">Downsize images for smaller file sizes and faster training.</p>
            <Select value={mode} onValueChange={(v) => setMode(v as ResizeMode)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(RESIZE_MODE_LABELS) as ResizeMode[]).map((m) => (
                  <SelectItem key={m} value={m}>{RESIZE_MODE_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={32}
                value={widthInput}
                onChange={(e) => {
                  setWidthInput(e.target.value)
                  commitWidth(e.target.value)
                }}
                onBlur={() => setWidthInput(String(width))}
                className="h-9"
              />
              <span className="text-sm text-muted-foreground">×</span>
              <Input
                type="number"
                min={32}
                value={heightInput}
                onChange={(e) => {
                  setHeightInput(e.target.value)
                  commitHeight(e.target.value)
                }}
                onBlur={() => setHeightInput(String(height))}
                className="h-9"
              />
            </div>
            <InfoCallout>
              <p className="mb-1 font-medium">Selecting Resize Settings</p>
              <p>Considerations for choosing the optimal computer vision resize settings to improve model performance.</p>
            </InfoCallout>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="brand"
            onClick={() => {
              onApply({ mode, width, height })
              onOpenChange(false)
            }}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const EXTRA_PREPROCESSING_TILES = [
  { id: "grayscale" as const, label: "Grayscale", icon: ImageIcon, style: { filter: "grayscale(1)" } },
  { id: "auto_contrast" as const, label: "Auto-Adjust Contrast", icon: Contrast, style: { filter: "contrast(1.3)" } },
  { id: "random_sample" as const, label: "Random Sample", icon: Shuffle, style: {} },
]

export function PreprocessingOptionsDialog({
  open,
  onOpenChange,
  thumbnailUrl,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  thumbnailUrl: string | null
  onSelect: (id: "grayscale" | "auto_contrast" | "random_sample") => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Preprocessing Options</DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-sm text-muted-foreground">
          Preprocessing can decrease training time and increase inference speed.
        </p>

        <div className="grid grid-cols-3 gap-2">
          {EXTRA_PREPROCESSING_TILES.map((tile) => (
            <button
              key={tile.id}
              onClick={() => {
                onSelect(tile.id)
                onOpenChange(false)
              }}
              className="flex flex-col items-center gap-1.5 rounded-md p-1.5 text-center hover:bg-accent"
            >
              <div className="relative size-20 overflow-hidden rounded-md bg-muted">
                {thumbnailUrl ? (
                  <img src={thumbnailUrl} alt="" className="size-full object-cover" style={tile.style} />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <tile.icon className="size-6" />
                  </div>
                )}
                {tile.id === "random_sample" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/40">
                    <Shuffle className="size-5 text-foreground" />
                  </div>
                )}
              </div>
              <span className="text-xs text-foreground">{tile.label}</span>
            </button>
          ))}
        </div>

        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
      </DialogContent>
    </Dialog>
  )
}
