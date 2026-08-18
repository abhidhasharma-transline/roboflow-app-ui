import { useRef, useState } from "react"
import { Upload, FileText, BoxSelect } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { appendImagesToBatch } from "@/lib/uploadApi"

interface AddImagesToBatchDialogProps {
  workspaceId: string
  projectId: string
  batchId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploaded: () => void
}

export function AddImagesToBatchDialog({
  workspaceId,
  projectId,
  batchId,
  open,
  onOpenChange,
  onUploaded,
}: AddImagesToBatchDialogProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [percent, setPercent] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(fileList: FileList, folderName?: string) {
    const files = Array.from(fileList)
    if (files.length === 0) return
    setUploading(true)
    setPercent(0)
    setError(null)
    try {
      await appendImagesToBatch(workspaceId, projectId, batchId, files, folderName, setPercent)
      onUploaded()
      onOpenChange(false)
    } catch {
      setError("Upload failed — please try again.")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
      if (folderInputRef.current) folderInputRef.current.value = ""
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }

  return (
    <Dialog open={open} onOpenChange={uploading ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add images to this batch</DialogTitle>
        </DialogHeader>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            if (!uploading) setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={uploading ? undefined : onDrop}
          className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
            isDragging ? "border-brand bg-brand/5" : "border-border bg-muted/20"
          }`}
        >
          {uploading ? (
            <div className="flex w-full max-w-xs flex-col items-center gap-3 py-4">
              <p className="text-sm font-semibold text-brand">Uploading…</p>
              <Progress value={percent} className="w-full" />
            </div>
          ) : (
            <>
              <div className="flex size-11 items-center justify-center rounded-full bg-muted text-foreground">
                <Upload className="size-5" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Drag and drop file(s) here, or:
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <FileText className="size-3.5" />
                  Select Files
                </Button>
                <Button variant="outline" size="sm" onClick={() => folderInputRef.current?.click()}>
                  <BoxSelect className="size-3.5" />
                  Select Folder
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/bmp,image/webp,image/avif"
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
              <input
                ref={folderInputRef}
                type="file"
                multiple
                // @ts-expect-error — non-standard but supported by every major browser
                webkitdirectory=""
                className="hidden"
                onChange={(e) => {
                  if (!e.target.files || e.target.files.length === 0) return
                  const first = e.target.files[0] as File & { webkitRelativePath?: string }
                  const folderName = first.webkitRelativePath?.split("/")[0] ?? "Folder upload"
                  handleFiles(e.target.files, folderName)
                }}
              />
            </>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}
