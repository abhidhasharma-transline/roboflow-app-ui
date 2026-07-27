import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TagInput } from "@/components/shared/TagInput"
import { createWorkspace, addWorkspaceMember } from "@/lib/workspaceApi"
import type { Workspace } from "@/types/workspace"

interface CreateWorkspaceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (workspace: Workspace) => void
}

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateWorkspaceDialogProps) {
  const [name, setName] = useState("")
  const [emails, setEmails] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [memberErrors, setMemberErrors] = useState<{ email: string; error: string }[]>([])

  function reset() {
    setName("")
    setEmails([])
    setError(null)
    setMemberErrors([])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setIsSubmitting(true)
    setError(null)
    setMemberErrors([])

    try {
      const workspace = await createWorkspace(name.trim())

      // Members are added one at a time — a failure for one email (e.g. no
      // account with that address yet) shouldn't roll back the workspace
      // that already succeeded.
      const failures: { email: string; error: string }[] = []
      for (const email of emails) {
        try {
          await addWorkspaceMember(workspace.id, email)
        } catch (err) {
          failures.push({ email, error: extractErrorMessage(err) })
        }
      }
      setMemberErrors(failures)
      onCreated(workspace)

      if (failures.length === 0) {
        reset()
        onOpenChange(false)
      }
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!isSubmitting) {
          onOpenChange(v)
          if (!v) reset()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
          <DialogDescription>
            Give it a name and optionally add teammates by email — they must
            already have an account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ws-name">Workspace name</Label>
            <Input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Robotics"
              autoFocus
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Invite members (optional)</Label>
            <TagInput
              value={emails}
              onChange={setEmails}
              placeholder="Type an email and press Enter…"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {memberErrors.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="mb-1 font-medium">
                Workspace created, but {memberErrors.length} invite
                {memberErrors.length !== 1 && "s"} didn't go through:
              </p>
              <ul className="list-inside list-disc space-y-0.5">
                {memberErrors.map((m) => (
                  <li key={m.email}>
                    {m.email} — {m.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter>
            {memberErrors.length > 0 ? (
              <Button
                type="button"
                variant="brand"
                onClick={() => {
                  reset()
                  onOpenChange(false)
                }}
              >
                Done
              </Button>
            ) : (
              <Button type="submit" variant="brand" disabled={isSubmitting || !name.trim()}>
                {isSubmitting ? "Creating…" : "Create workspace"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function extractErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const resp = (err as { response?: { data?: { detail?: unknown } } }).response
    const detail = resp?.data?.detail
    if (typeof detail === "string") return detail
  }
  return "Something went wrong — please try again."
}