import { useState } from "react"
import { Image as ImageIcon, History, PieChart, Activity, ShieldCheck, Pencil } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { addJobImagesToDataset, type DatasetSplitMethod } from "@/lib/jobApi"
import { useToastStore } from "@/stores/toastStore"

const METHOD_OPTIONS: { value: DatasetSplitMethod; label: string; icon: typeof History }[] = [
  { value: "existing", label: "Use Existing Values", icon: History },
  { value: "split", label: "Split Images Between Train/Valid/Test", icon: PieChart },
  { value: "all_train", label: "Add All Images to Training Set", icon: Activity },
  { value: "all_valid", label: "Add All Images to Validation Set", icon: ShieldCheck },
  { value: "all_test", label: "Add All Images to Testing Set", icon: Pencil },
]

/** Mirrors the backend's compute_splits() so the preview bar matches what
 * will actually happen — smaller buckets round down to zero instead of
 * forcing at least one image into every bucket, which is why 1-2 images
 * land 100% in Train instead of being force-split three ways. "existing"
 * can't be previewed exactly client-side (it depends on each image's prior
 * split, if any) — new images default to Train, so that's shown here too. */
function computeSplitPreview(n: number, method: DatasetSplitMethod) {
  if (method === "all_valid") return { train: 0, valid: n, test: 0 }
  if (method === "all_test") return { train: 0, valid: 0, test: n }
  if (method === "all_train" || method === "existing") return { train: n, valid: 0, test: 0 }
  const train = Math.round(n * 0.7)
  const valid = Math.round(n * 0.15)
  const test = n - train - valid
  return { train, valid, test }
}

export function AddToDatasetDialog({
  workspaceId,
  projectId,
  jobId,
  labeledCount,
  remainingCount,
  open,
  onOpenChange,
  onAdded,
}: {
  workspaceId: string
  projectId: string
  jobId: string
  labeledCount: number
  remainingCount: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: (result: { job_id: string; images_added: number }) => void
}) {
  const [method, setMethod] = useState<DatasetSplitMethod>("existing")
  const [submitting, setSubmitting] = useState(false)
  const addToast = useToastStore((s) => s.addToast)

  const preview = computeSplitPreview(labeledCount, method)
  const pct = (n: number) => (labeledCount === 0 ? 0 : Math.round((n / labeledCount) * 100))

  async function handleAdd() {
    setSubmitting(true)
    try {
      const res = await addJobImagesToDataset(workspaceId, projectId, jobId, method)
      onAdded(res)
      onOpenChange(false)
    } catch {
      addToast({ variant: "error", title: "Couldn't add to dataset", description: "Please try again." })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={submitting ? undefined : onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="size-4" />
            Add Images to Dataset
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border border-border p-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Labeled Images to Add</span>
            <span className="font-semibold text-foreground">{labeledCount}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Remaining Batch Images</span>
            <span className="font-semibold text-foreground">{remainingCount}</span>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {remainingCount} labeled image{remainingCount !== 1 && "s"} will stay in this batch.
          </p>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-foreground">Method</p>
          <Select value={method} onValueChange={(v) => setMethod(v as DatasetSplitMethod)}>
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

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="brand" onClick={handleAdd} disabled={submitting || labeledCount === 0}>
            {submitting ? "Adding…" : `Add ${labeledCount} Image${labeledCount !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
