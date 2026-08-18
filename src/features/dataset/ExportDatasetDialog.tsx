import { useEffect, useState } from "react"
import { ChevronDown, Download, Activity, ShieldCheck, Pencil, FileArchive, Code2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { useToastStore } from "@/stores/toastStore"
import { listProjectImages } from "@/lib/imageApi"
import { exportDatasetYolo } from "@/lib/exportApi"
import type { ProjectAnnotationType } from "@/types/project"

const YOLO_FORMATS = ["YOLOv8", "YOLOv9", "YOLOv11", "YOLOv12", "YOLO26"]

function annotationTypeLabel(type: ProjectAnnotationType) {
  return type
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ")
}

export function ExportDatasetDialog({
  workspaceId,
  projectId,
  annotationType,
  classCount,
  open,
  onOpenChange,
}: {
  workspaceId: string
  projectId: string
  annotationType: ProjectAnnotationType
  classCount: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const addToast = useToastStore((s) => s.addToast)

  const [format, setFormat] = useState(YOLO_FORMATS[1])
  const [counts, setCounts] = useState<{ total: number; train: number; valid: number; test: number } | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!open) return
    setCounts(null)
    Promise.all([
      listProjectImages(workspaceId, projectId, { status: "dataset", limit: 1 }),
      listProjectImages(workspaceId, projectId, { status: "dataset", split: "train", limit: 1 }),
      listProjectImages(workspaceId, projectId, { status: "dataset", split: "valid", limit: 1 }),
      listProjectImages(workspaceId, projectId, { status: "dataset", split: "test", limit: 1 }),
    ]).then(([all, train, valid, test]) => {
      setCounts({ total: all.total, train: train.total, valid: valid.total, test: test.total })
    })
  }, [open, workspaceId, projectId])

  function triggerBlobDownload(blob: Blob, filename: string) {
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = objectUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(objectUrl)
  }

  async function handleExportZip() {
    setDownloading(true)
    try {
      const blob = await exportDatasetYolo(workspaceId, projectId)
      triggerBlobDownload(blob, "dataset_export.zip")
      onOpenChange(false)
      addToast({
        variant: "success",
        title: "Dataset export ready",
        description: `${total} image${total !== 1 ? "s" : ""} · ${format}`,
        actionLabel: "Download",
        onAction: () => triggerBlobDownload(blob, "dataset_export.zip"),
      })
    } catch {
      addToast({ variant: "error", title: "Export failed", description: "Please try again." })
    } finally {
      setDownloading(false)
    }
  }

  const total = counts?.total ?? 0
  const trainPct = total > 0 ? ((counts?.train ?? 0) / total) * 100 : 0
  const validPct = total > 0 ? ((counts?.valid ?? 0) / total) * 100 : 0
  const testPct = total > 0 ? ((counts?.test ?? 0) / total) * 100 : 0

  return (
    <Dialog open={open} onOpenChange={downloading ? undefined : onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-1 flex size-12 items-center justify-center rounded-full bg-brand/10">
            <Download className="size-5 text-brand" />
          </div>
          <DialogTitle className="text-center">Export Dataset</DialogTitle>
          <div className="flex justify-center">
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {annotationTypeLabel(annotationType)}
            </span>
          </div>
        </DialogHeader>

        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 text-sm text-muted-foreground">
            {total} image{total !== 1 && "s"} · {classCount} class{classCount !== 1 && "es"}
          </p>
          {counts && total > 0 && (
            <>
              <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="bg-brand" style={{ width: `${trainPct}%` }} />
                <div className="bg-blue-500" style={{ width: `${validPct}%` }} />
                <div className="bg-orange-500" style={{ width: `${testPct}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Activity className="size-3 text-brand" />Train {counts.train}</span>
                <span className="flex items-center gap-1"><ShieldCheck className="size-3 text-blue-500" />Valid {counts.valid}</span>
                <span className="flex items-center gap-1"><Pencil className="size-3 text-orange-500" />Test {counts.test}</span>
              </div>
            </>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-foreground">Format</p>
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {YOLO_FORMATS.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1.5 text-xs text-muted-foreground">
            TXT annotations and YAML config used with {format}.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={downloading}>
            Cancel
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="brand" disabled={downloading || !counts || total === 0}>
                <Download className="size-4" />
                {downloading ? "Exporting…" : "Export As"}
                <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onClick={handleExportZip} className="flex-col items-start gap-0.5 py-2">
                <span className="flex items-center gap-2 font-medium">
                  <FileArchive className="size-4" />
                  ZIP file
                </span>
                <span className="pl-6 text-xs text-muted-foreground">
                  Download images, annotations, and class list as a single archive.
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="flex-col items-start gap-0.5 py-2">
                <span className="flex items-center gap-2 font-medium">
                  <Code2 className="size-4" />
                  Code snippet
                </span>
                <span className="pl-6 text-xs text-muted-foreground">
                  Coming soon — no hosted dataset API yet.
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </DialogContent>
    </Dialog>
  )
}
