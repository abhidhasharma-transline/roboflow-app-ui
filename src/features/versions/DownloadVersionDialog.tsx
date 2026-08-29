import { useState } from "react"
import { Download, FileArchive, Code2 } from "lucide-react"
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

const YOLO_FORMATS = ["YOLOv8", "YOLOv9", "YOLOv11", "YOLOv12", "YOLO26"]

export function DownloadVersionDialog({
  open,
  onOpenChange,
  onDownload,
  downloading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDownload: (format: string) => void
  downloading: boolean
}) {
  const [format, setFormat] = useState(YOLO_FORMATS[2])
  const [option, setOption] = useState<"zip" | "code">("zip")

  return (
    <Dialog open={open} onOpenChange={downloading ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="size-4" />
            Download
          </DialogTitle>
        </DialogHeader>

        <div>
          <p className="mb-1.5 text-sm font-medium text-foreground">Image and Annotation Format</p>
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {YOLO_FORMATS.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="mt-2 rounded-md border-l-4 border-amber-400 bg-muted p-3 text-sm text-muted-foreground">
            TXT annotations and YAML config used with <span className="font-medium text-foreground">{format}</span>.
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Download Options</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setOption("zip")}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left ${
                option === "zip" ? "border-brand bg-brand/5" : "border-border hover:bg-accent"
              }`}
            >
              <span
                className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 ${
                  option === "zip" ? "border-brand" : "border-input"
                }`}
              >
                {option === "zip" && <span className="size-2 rounded-full bg-brand" />}
              </span>
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <FileArchive className="size-3.5" />
                  Download zip to computer
                </p>
                <p className="text-xs text-muted-foreground">Downloads all images, annotations, and classes.</p>
              </div>
            </button>

            <button
              disabled
              title="Coming soon — no hosted dataset API to generate a code snippet from yet"
              className="flex cursor-not-allowed items-start gap-3 rounded-lg border border-border p-3 text-left opacity-50"
            >
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-input" />
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Code2 className="size-3.5" />
                  Show download code
                </p>
                <p className="text-xs text-muted-foreground">
                  Custom train this dataset using the provided code snippet in a notebook.
                </p>
              </div>
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={downloading}>
            Cancel
          </Button>
          <Button variant="brand" onClick={() => onDownload(format)} disabled={downloading}>
            {downloading ? "Preparing…" : "Continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
