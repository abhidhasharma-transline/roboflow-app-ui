import { useState } from "react"
import { Trash2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function DeleteVersionDialog({
  open,
  onOpenChange,
  versionName,
  onConfirm,
  deleting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  versionName: string
  onConfirm: () => void
  deleting: boolean
}) {
  const [confirmText, setConfirmText] = useState("")
  const matches = confirmText === versionName

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (deleting) return
        onOpenChange(v)
        if (!v) setConfirmText("")
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-1 flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <Trash2 className="size-5 text-destructive" />
          </div>
          <DialogTitle className="text-center">Move to Trash</DialogTitle>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          This will move version <span className="font-semibold">{versionName}</span> to Trash. Any model
          trained on it will stop working. You can restore it within 30 days.
        </div>

        <div>
          <p className="mb-1.5 text-sm text-foreground">
            Type <span className="font-semibold text-destructive">{versionName}</span> To Confirm
          </p>
          <Input
            autoFocus
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={versionName}
            disabled={deleting}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={!matches || deleting}>
            {deleting ? "Moving…" : "Move to Trash"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
