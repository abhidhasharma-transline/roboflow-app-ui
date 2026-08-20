import { useRef, useState } from "react"
import { Scale, AlertTriangle, Activity, ShieldCheck, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useToastStore } from "@/stores/toastStore"
import { rebalanceSplit } from "@/lib/imageApi"

const SPLIT_META = {
  train: { label: "Train", icon: Activity, text: "text-brand", bg: "bg-brand" },
  valid: { label: "Valid", icon: ShieldCheck, text: "text-blue-600", bg: "bg-blue-500" },
  test: { label: "Test", icon: Pencil, text: "text-orange-600", bg: "bg-orange-500" },
} as const

function DualHandleSlider({
  trainPct,
  validPct,
  onChange,
}: {
  trainPct: number
  validPct: number
  onChange: (train: number, valid: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<"a" | "b" | null>(null)

  function pctFromEvent(e: PointerEvent | React.PointerEvent) {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100))
  }

  function startDrag(which: "a" | "b") {
    dragging.current = which
    function onMove(e: PointerEvent) {
      const pct = pctFromEvent(e)
      if (dragging.current === "a") {
        onChange(Math.min(pct, trainPct + validPct), validPct + trainPct - Math.min(pct, trainPct + validPct))
      } else {
        const boundaryB = Math.max(pct, trainPct)
        onChange(trainPct, boundaryB - trainPct)
      }
    }
    function onUp() {
      dragging.current = null
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  const boundaryA = trainPct
  const boundaryB = trainPct + validPct

  return (
    <div ref={trackRef} className="relative h-1.5 w-full rounded-full bg-muted">
      <div className="absolute h-full rounded-l-full bg-brand" style={{ left: 0, width: `${boundaryA}%` }} />
      <div className="absolute h-full bg-blue-500" style={{ left: `${boundaryA}%`, width: `${validPct}%` }} />
      <div
        className="absolute h-full rounded-r-full bg-orange-500"
        style={{ left: `${boundaryB}%`, width: `${100 - boundaryB}%` }}
      />
      {[boundaryA, boundaryB].map((pos, i) => (
        <button
          key={i}
          onPointerDown={() => startDrag(i === 0 ? "a" : "b")}
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-brand bg-background shadow"
          style={{ left: `${pos}%` }}
        />
      ))}
    </div>
  )
}

export function RebalanceSplitsDialog({
  workspaceId,
  projectId,
  datasetTotal,
  initialCounts,
  open,
  onOpenChange,
  onRebalanced,
}: {
  workspaceId: string
  projectId: string
  datasetTotal: number
  initialCounts: { train: number; valid: number; test: number }
  open: boolean
  onOpenChange: (open: boolean) => void
  onRebalanced: (counts: { train: number; valid: number; test: number }) => void
}) {
  const addToast = useToastStore((s) => s.addToast)
  const initialTrainPct = datasetTotal > 0 ? (initialCounts.train / datasetTotal) * 100 : 60
  const initialValidPct = datasetTotal > 0 ? (initialCounts.valid / datasetTotal) * 100 : 40

  const [trainPct, setTrainPct] = useState(initialTrainPct)
  const [validPct, setValidPct] = useState(initialValidPct)
  const [saving, setSaving] = useState(false)

  const testPct = Math.max(0, 100 - trainPct - validPct)
  const counts = {
    train: Math.round((trainPct / 100) * datasetTotal),
    valid: Math.round((validPct / 100) * datasetTotal),
    test: Math.round((testPct / 100) * datasetTotal),
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await rebalanceSplit(workspaceId, projectId, {
        train_percent: trainPct,
        valid_percent: validPct,
        test_percent: testPct,
      })
      onRebalanced({ train: res.train, valid: res.valid, test: res.test })
      addToast({
        variant: "success",
        title: "Split rebalanced",
        description: `Train ${res.train} · Valid ${res.valid} · Test ${res.test}`,
      })
      onOpenChange(false)
    } catch {
      addToast({ variant: "error", title: "Couldn't rebalance", description: "Please try again." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={saving ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="size-4" />
            Rebalance Splits
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Adjusting splits will rebalance images across your dataset and affect this and all future versions.
        </div>

        <div className="rounded-lg border border-border p-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            {(["train", "valid", "test"] as const).map((s) => {
              const meta = SPLIT_META[s]
              const pct = s === "train" ? trainPct : s === "valid" ? validPct : testPct
              return (
                <div key={s} className="text-center">
                  <span className={`flex items-center gap-1 font-semibold ${meta.text}`}>
                    {Math.round(pct)}%
                    <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                      <meta.icon className="size-3" />
                      {meta.label}
                    </span>
                  </span>
                  <p className="mt-1 text-xs text-muted-foreground">{counts[s]} images</p>
                </div>
              )
            })}
          </div>
          <DualHandleSlider
            trainPct={trainPct}
            validPct={validPct}
            onChange={(t, v) => {
              setTrainPct(Math.max(0, t))
              setValidPct(Math.max(0, v))
            }}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="brand" onClick={handleSave} disabled={saving || datasetTotal === 0}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
