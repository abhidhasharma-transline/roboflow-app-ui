import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { TagInput } from "@/components/shared/TagInput"
import { inviteWorkspaceMember } from "@/lib/workspaceApi"
import { MemberAccessFields } from "./MemberAccessFields"
import { effectivePermissions, type PermissionKey } from "@/lib/permissions"
import type { WorkspaceRole } from "@/types/auth"

interface InviteMemberDialogProps {
  workspaceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onInvited?: () => void
}

export function InviteMemberDialog({
  workspaceId,
  open,
  onOpenChange,
  onInvited,
}: InviteMemberDialogProps) {
  const [emails, setEmails] = useState<string[]>([])
  const [role, setRole] = useState<WorkspaceRole>("labeler")
  const [permissions, setPermissions] = useState<Record<PermissionKey, boolean>>(
    effectivePermissions("labeler", null)
  )
  const [fullAccess, setFullAccess] = useState(true)
  const [projectIds, setProjectIds] = useState<string[]>([])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successfulInvites, setSuccessfulInvites] = useState<string[]>([])
  const [inviteErrors, setInviteErrors] = useState<{ email: string; error: string }[]>([])

  function reset() {
    setEmails([])
    setRole("labeler")
    setPermissions(effectivePermissions("labeler", null))
    setFullAccess(true)
    setProjectIds([])
    setSuccessfulInvites([])
    setInviteErrors([])
  }

  function handleRoleChange(newRole: WorkspaceRole) {
    setRole(newRole)
    setPermissions(effectivePermissions(newRole, null))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (emails.length === 0) return

    setIsSubmitting(true)
    setSuccessfulInvites([])
    setInviteErrors([])

    try {
      const success: string[] = []
      const failures: { email: string; error: string }[] = []
      const access = {
        role,
        permissions,
        project_ids: fullAccess ? null : projectIds,
      }

      for (const email of emails) {
        try {
          await inviteWorkspaceMember(workspaceId, email, access)
          success.push(email)
        } catch (err) {
          failures.push({ email, error: extractErrorMessage(err) })
        }
      }

      setSuccessfulInvites(success)
      setInviteErrors(failures)

      if (failures.length === 0) {
        setEmails([])
      } else {
        setEmails(failures.map((f) => f.email))
      }
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
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite members</DialogTitle>
          <DialogDescription>
            Enter one or more email addresses and choose the role/access they'll get.
            Everyone you invite here gets the same settings.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Member emails</Label>
            <TagInput
              value={emails}
              onChange={setEmails}
              placeholder="Type an email and press Enter..."
            />
          </div>

          <MemberAccessFields
            workspaceId={workspaceId}
            role={role}
            onRoleChange={handleRoleChange}
            permissions={permissions}
            onPermissionsChange={setPermissions}
            fullAccess={fullAccess}
            onFullAccessChange={setFullAccess}
            projectIds={projectIds}
            onProjectIdsChange={setProjectIds}
          />

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
            <Button type="submit" variant="brand" disabled={isSubmitting || emails.length === 0}>
              {isSubmitting ? "Sending..." : "Send Invitations"}
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
