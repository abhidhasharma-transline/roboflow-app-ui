import { useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AssignTeamFields, type AssignTeamFieldsHandle } from "./AssignTeamFields"
import { reassignJob } from "@/lib/jobApi"
import type { JobDetail } from "@/types/job"

export function ReassignJobDialog({
  workspaceId,
  projectId,
  job,
  open,
  onOpenChange,
  onReassigned,
}: {
  workspaceId: string
  projectId: string
  job: JobDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  onReassigned: () => void
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
      await reassignJob(workspaceId, projectId, job.id, {
        assigneeIds: payload.selectedLabelerIds,
        shuffle: payload.shuffle,
        instructions: payload.instructions.trim() || undefined,
      })
      onOpenChange(false)
      onReassigned()
    } catch {
      setError("Couldn't reassign the job — try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Images to Team Members</DialogTitle>
        </DialogHeader>

        <AssignTeamFields
          ref={fieldsRef}
          workspaceId={workspaceId}
          projectId={projectId}
          totalAvailable={job.total_images}
          allowTotalEdit={false}
          initialShuffle={job.shuffle}
          initialInstructions={job.instructions ?? ""}
          initialSelectedLabelerIds={job.assignments.map((a) => a.user_id)}
        />

        {error && <p className="mt-1 text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="brand" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Reassigning…" : "Reassign Job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
