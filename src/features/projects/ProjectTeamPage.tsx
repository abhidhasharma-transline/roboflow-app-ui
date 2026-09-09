import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { Crown, ShieldCheck, UserX } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageLoader } from "@/components/shared/PageLoader"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SectionHeading } from "@/components/shared/SectionHeading"
import { initials, fullName, roleLabel } from "@/lib/userDisplay"
import { effectivePermissions, diffFromRoleDefaults, PERMISSION_KEYS, PERMISSION_LABELS } from "@/lib/permissions"
import {
  listProjectMembers,
  updateProjectMember,
  addProjectMember,
  removeProjectMember,
  transferProjectOwner,
} from "@/lib/projectApi"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useAuthStore } from "@/stores/authStore"
import { useToastStore } from "@/stores/toastStore"
import type { ProjectMember } from "@/types/project"
import type { WorkspaceRole } from "@/types/auth"

function extractErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const resp = (err as { response?: { data?: { detail?: unknown } } }).response
    const detail = resp?.data?.detail
    if (typeof detail === "string") return detail
  }
  return "Something went wrong — please try again."
}

export function ProjectTeamPage() {
  const { projectId } = useParams()
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const currentUser = useAuthStore((s) => s.user)
  const isSuperAdmin = currentUser?.role === "super_admin"
  const addToast = useToastStore((s) => s.addToast)

  const [members, setMembers] = useState<ProjectMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferTarget, setTransferTarget] = useState<string | null>(null)
  const [transferring, setTransferring] = useState(false)

  function refetch() {
    if (!workspaceId || !projectId) return
    setIsLoading(true)
    listProjectMembers(workspaceId, projectId)
      .then(setMembers)
      .finally(() => setIsLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refetch, [workspaceId, projectId])

  const owner = members.find((m) => m.is_owner)
  const canManageOwnership =
    isSuperAdmin || (owner !== undefined && owner.user_id === currentUser?.id)

  async function togglePermission(member: ProjectMember, key: string, value: boolean) {
    if (!workspaceId || !projectId) return
    const effective = effectivePermissions(member.role as WorkspaceRole, member.permission_overrides)
    const permissions = diffFromRoleDefaults(member.role as WorkspaceRole, { ...effective, [key]: value })
    try {
      // A member with only workspace-wide full project access is listed
      // here (see list_project_members's fallback) but has no real
      // ProjectAccess row yet — PATCHing one that doesn't exist 404s
      // ("Member not found on this project"). The first toggle for them
      // needs to create that row instead, exactly like adding an explicit
      // per-project override does.
      if (member.has_explicit_access) {
        await updateProjectMember(workspaceId, projectId, member.user_id, { permissions })
      } else {
        await addProjectMember(workspaceId, projectId, member.user_id, member.role, permissions)
      }
      refetch()
      addToast({ variant: "success", title: "Permission saved" })
    } catch (err) {
      addToast({ variant: "error", title: "Couldn't update permission", description: extractErrorMessage(err) })
    }
  }

  async function handleRemove(member: ProjectMember) {
    if (!workspaceId || !projectId) return
    try {
      await removeProjectMember(workspaceId, projectId, member.user_id)
      refetch()
    } catch (err) {
      addToast({ variant: "error", title: "Couldn't remove member", description: extractErrorMessage(err) })
    }
  }

  async function handleTransfer() {
    if (!workspaceId || !projectId || !transferTarget) return
    setTransferring(true)
    try {
      await transferProjectOwner(workspaceId, projectId, transferTarget)
      addToast({ variant: "success", title: "Ownership transferred" })
      setTransferOpen(false)
      setTransferTarget(null)
      refetch()
    } catch (err) {
      addToast({ variant: "error", title: "Couldn't transfer ownership", description: extractErrorMessage(err) })
    } finally {
      setTransferring(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <SectionHeading icon={ShieldCheck}>Team</SectionHeading>
        {canManageOwnership && members.length > 1 && (
          <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)}>
            <Crown className="size-3.5" />
            Transfer Ownership
          </Button>
        )}
      </div>

      {isLoading ? (
        <PageLoader />
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground">No members on this project yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {members.map((member) => {
            const isSelf = member.user_id === currentUser?.id
            const canSeeGrid = isSuperAdmin || isSelf
            // Nobody edits their own permissions — even a super admin — only
            // another admin/SA can revoke a permission for someone else.
            const canEditGrid = isSuperAdmin && !isSelf
            const effective = effectivePermissions(member.role as WorkspaceRole, member.permission_overrides)

            return (
              <div key={member.id} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-brand/15 text-xs text-brand">
                        {initials(member)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="flex items-center gap-1.5 font-medium text-foreground">
                        {fullName(member)}
                        {isSelf && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                        {member.is_owner && (
                          <Badge variant="secondary" className="gap-1 text-[11px]">
                            <Crown className="size-3" />
                            Owner
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {member.is_super_admin ? "Super Admin" : roleLabel(member.role)}
                    </Badge>
                    {isSuperAdmin && !member.is_owner && !isSelf && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemove(member)}
                        title="Remove from project"
                      >
                        <UserX className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {canSeeGrid && member.is_super_admin && (
                  <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                    {isSelf ? "You have" : "This member has"} full access across the entire system
                    as a super admin — project-level permissions don't apply{isSelf ? " to you" : ""}.
                  </p>
                )}

                {canSeeGrid && !member.is_super_admin && (
                  <div className="mt-3 grid grid-cols-1 gap-1.5 border-t border-border pt-3 sm:grid-cols-2">
                    {PERMISSION_KEYS.map((key) => (
                      <label key={key} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">{PERMISSION_LABELS[key]}</span>
                        <Switch
                          checked={effective[key]}
                          disabled={!canEditGrid || !effective[key]}
                          onCheckedChange={(v) => togglePermission(member, key, v)}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={transferOpen} onOpenChange={transferring ? undefined : setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer ownership</DialogTitle>
            <DialogDescription>
              Pick a member to become the new owner of this project. You can remove the current
              owner from the project only after the transfer completes.
            </DialogDescription>
          </DialogHeader>
          <Select value={transferTarget ?? undefined} onValueChange={setTransferTarget}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a member" />
            </SelectTrigger>
            <SelectContent>
              {members
                .filter((m) => !m.is_owner)
                .map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {fullName(m)} ({m.email})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)} disabled={transferring}>
              Cancel
            </Button>
            <Button variant="brand" onClick={handleTransfer} disabled={transferring || !transferTarget}>
              {transferring ? "Transferring…" : "Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
