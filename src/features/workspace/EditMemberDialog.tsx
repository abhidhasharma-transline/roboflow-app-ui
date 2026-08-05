import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { updateWorkspaceMember } from "@/lib/workspaceApi"
import { MemberAccessFields } from "./MemberAccessFields"
import { effectivePermissions, type PermissionKey } from "@/lib/permissions"
import type { WorkspaceMember } from "@/types/workspace"
import type { WorkspaceRole } from "@/types/auth"

interface EditMemberDialogProps {
  workspaceId: string
  member: WorkspaceMember | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated?: () => void
}

export function EditMemberDialog({
  workspaceId,
  member,
  open,
  onOpenChange,
  onUpdated,
}: EditMemberDialogProps) {
  const [role, setRole] = useState<WorkspaceRole>("labeler")
  const [permissions, setPermissions] = useState<Record<PermissionKey, boolean>>(
    effectivePermissions("labeler", null)
  )
  const [fullAccess, setFullAccess] = useState(true)
  const [projectIds, setProjectIds] = useState<string[]>([])
  // Project access can't be pre-filled for a currently-restricted member (the
  // members list doesn't expose *which* projects they have) — only send an
  // access-scope change if the admin actually touched these controls, so we
  // never silently wipe an existing restriction they didn't mean to change.
  const [accessTouched, setAccessTouched] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!member) return
    setRole(member.role)
    setPermissions(effectivePermissions(member.role, member.permission_overrides))
    setFullAccess(member.has_full_project_access)
    setProjectIds([])
    setAccessTouched(false)
    setError(null)
  }, [member])

  function handleRoleChange(newRole: WorkspaceRole) {
    setRole(newRole)
    setPermissions(effectivePermissions(newRole, null))
  }

  function handleFullAccessChange(value: boolean) {
    setFullAccess(value)
    setAccessTouched(true)
  }

  function handleProjectIdsChange(ids: string[]) {
    setProjectIds(ids)
    setAccessTouched(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!member) return

    setIsSubmitting(true)
    setError(null)

    try {
      await updateWorkspaceMember(workspaceId, member.user_id, {
        role,
        permissions,
        ...(accessTouched ? { full_access: fullAccess, project_ids: fullAccess ? null : projectIds } : {}),
      })
      onUpdated?.()
      onOpenChange(false)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !isSubmitting && onOpenChange(v)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {member?.username ?? "member"}</DialogTitle>
          <DialogDescription>
            Change their role, permissions, or which projects they can access.
          </DialogDescription>
        </DialogHeader>

        {member && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <MemberAccessFields
              workspaceId={workspaceId}
              role={role}
              onRoleChange={handleRoleChange}
              permissions={permissions}
              onPermissionsChange={setPermissions}
              fullAccess={fullAccess}
              onFullAccessChange={handleFullAccessChange}
              projectIds={projectIds}
              onProjectIdsChange={handleProjectIdsChange}
            />

            {!fullAccess && accessTouched && (
              <p className="text-xs text-muted-foreground">
                Only the projects checked above will remain accessible — this
                replaces their current project access.
              </p>
            )}

            {error && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                {error}
              </div>
            )}

            <DialogFooter>
              <Button type="submit" variant="brand" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        )}
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
