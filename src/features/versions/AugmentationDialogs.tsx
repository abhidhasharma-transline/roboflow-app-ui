import { useState } from "react"
import { AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { InfoCallout } from "./PreprocessingDialogs"
import { combineStyles } from "@/lib/versionPreview"

function ValueBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground">{children}</span>
  )
}

/** Every slider-based augmentation (Hue, Rotation, Saturation, Exposure,
 *  Blur) shares this exact shape — one range input plus a preview. The
 *  actual per-image transform only ever happens server-side at export time
 *  (app/versions/augment.py) with a value randomly rolled somewhere inside
 *  ±(this chosen magnitude) — `previewStyle` is just a CSS approximation
 *  of what that looks like (a filter for Hue/Saturation/Exposure/Blur, a
 *  transform for Rotation), same tradeoff as every other preview in this
 *  wizard. `symmetric` controls whether the preview shows a -value/+value
 *  pair (Hue/Rotation/Saturation/Exposure, which really do vary in both
 *  directions) or a single 0→value pair (Blur, which has no "negative"
 *  direction). */
export function SliderAugmentationDialog({
  open,
  onOpenChange,
  thumbnailUrl,
  baseStyle,
  title,
  description,
  infoTitle,
  infoBody,
  min,
  max,
  unit,
  initialValue,
  symmetric,
  previewStyle,
  warningThreshold,
  warningText,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  thumbnailUrl: string | null
  /** The chosen preprocessing's preview style — see the Flip/Augmentation
   *  dialogs' own docs on why this composes underneath, not instead of. */
  baseStyle?: React.CSSProperties
  title: string
  description: string
  infoTitle: string
  infoBody: string
  min: number
  max: number
  unit: string
  initialValue: number
  symmetric: boolean
  previewStyle: (magnitude: number, sign: 1 | -1) => React.CSSProperties
  /** Above this value, a "may produce poor results" warning replaces the
   *  info callout (Noise's "typical range" warning) — omit for types that
   *  don't need one. */
  warningThreshold?: number
  warningText?: string
  onApply: (value: number) => void
}) {
  const [value, setValue] = useState(initialValue)
  const base = baseStyle ?? {}
  const showWarning = warningThreshold !== undefined && value > warningThreshold

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-[1fr_18rem] gap-6">
          <div className="min-w-0">
            {/* The reference frame — always shown, symmetric or not, so the
                user can actually compare the adjusted preview(s) against
                something instead of judging -value/+value in isolation. */}
            <div className="mx-auto mb-3 w-full max-w-xs">
              <div className="aspect-video overflow-hidden rounded-md bg-muted">
                {thumbnailUrl && <img src={thumbnailUrl} alt="" className="size-full object-cover" style={base} />}
              </div>
              <p className="mt-1 text-center text-xs text-muted-foreground">original</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {symmetric ? (
                <>
                  <div>
                    <div className="aspect-video overflow-hidden rounded-md bg-muted">
                      {thumbnailUrl && (
                        <img
                          src={thumbnailUrl}
                          alt=""
                          className="size-full object-cover"
                          style={combineStyles(base, previewStyle(value, -1))}
                        />
                      )}
                    </div>
                    <p className="mt-1 text-center text-xs text-muted-foreground">-{value}{unit}</p>
                  </div>
                  <div>
                    <div className="aspect-video overflow-hidden rounded-md bg-muted">
                      {thumbnailUrl && (
                        <img
                          src={thumbnailUrl}
                          alt=""
                          className="size-full object-cover"
                          style={combineStyles(base, previewStyle(value, 1))}
                        />
                      )}
                    </div>
                    <p className="mt-1 text-center text-xs text-muted-foreground">{value}{unit}</p>
                  </div>
                </>
              ) : (
                <div className="col-span-2 mx-auto w-full max-w-sm">
                  <div className="aspect-video overflow-hidden rounded-md bg-muted">
                    {thumbnailUrl && (
                      <img
                        src={thumbnailUrl}
                        alt=""
                        className="size-full object-cover"
                        style={combineStyles(base, previewStyle(value, 1))}
                      />
                    )}
                  </div>
                  <p className="mt-1 text-center text-xs text-muted-foreground">{value}{unit}</p>
                </div>
              )}
            </div>
          </div>
          <div className="min-w-0 space-y-4">
            <p className="text-sm text-foreground">{description}</p>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <ValueBadge>{min}{unit}</ValueBadge>
                <span className="rounded bg-brand px-2 py-0.5 text-xs font-semibold text-brand-foreground">
                  {value}{unit}
                </span>
                <ValueBadge>{max}{unit}</ValueBadge>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                className="w-full accent-brand"
              />
            </div>
            {showWarning && (
              <div className="flex items-start gap-2 rounded-md border-l-4 border-amber-400 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                <p>
                  <span className="font-medium">Warning:</span> {warningText ?? "These settings are outside of the typical range and may produce poor results."}
                </p>
              </div>
            )}
            <InfoCallout>
              <p className="mb-1 font-medium">{infoTitle}</p>
              <p>{infoBody}</p>
            </InfoCallout>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Go Back</Button>
          <Button
            variant="brand"
            onClick={() => {
              onApply(value)
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

export function FlipDialog({
  open,
  onOpenChange,
  thumbnailUrl,
  baseStyle,
  initialHorizontal,
  initialVertical,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  thumbnailUrl: string | null
  /** The chosen preprocessing's preview style (grayscale/contrast) — Flip
   *  is a step AFTER preprocessing, so its "preprocessed"/flipped previews
   *  should show that too, not silently revert to full color. */
  baseStyle?: React.CSSProperties
  initialHorizontal: boolean
  initialVertical: boolean
  onApply: (config: { horizontal: boolean; vertical: boolean }) => void
}) {
  const [horizontal, setHorizontal] = useState(initialHorizontal)
  const [vertical, setVertical] = useState(initialVertical)
  const base = baseStyle ?? {}

  const previewTransform = [horizontal && "scaleX(-1)", vertical && "scaleY(-1)"].filter(Boolean).join(" ")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Flip</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-[1fr_18rem] gap-6">
          <div className="min-w-0 space-y-4">
            <div className="mx-auto w-full max-w-sm">
              <div className="aspect-video overflow-hidden rounded-md bg-muted">
                {thumbnailUrl && <img src={thumbnailUrl} alt="" className="size-full object-cover" style={base} />}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">preprocessed</p>
            </div>
            <div className="mx-auto w-full max-w-sm">
              <div className="aspect-video overflow-hidden rounded-md bg-muted">
                {thumbnailUrl && (
                  <img
                    src={thumbnailUrl}
                    alt=""
                    className="size-full object-cover"
                    style={combineStyles(base, previewTransform ? { transform: previewTransform } : {})}
                  />
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {horizontal && vertical
                  ? "horizontal + vertical"
                  : horizontal
                    ? "horizontal"
                    : vertical
                      ? "vertical"
                      : "no flip selected"}
              </p>
            </div>
          </div>
          <div className="min-w-0 space-y-3">
            <p className="text-sm text-foreground">
              Add horizontal or vertical flips to help your model be insensitive to subject orientation.
            </p>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox checked={horizontal} onCheckedChange={(v) => setHorizontal(v === true)} />
              Horizontal
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox checked={vertical} onCheckedChange={(v) => setVertical(v === true)} />
              Vertical
            </label>
            <InfoCallout>
              <p className="mb-1 font-medium">How Flip Augmentation Improves Model Performance</p>
              <p>Flipping an image can improve model performance in substantial ways.</p>
            </InfoCallout>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Go Back</Button>
          <Button
            variant="brand"
            disabled={!horizontal && !vertical}
            onClick={() => {
              onApply({ horizontal, vertical })
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

export function BrightnessDialog({
  open,
  onOpenChange,
  thumbnailUrl,
  baseStyle,
  initialPercent,
  initialBrighten,
  initialDarken,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  thumbnailUrl: string | null
  /** The chosen preprocessing's preview style — see SliderAugmentationDialog's docs. */
  baseStyle?: React.CSSProperties
  initialPercent: number
  initialBrighten: boolean
  initialDarken: boolean
  onApply: (config: { percent: number; brighten: boolean; darken: boolean }) => void
}) {
  const [percent, setPercent] = useState(initialPercent)
  const [brighten, setBrighten] = useState(initialBrighten)
  const [darken, setDarken] = useState(initialDarken)
  const base = baseStyle ?? {}

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Brightness</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-[1fr_18rem] gap-6">
          <div className="min-w-0">
            <div className="mx-auto mb-3 w-full max-w-xs">
              <div className="aspect-video overflow-hidden rounded-md bg-muted">
                {thumbnailUrl && <img src={thumbnailUrl} alt="" className="size-full object-cover" style={base} />}
              </div>
              <p className="mt-1 text-center text-xs text-muted-foreground">0%</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="aspect-video overflow-hidden rounded-md bg-muted">
                  {thumbnailUrl && (
                    <img
                      src={thumbnailUrl}
                      alt=""
                      className="size-full object-cover"
                      style={combineStyles(base, { filter: `brightness(${Math.max(0, 1 - percent / 100)})` })}
                    />
                  )}
                </div>
                <p className="mt-1 text-center text-xs text-muted-foreground">-{percent}%</p>
              </div>
              <div>
                <div className="aspect-video overflow-hidden rounded-md bg-muted">
                  {thumbnailUrl && (
                    <img
                      src={thumbnailUrl}
                      alt=""
                      className="size-full object-cover"
                      style={combineStyles(base, { filter: `brightness(${1 + percent / 100})` })}
                    />
                  )}
                </div>
                <p className="mt-1 text-center text-xs text-muted-foreground">{percent}%</p>
              </div>
            </div>
          </div>
          <div className="min-w-0 space-y-3">
            <p className="text-sm text-foreground">
              Add variability to image brightness to help your model be more resilient to lighting and camera
              setting changes.
            </p>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <ValueBadge>0%</ValueBadge>
                <span className="rounded bg-brand px-2 py-0.5 text-xs font-semibold text-brand-foreground">
                  {percent}%
                </span>
                <ValueBadge>99%</ValueBadge>
              </div>
              <input
                type="range"
                min={0}
                max={99}
                value={percent}
                onChange={(e) => setPercent(Number(e.target.value))}
                className="w-full accent-brand"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox checked={brighten} onCheckedChange={(v) => setBrighten(v === true)} />
              Brighten
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox checked={darken} onCheckedChange={(v) => setDarken(v === true)} />
              Darken
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Go Back</Button>
          <Button
            variant="brand"
            disabled={!brighten && !darken}
            onClick={() => {
              onApply({ percent, brighten, darken })
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

export function Rotate90Dialog({
  open,
  onOpenChange,
  thumbnailUrl,
  baseStyle,
  initialClockwise,
  initialCounterclockwise,
  initialUpsideDown,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  thumbnailUrl: string | null
  baseStyle?: React.CSSProperties
  initialClockwise: boolean
  initialCounterclockwise: boolean
  initialUpsideDown: boolean
  onApply: (config: { clockwise: boolean; counterclockwise: boolean; upsideDown: boolean }) => void
}) {
  const [clockwise, setClockwise] = useState(initialClockwise)
  const [counterclockwise, setCounterclockwise] = useState(initialCounterclockwise)
  const [upsideDown, setUpsideDown] = useState(initialUpsideDown)
  const base = baseStyle ?? {}

  const panels = ([
    clockwise ? { label: "clockwise", transform: "rotate(90deg)" } : null,
    counterclockwise ? { label: "counter-clockwise", transform: "rotate(-90deg)" } : null,
    upsideDown ? { label: "upside down", transform: "rotate(180deg)" } : null,
  ] as const).filter((p): p is { label: string; transform: string } => p !== null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>90° Rotate</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-[1fr_18rem] gap-6">
          <div className="min-w-0">
            <div className="mx-auto mb-3 w-full max-w-xs">
              <div className="aspect-video overflow-hidden rounded-md bg-muted">
                {thumbnailUrl && <img src={thumbnailUrl} alt="" className="size-full object-cover" style={base} />}
              </div>
              <p className="mt-1 text-center text-xs text-muted-foreground">preprocessed</p>
            </div>
            {panels.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {panels.map((p) => (
                  <div key={p.label} className="mx-auto w-full max-w-xs">
                    <div className="flex aspect-video items-center justify-center overflow-hidden rounded-md bg-black">
                      {thumbnailUrl && (
                        <img
                          src={thumbnailUrl}
                          alt=""
                          className="h-[85%] w-auto object-cover"
                          style={combineStyles(base, { transform: p.transform })}
                        />
                      )}
                    </div>
                    <p className="mt-1 text-center text-xs text-muted-foreground">{p.label}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">Select at least one direction.</p>
            )}
          </div>
          <div className="min-w-0 space-y-3">
            <p className="text-sm text-foreground">
              Add 90-degree rotations to help your model be insensitive to camera orientation.
            </p>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox checked={clockwise} onCheckedChange={(v) => setClockwise(v === true)} />
              Clockwise
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox checked={counterclockwise} onCheckedChange={(v) => setCounterclockwise(v === true)} />
              Counter-Clockwise
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox checked={upsideDown} onCheckedChange={(v) => setUpsideDown(v === true)} />
              Upside Down
            </label>
            <InfoCallout>
              <p className="mb-1 font-medium">When should I rotate my images?</p>
              <p>If orientation doesn't matter (eg they may be taken in portrait/landscape mode or from above).</p>
            </InfoCallout>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Go Back</Button>
          <Button
            variant="brand"
            disabled={!clockwise && !counterclockwise && !upsideDown}
            onClick={() => {
              onApply({ clockwise, counterclockwise, upsideDown })
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

export function ShearDialog({
  open,
  onOpenChange,
  thumbnailUrl,
  baseStyle,
  initialHorizontal,
  initialVertical,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  thumbnailUrl: string | null
  baseStyle?: React.CSSProperties
  initialHorizontal: number
  initialVertical: number
  onApply: (config: { horizontal: number; vertical: number }) => void
}) {
  const [horizontal, setHorizontal] = useState(initialHorizontal)
  const [vertical, setVertical] = useState(initialVertical)
  const base = baseStyle ?? {}

  // All 4 sign combinations — shear genuinely varies independently on each
  // axis at export time (app/versions/augment.py's _aug_shear), so a single
  // preview couldn't represent the real range the way it can for a
  // one-axis effect.
  const combos = [
    { h: horizontal, v: vertical },
    { h: horizontal, v: -vertical },
    { h: -horizontal, v: vertical },
    { h: -horizontal, v: -vertical },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Shear</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-[1fr_18rem] gap-6">
          <div className="min-w-0">
            <div className="mx-auto mb-3 w-full max-w-xs">
              <div className="aspect-video overflow-hidden rounded-md bg-muted">
                {thumbnailUrl && <img src={thumbnailUrl} alt="" className="size-full object-cover" style={base} />}
              </div>
              <p className="mt-1 text-center text-xs text-muted-foreground">0°, 0°</p>
            </div>
            <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-4">
              {combos.map((c, i) => (
                <div key={i}>
                  <div className="aspect-video overflow-hidden rounded-md bg-muted">
                    {thumbnailUrl && (
                      <img
                        src={thumbnailUrl}
                        alt=""
                        className="size-full object-cover"
                        style={combineStyles(base, { transform: `skewX(${c.h}deg) skewY(${c.v}deg)` })}
                      />
                    )}
                  </div>
                  <p className="mt-1 text-center text-xs text-muted-foreground">{c.h}°, {c.v}°</p>
                </div>
              ))}
            </div>
          </div>
          <div className="min-w-0 space-y-4">
            <p className="text-sm text-foreground">
              Add variability to perspective to help your model be more resilient to camera and subject pitch and
              yaw.
            </p>
            <div>
              <p className="mb-1.5 text-sm font-medium text-foreground">Horizontal</p>
              <div className="mb-1.5 flex items-center justify-between">
                <ValueBadge>0°</ValueBadge>
                <span className="rounded bg-brand px-2 py-0.5 text-xs font-semibold text-brand-foreground">
                  {horizontal}°
                </span>
                <ValueBadge>45°</ValueBadge>
              </div>
              <input
                type="range"
                min={0}
                max={45}
                value={horizontal}
                onChange={(e) => setHorizontal(Number(e.target.value))}
                className="w-full accent-brand"
              />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-foreground">Vertical</p>
              <div className="mb-1.5 flex items-center justify-between">
                <ValueBadge>0°</ValueBadge>
                <span className="rounded bg-brand px-2 py-0.5 text-xs font-semibold text-brand-foreground">
                  {vertical}°
                </span>
                <ValueBadge>45°</ValueBadge>
              </div>
              <input
                type="range"
                min={0}
                max={45}
                value={vertical}
                onChange={(e) => setVertical(Number(e.target.value))}
                className="w-full accent-brand"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Go Back</Button>
          <Button
            variant="brand"
            onClick={() => {
              onApply({ horizontal, vertical })
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

export function CropDialog({
  open,
  onOpenChange,
  thumbnailUrl,
  baseStyle,
  initialMinPercent,
  initialMaxPercent,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  thumbnailUrl: string | null
  baseStyle?: React.CSSProperties
  initialMinPercent: number
  initialMaxPercent: number
  onApply: (config: { minPercent: number; maxPercent: number }) => void
}) {
  const [range, setRange] = useState<number[]>([initialMinPercent, initialMaxPercent])
  const base = baseStyle ?? {}
  const [minPercent, maxPercent] = range

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Crop</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-[1fr_18rem] gap-6">
          <div className="min-w-0 space-y-3">
            <div className="mx-auto w-full max-w-sm">
              <div className="aspect-video overflow-hidden rounded-md bg-muted">
                {thumbnailUrl && <img src={thumbnailUrl} alt="" className="size-full object-cover" style={base} />}
              </div>
              <p className="mt-1 text-center text-xs text-muted-foreground">0%</p>
            </div>
            <div className="mx-auto w-full max-w-sm">
              <div className="aspect-video overflow-hidden rounded-md bg-muted">
                {thumbnailUrl && (
                  <img
                    src={thumbnailUrl}
                    alt=""
                    className="size-full object-cover"
                    style={combineStyles(base, { transform: `scale(${1 + maxPercent / 100})` })}
                  />
                )}
              </div>
              <p className="mt-1 text-center text-xs text-muted-foreground">{maxPercent}%</p>
            </div>
          </div>
          <div className="min-w-0 space-y-4">
            <p className="text-sm text-foreground">
              Add variability to positioning and size to help your model be more resilient to subject translations
              and camera position.
            </p>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded bg-brand px-2 py-0.5 text-xs font-semibold text-brand-foreground">
                  {minPercent}%
                </span>
                <span className="rounded bg-brand px-2 py-0.5 text-xs font-semibold text-brand-foreground">
                  {maxPercent}%
                </span>
                <ValueBadge>99%</ValueBadge>
              </div>
              <Slider
                min={0}
                max={99}
                step={1}
                value={range}
                onValueChange={setRange}
              />
            </div>
            <InfoCallout>
              <p className="mb-1 font-medium">When should I use Random Crop?</p>
              <p>
                Short answer: If subjects in the wild may be occluded or may not be fully enclosed in the frame.
              </p>
            </InfoCallout>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Go Back</Button>
          <Button
            variant="brand"
            onClick={() => {
              onApply({ minPercent, maxPercent })
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

export function GrayscaleAugDialog({
  open,
  onOpenChange,
  thumbnailUrl,
  baseStyle,
  initialPercent,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  thumbnailUrl: string | null
  baseStyle?: React.CSSProperties
  initialPercent: number
  onApply: (percent: number) => void
}) {
  const [percent, setPercent] = useState(initialPercent)
  const base = baseStyle ?? {}

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Grayscale</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-[1fr_18rem] gap-6">
          <div className="min-w-0 space-y-3">
            <div className="mx-auto w-full max-w-sm">
              <div className="aspect-video overflow-hidden rounded-md bg-muted">
                {thumbnailUrl && <img src={thumbnailUrl} alt="" className="size-full object-cover" style={base} />}
              </div>
              <p className="mt-1 text-center text-xs text-muted-foreground">original</p>
            </div>
            <div className="mx-auto w-full max-w-sm">
              <div className="aspect-video overflow-hidden rounded-md bg-muted">
                {thumbnailUrl && (
                  <img
                    src={thumbnailUrl}
                    alt=""
                    className="size-full object-cover"
                    style={combineStyles(base, { filter: "grayscale(1)" })}
                  />
                )}
              </div>
              <p className="mt-1 text-center text-xs text-muted-foreground">grayscale</p>
            </div>
          </div>
          <div className="min-w-0 space-y-4">
            <p className="text-sm text-foreground">
              Probabilistically apply grayscale to a subset of the training set.
            </p>
            <div>
              <p className="mb-1.5 text-sm font-medium text-foreground">Percent of Outputted Images to Grayscale</p>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="rounded bg-brand px-2 py-0.5 text-xs font-semibold text-brand-foreground">
                  {percent}%
                </span>
                <ValueBadge>100%</ValueBadge>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={percent}
                onChange={(e) => setPercent(Number(e.target.value))}
                className="w-full accent-brand"
              />
            </div>
            <InfoCallout>
              <p className="mb-1 font-medium">When is grayscale used as an augmentation step?</p>
              <p>When you want to increase training variance but not discard color information at inference time.</p>
            </InfoCallout>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Go Back</Button>
          <Button
            variant="brand"
            onClick={() => {
              onApply(percent)
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
