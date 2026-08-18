import { useEffect, useState } from "react"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { listProjectMembers } from "@/lib/projectApi"
import { submitForReview } from "@/lib/jobApi"
import { fullName, initials } from "@/lib/userDisplay"
import type { ProjectMember } from "@/types/project"

export function SubmitForReviewDialog({
  workspaceId,
  projectId,
  jobId,
  open,
  onOpenChange,
  onSubmitted,
}: {
  workspaceId: string
  projectId: string
  jobId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmitted: () => void
}) {
  const [reviewers, setReviewers] = useState<ProjectMember[]>([])
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    listProjectMembers(workspaceId, projectId, "reviewer").then(setReviewers).catch(() => {})
  }, [open, workspaceId, projectId])

  const filtered = search.trim()
    ? reviewers.filter((m) => `${fullName(m)} ${m.email}`.toLowerCase().includes(search.toLowerCase()))
    : reviewers

  function toggle(userId: string) {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  async function handleSubmit() {
    if (selectedIds.length === 0) {
      setError("Select at least one reviewer.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await submitForReview(workspaceId, projectId, jobId, selectedIds)
      onOpenChange(false)
      setSelectedIds([])
      onSubmitted()
    } catch {
      setError("Couldn't submit for review — try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit for Review</DialogTitle>
          <DialogDescription>
            Pick reviewers for this job — only workspace members with the reviewer role on this
            project are listed.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search reviewers…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No reviewers on this project yet.
            </p>
          ) : (
            filtered.map((m) => {
              const selected = selectedIds.includes(m.user_id)
              return (
                <button
                  key={m.user_id}
                  type="button"
                  onClick={() => toggle(m.user_id)}
                  className={`flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${
                    selected ? "border-brand bg-brand/5" : "border-border hover:bg-accent"
                  }`}
                >
                  <Avatar className="size-9 shrink-0">
                    <AvatarFallback className="bg-brand/15 text-xs text-brand">
                      {initials(m)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{fullName(m)}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="brand" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit for Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
