import { useState } from "react"
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { inviteWorkspaceMember } from "@/lib/workspaceApi"
import { useAuthStore } from "@/stores/authStore"
import { MemberAccessFields } from "./MemberAccessFields"
import { effectivePermissions, type PermissionKey } from "@/lib/permissions"
import type { WorkspaceRole } from "@/types/auth"

interface InviteMemberDialogProps {
  workspaceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onInvited?: () => void
}

interface InviteDraft {
  id: string
  email: string
  role: WorkspaceRole
  permissions: Record<PermissionKey, boolean>
  fullAccess: boolean
  projectIds: string[]
  expanded: boolean
}

function makeDraft(email: string): InviteDraft {
  return {
    id: crypto.randomUUID(),
    email,
    role: "labeler",
    permissions: effectivePermissions("labeler", null),
    fullAccess: true,
    projectIds: [],
    expanded: true,
  }
}

const ROLE_SUMMARY: Record<WorkspaceRole, string> = {
  admin: "Admin",
  labeler: "Labeler",
  reviewer: "Reviewer",
}

export function InviteMemberDialog({
  workspaceId,
  open,
  onOpenChange,
  onInvited,
}: InviteMemberDialogProps) {
  const currentUser = useAuthStore((s) => s.user)
  const [emailDraft, setEmailDraft] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<InviteDraft[]>([])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successfulInvites, setSuccessfulInvites] = useState<string[]>([])
  const [inviteErrors, setInviteErrors] = useState<{ email: string; error: string }[]>([])

  function reset() {
    setEmailDraft("")
    setEmailError(null)
    setDrafts([])
    setSuccessfulInvites([])
    setInviteErrors([])
  }

  function addEmail() {
    const email = emailDraft.trim().toLowerCase()
    if (!email) return

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("That doesn't look like a valid email.")
      return
    }
    if (email === currentUser?.email.toLowerCase()) {
      setEmailError("That's you! You already have the keys to this place 🔑")
      return
    }
    if (drafts.some((d) => d.email === email)) {
      setEmailError("Already added below.")
      return
    }

    setDrafts((prev) => [...prev, makeDraft(email)])
    setEmailDraft("")
    setEmailError(null)
  }

  function handleEmailKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addEmail()
    }
  }

  function removeDraft(id: string) {
    setDrafts((prev) => prev.filter((d) => d.id !== id))
  }

  function updateDraft(id: string, patch: Partial<InviteDraft>) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }

  function toggleExpanded(id: string) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, expanded: !d.expanded } : d)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (drafts.length === 0) return

    setIsSubmitting(true)
    setSuccessfulInvites([])
    setInviteErrors([])

    try {
      const success: string[] = []
      const failures: { email: string; error: string }[] = []

      for (const draft of drafts) {
        try {
          await inviteWorkspaceMember(workspaceId, draft.email, {
            role: draft.role,
            permissions: draft.permissions,
            project_ids: draft.fullAccess ? null : draft.projectIds,
          })
          success.push(draft.email)
        } catch (err) {
          failures.push({ email: draft.email, error: extractErrorMessage(err) })
        }
      }

      setSuccessfulInvites(success)
      setInviteErrors(failures)
      setDrafts((prev) => prev.filter((d) => failures.some((f) => f.email === d.email)))
      if (success.length > 0) onInvited?.()
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite members</DialogTitle>
          <DialogDescription>
            Add members one at a time, then set each person's role and access — ideal when
            different people need different permissions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Member email</Label>
            <div className="flex gap-2">
              <Input
                value={emailDraft}
                onChange={(e) => {
                  setEmailDraft(e.target.value)
                  setEmailError(null)
                }}
                onKeyDown={handleEmailKeyDown}
                placeholder="Type an email and press Enter..."
                className="flex-1"
              />
              <Button type="button" variant="outline" onClick={addEmail}>
                <Plus className="size-3.5" />
                Add
              </Button>
            </div>
            {emailError && <p className="text-xs text-destructive">{emailError}</p>}
          </div>

          {drafts.length > 0 && (
            <div className="flex flex-col gap-2.5">
              {drafts.map((draft) => (
                <div key={draft.id} className="rounded-md border border-border">
                  <div className="flex items-center justify-between gap-2 p-2.5">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(draft.id)}
                      className="flex flex-1 items-center gap-1.5 text-left"
                    >
                      {draft.expanded ? (
                        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate text-sm font-medium text-foreground">
                        {draft.email}
                      </span>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {ROLE_SUMMARY[draft.role]}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeDraft(draft.id)}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                      title="Remove"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>

                  {draft.expanded && (
                    <div className="border-t border-border p-3">
                      <MemberAccessFields
                        workspaceId={workspaceId}
                        role={draft.role}
                        onRoleChange={(role) =>
                          updateDraft(draft.id, { role, permissions: effectivePermissions(role, null) })
                        }
                        permissions={draft.permissions}
                        onPermissionsChange={(permissions) => updateDraft(draft.id, { permissions })}
                        fullAccess={draft.fullAccess}
                        onFullAccessChange={(fullAccess) => updateDraft(draft.id, { fullAccess })}
                        projectIds={draft.projectIds}
                        onProjectIdsChange={(projectIds) => updateDraft(draft.id, { projectIds })}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {successfulInvites.length > 0 && (
            <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-700">
              <p className="font-medium">
                Invitation{successfulInvites.length !== 1 && "s"} sent successfully:
              </p>
              <ul className="mt-1 list-inside list-disc">
                {successfulInvites.map((email) => (
                  <li key={email}>{email}</li>
                ))}
              </ul>
            </div>
          )}

          {inviteErrors.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-medium">
                Couldn't send {inviteErrors.length} invitation
                {inviteErrors.length !== 1 && "s"}:
              </p>
              <ul className="mt-1 list-inside list-disc">
                {inviteErrors.map((item) => (
                  <li key={item.email}>
                    {item.email} — {item.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter>
            <Button type="submit" variant="brand" disabled={isSubmitting || drafts.length === 0}>
              {isSubmitting
                ? "Sending..."
                : `Send Invitation${drafts.length !== 1 ? "s" : ""}${drafts.length > 0 ? ` (${drafts.length})` : ""}`}
            </Button>
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
  return "Something went wrong. Please try again."
}
