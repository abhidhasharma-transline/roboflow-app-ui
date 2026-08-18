import { useRef, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AssignTeamFields, type AssignTeamFieldsHandle } from "@/features/annotate/AssignTeamFields"
import { assignImagesForLabeling } from "@/lib/imageApi"

export function AssignForLabelingPanel({
  workspaceId,
  projectId,
  imageIds,
  open,
  onOpenChange,
  onAssigned,
}: {
  workspaceId: string
  projectId: string
  imageIds: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onAssigned: () => void
}) {
  const fieldsRef = useRef<AssignTeamFieldsHandle>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    const payload = fieldsRef.current?.getPayload()
    if (!payload) {
      setError("Select at least one team member.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await assignImagesForLabeling(workspaceId, projectId, imageIds, payload.selectedLabelerIds, {
        instructions: payload.instructions.trim() || undefined,
        shuffle: payload.shuffle,
      })
      onOpenChange(false)
      onAssigned()
    } catch {
      setError("Couldn't assign these images — try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
        onClick={() => !submitting && onOpenChange(false)}
      />
      <div className="relative flex h-full w-[420px] shrink-0 flex-col overflow-y-auto border-l border-border bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Reassign {imageIds.length} Image{imageIds.length !== 1 && "s"} for Labeling
          </h2>
          <button
            onClick={() => !submitting && onOpenChange(false)}
            className="rounded p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>

        <AssignTeamFields
          ref={fieldsRef}
          workspaceId={workspaceId}
          projectId={projectId}
          totalAvailable={imageIds.length}
          allowTotalEdit={false}
          imageIds={imageIds}
        />

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <div className="mt-6 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="brand" className="flex-1" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Assigning…" : "Reassign"}
          </Button>
        </div>
      </div>
    </div>
  )
}
