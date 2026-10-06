import { useState } from "react"
import { SplitSquareHorizontal, History, PieChart, Activity, ShieldCheck, Pencil } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { applyBatchSplit, type SplitMethod } from "@/lib/uploadApi"
import type { SplitCounts } from "@/types/upload"

const METHOD_OPTIONS: { value: SplitMethod; label: string; icon: typeof History }[] = [
  { value: "existing", label: "Use Existing Values", icon: History },
  { value: "split", label: "Split Images Between Train/Valid/Test", icon: PieChart },
  { value: "all_train", label: "Add All Images to Training Set", icon: Activity },
  { value: "all_valid", label: "Add All Images to Validation Set", icon: ShieldCheck },
  { value: "all_test", label: "Add All Images to Testing Set", icon: Pencil },
]

/** Same shape as AddToDatasetDialog's own preview — "existing" shows exactly
 *  what upload-time detection already found (real per-image data, not a
 *  guess); every other method recomputes from the total the same way
 *  compute_splits (backend) does, so what's shown here is what Continue
 *  will actually produce. */
function computePreview(counts: SplitCounts, method: SplitMethod): { train: number; valid: number; test: number } {
  const total = counts.train + counts.valid + counts.test + counts.unassigned
  if (method === "existing") return { train: counts.train, valid: counts.valid, test: counts.test }
  if (method === "all_valid") return { train: 0, valid: total, test: 0 }
  if (method === "all_test") return { train: 0, valid: 0, test: total }
  if (method === "all_train") return { train: total, valid: 0, test: 0 }
  const train = Math.round(total * 0.7)
  const valid = Math.round(total * 0.15)
  return { train, valid, test: total - train - valid }
}

export function SplitConfirmDialog({
  workspaceId,
  projectId,
  batchId,
  splitCounts,
  open,
  onOpenChange,
  onContinue,
}: {
  workspaceId: string
  projectId: string
  batchId: string
  splitCounts: SplitCounts
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called once the chosen method has been applied server-side — proceeds
   *  to the normal Save and Continue (name/tags finalize + auto-job-creation). */
  onContinue: () => void
}) {
  const [method, setMethod] = useState<SplitMethod>("existing")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = splitCounts.train + splitCounts.valid + splitCounts.test + splitCounts.unassigned
  const preview = computePreview(splitCounts, method)
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100))

  async function handleContinue() {
    setSubmitting(true)
    setError(null)
    try {
      await applyBatchSplit(workspaceId, projectId, batchId, method)
      onContinue()
    } catch {
      setError("Couldn't apply this split — please try again.")
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={submitting ? undefined : onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SplitSquareHorizontal className="size-4" />
            How should we split these images?
          </DialogTitle>
          <DialogDescription>
            This folder already came with a Train/Valid/Test split — Use Existing Values keeps it
            exactly as detected, or pick a different method below.
          </DialogDescription>
        </DialogHeader>

        <div>
          <p className="mb-1.5 text-sm font-medium text-foreground">Method</p>
          <Select value={method} onValueChange={(v) => setMethod(v as SplitMethod)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className="flex items-center gap-2">
                    <opt.icon className="size-3.5" />
                    {opt.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-border p-3">
          <div className="mb-2 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <p className="font-semibold text-brand">{pct(preview.train)}% Train</p>
              <p className="text-muted-foreground">
                {preview.train} image{preview.train !== 1 && "s"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-blue-500">{pct(preview.valid)}% Valid</p>
              <p className="text-muted-foreground">
                {preview.valid} image{preview.valid !== 1 && "s"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-orange-500">{pct(preview.test)}% Test</p>
              <p className="text-muted-foreground">
                {preview.test} image{preview.test !== 1 && "s"}
              </p>
            </div>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-brand" style={{ width: `${pct(preview.train)}%` }} />
            <div className="h-full bg-blue-500" style={{ width: `${pct(preview.valid)}%` }} />
            <div className="h-full bg-orange-500" style={{ width: `${pct(preview.test)}%` }} />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="brand" onClick={handleContinue} disabled={submitting}>
            {submitting ? "Saving…" : "Continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
