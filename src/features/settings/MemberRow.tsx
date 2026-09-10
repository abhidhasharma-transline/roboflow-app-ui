import { useState } from "react"
import { ChevronDown, ChevronRight, Plus, UserX } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { initials, roleLabel } from "@/lib/userDisplay"
import { effectivePermissions, diffFromRoleDefaults, roleBadgeLabel, PERMISSION_KEYS, PERMISSION_LABELS, type PermissionKey } from "@/lib/permissions"
import { getProjectColor } from "@/lib/projectColors"
import { updateProjectMember, addProjectMember } from "@/lib/projectApi"
import { updateWorkspaceMember, removeWorkspaceMember } from "@/lib/workspaceApi"
import { useToastStore } from "@/stores/toastStore"
import type { WorkspaceMember } from "@/types/workspace"
import type { WorkspaceRole } from "@/types/auth"
import type { Project } from "@/types/project"

function extractErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const resp = (err as { response?: { data?: { detail?: unknown } } }).response
    const detail = resp?.data?.detail
    if (typeof detail === "string") return detail
  }
  return "Something went wrong — please try again."
}

export interface ProjectOverride {
  project: Project
  role: WorkspaceRole
  permissions: Record<string, boolean> | null
  // False when this entry only exists because the member has workspace-wide
  // full project access — there's no real ProjectAccess row backing it, so
  // toggling a permission must POST a new override (isNew), not PATCH one
  // that doesn't exist yet.
  hasExplicitAccess: boolean
}

const ROLE_OPTIONS: WorkspaceRole[] = ["admin", "labeler", "reviewer"]

interface MemberRowProps {
  workspaceId: string
  member: WorkspaceMember
  overrides: ProjectOverride[]
  allProjects: Project[]
  canManage: boolean
  isSelf: boolean
  isOwner: boolean
  onRoleChange: (userId: string, role: WorkspaceRole) => void
  onRefetchOverrides: () => void
  onRefetchMembers: () => void
}

export function MemberRow({
  workspaceId,
  member,
  overrides,
  allProjects,
  canManage,
  isSelf,
  isOwner,
  onRoleChange,
  onRefetchOverrides,
  onRefetchMembers,
}: MemberRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [addingProjectId, setAddingProjectId] = useState<string | null>(null)
  const [draftPermissions, setDraftPermissions] = useState<Record<PermissionKey, boolean> | null>(null)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [removing, setRemoving] = useState(false)
  const addToast = useToastStore((s) => s.addToast)

  function cancelAdd() {
    setIsAdding(false)
    setAddingProjectId(null)
    setDraftPermissions(null)
  }

  const overriddenProjectIds = new Set(overrides.map((o) => o.project.id))
  const availableToAdd = allProjects.filter((p) => !overriddenProjectIds.has(p.id))

  // Extra capability granted on top of their actual role (e.g. a Labeler
  // whose "Review Images" was switched on) — see roleBadgeLabel for why
  // this doesn't just replace the role itself.
  const memberEffective = effectivePermissions(member.role, member.permission_overrides)
  const extraRole =
    member.role === "labeler" && memberEffective.review_images
      ? "Reviewer"
      : member.role === "reviewer" && memberEffective.annotate
        ? "Labeler"
        : null

  async function savePermissions(projectId: string, permissions: Record<string, boolean>, isNew: boolean) {
    try {
      if (isNew) {
        await addProjectMember(workspaceId, projectId, member.user_id, member.role, permissions)
      } else {
        await updateProjectMember(workspaceId, projectId, member.user_id, { permissions })
      }
      cancelAdd()
      onRefetchOverrides()
      addToast({ variant: "success", title: "Permission saved" })
    } catch (err) {
      addToast({ variant: "error", title: "Couldn't update permission", description: extractErrorMessage(err) })
      onRefetchOverrides()
    }
  }

  // Workspace-level permissions have no ceiling check (unlike a per-project
  // override, which can only ever turn something OFF relative to this) — a
  // super admin/owner can grant any permission to any role here without
  // promoting them. This is the only place that CAN grant something a
  // per-project override was rejected for.
  async function saveWorkspacePermission(key: PermissionKey, value: boolean) {
    const effective = effectivePermissions(member.role, member.permission_overrides)
    try {
      await updateWorkspaceMember(workspaceId, member.user_id, {
        permissions: diffFromRoleDefaults(member.role, { ...effective, [key]: value }),
      })
      onRefetchMembers()
      addToast({ variant: "success", title: "Permission saved" })
    } catch (err) {
      addToast({ variant: "error", title: "Couldn't update permission", description: extractErrorMessage(err) })
    }
  }

  async function handleRemove() {
    setRemoving(true)
    try {
      await removeWorkspaceMember(workspaceId, member.user_id)
      addToast({ variant: "success", title: "Member removed" })
      setRemoveOpen(false)
      onRefetchMembers()
    } catch (err) {
      addToast({ variant: "error", title: "Couldn't remove member", description: extractErrorMessage(err) })
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="border-b border-border py-3 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Toggle project overrides"
          >
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
          <Avatar className="size-7">
            <AvatarFallback className="bg-brand/15 text-xs text-brand">{initials(member)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-foreground">
              {member.username}
              {isSelf && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
            </p>
            <p className="text-xs text-muted-foreground">{member.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {overrides.length > 0 && (
            <div className="hidden flex-wrap items-center gap-1 sm:flex">
              {overrides.slice(0, 2).map((o) => {
                const color = getProjectColor(o.project.id)
                return (
                  <span
                    key={o.project.id}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${color.bg} ${color.text}`}
                  >
                    {o.project.name}
                  </span>
                )
              })}
              {overrides.length > 2 && (
                <Badge variant="outline" className="text-[11px]">
                  +{overrides.length - 2} more
                </Badge>
              )}
            </div>
          )}
          {!member.has_full_project_access && !member.is_super_admin && (
            <span className="text-xs text-muted-foreground">Limited access</span>
          )}

          {member.is_super_admin ? (
            <Badge variant="secondary">Super Admin</Badge>
          ) : canManage && !isSelf ? (
            <>
              {extraRole && (
                <Badge variant="outline" className="text-[11px]">
                  +{extraRole}
                </Badge>
              )}
              <Select value={member.role} onValueChange={(v) => onRoleChange(member.user_id, v as WorkspaceRole)}>
                <SelectTrigger className="h-8 w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {roleLabel(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : (
            <Badge variant="secondary">{roleBadgeLabel(member.role, member.permission_overrides)}</Badge>
          )}

          {canManage && !isSelf && !isOwner && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={() => setRemoveOpen(true)}
              title="Remove from workspace"
              aria-label={`Remove ${member.username} from workspace`}
            >
              <UserX className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 ml-8 flex flex-col gap-3 border-l border-border pl-4">
          {member.is_super_admin ? (
            <p className="text-xs text-muted-foreground">
              {isSelf ? "You have" : "This member has"} full access across the entire system as a
              super admin — workspace and project-level permissions don't apply
              {isSelf ? " to you" : ""}.
            </p>
          ) : (
            <>
              <div>
                <p className="mb-1.5 text-sm font-medium text-foreground">Workspace Permissions</p>
                <p className="mb-1.5 text-xs text-muted-foreground">
                  Applies everywhere they don't have a project-specific override below. Unlike a
                  project override, this can grant a permission beyond their role's defaults.
                </p>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {PERMISSION_KEYS.map((key) => {
                    const effective = effectivePermissions(member.role, member.permission_overrides)
                    return (
                      <label key={key} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">{PERMISSION_LABELS[key]}</span>
                        <Switch
                          disabled={!canManage || isSelf}
                          checked={effective[key]}
                          onCheckedChange={(v) => saveWorkspacePermission(key, v)}
                        />
                      </label>
                    )
                  })}
                </div>
              </div>

              {overrides.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No project-specific overrides — this member follows their workspace role/permissions
                  everywhere.
                </p>
              )}

              {overrides.map((o) => {
                const color = getProjectColor(o.project.id)
                return (
                  <div key={o.project.id}>
                    <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <span className={`size-2 rounded-full ${color.bg}`} />
                      {o.project.name}
                    </p>
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {PERMISSION_KEYS.map((key) => {
                        const effective = effectivePermissions(o.role, o.permissions)
                        return (
                          <label key={key} className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-muted-foreground">{PERMISSION_LABELS[key]}</span>
                            <Switch
                              disabled={!canManage || isSelf}
                              checked={effective[key]}
                              onCheckedChange={(v) =>
                                savePermissions(
                                  o.project.id,
                                  diffFromRoleDefaults(o.role, { ...effective, [key]: v }),
                                  !o.hasExplicitAccess
                                )
                              }
                            />
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {canManage && !isSelf && availableToAdd.length > 0 && (
                <div>
                  {isAdding ? (
                    <div>
                      <Select
                        value={addingProjectId ?? undefined}
                        onValueChange={(v) => {
                          setAddingProjectId(v)
                          setDraftPermissions(effectivePermissions(member.role, member.permission_overrides))
                        }}
                      >
                        <SelectTrigger className="mb-2 h-8 w-full">
                          <SelectValue placeholder="Choose a project" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableToAdd.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {addingProjectId && draftPermissions && (
                        <>
                          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                            {PERMISSION_KEYS.map((key) => (
                              <label key={key} className="flex items-center justify-between gap-2 text-xs">
                                <span className="text-muted-foreground">{PERMISSION_LABELS[key]}</span>
                                <Switch
                                  checked={draftPermissions[key]}
                                  onCheckedChange={(v) =>
                                    setDraftPermissions({ ...draftPermissions, [key]: v })
                                  }
                                />
                              </label>
                            ))}
                          </div>
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              variant="brand"
                              onClick={() =>
                                savePermissions(addingProjectId, diffFromRoleDefaults(member.role, draftPermissions), true)
                              }
                            >
                              Save override
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelAdd}>
                              Cancel
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsAdding(true)}
                      className="flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                    >
                      <Plus className="size-3.5" />
                      Add project-specific override
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {member.username} from this workspace?</DialogTitle>
            <DialogDescription>
              They'll lose access to every project in it. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveOpen(false)} disabled={removing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={removing}>
              {removing ? "Removing…" : "Remove member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
