import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useProjects } from "@/hooks/useProjects"
import { PERMISSION_KEYS, PERMISSION_LABELS, type PermissionKey } from "@/lib/permissions"
import type { WorkspaceRole } from "@/types/auth"

const ROLE_OPTIONS: { value: WorkspaceRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "labeler", label: "Labeler" },
  { value: "reviewer", label: "Reviewer" },
]

interface MemberAccessFieldsProps {
  workspaceId: string
  role: WorkspaceRole
  onRoleChange: (role: WorkspaceRole) => void
  permissions: Record<PermissionKey, boolean>
  onPermissionsChange: (permissions: Record<PermissionKey, boolean>) => void
  fullAccess: boolean
  onFullAccessChange: (fullAccess: boolean) => void
  projectIds: string[]
  onProjectIdsChange: (ids: string[]) => void
}

export function MemberAccessFields({
  workspaceId,
  role,
  onRoleChange,
  permissions,
  onPermissionsChange,
  fullAccess,
  onFullAccessChange,
  projectIds,
  onProjectIdsChange,
}: MemberAccessFieldsProps) {
  const { projects } = useProjects(workspaceId)

  function togglePermission(key: PermissionKey, value: boolean) {
    onPermissionsChange({ ...permissions, [key]: value })
  }

  function toggleProject(projectId: string, checked: boolean) {
    onProjectIdsChange(
      checked ? [...projectIds, projectId] : projectIds.filter((id) => id !== projectId)
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>Role</Label>
        <Select value={role} onValueChange={(v) => onRoleChange(v as WorkspaceRole)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Permissions</Label>
        <div className="grid grid-cols-1 gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
          {PERMISSION_KEYS.map((key) => (
            <label key={key} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-foreground">{PERMISSION_LABELS[key]}</span>
              <Switch
                checked={permissions[key]}
                onCheckedChange={(v) => togglePermission(key, v)}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-md border border-border p-3">
        <div>
          <p className="text-sm font-medium text-foreground">Full workspace access</p>
          <p className="text-xs text-muted-foreground">
            Access to every project in this workspace, including new ones.
          </p>
        </div>
        <Switch checked={fullAccess} onCheckedChange={onFullAccessChange} />
      </div>

      {!fullAccess && (
        <div className="flex flex-col gap-2">
          <Label>Projects</Label>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects in this workspace yet.</p>
          ) : (
            <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded-md border border-border p-3">
              {projects.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox
                    checked={projectIds.includes(p.id)}
                    onCheckedChange={(v) => toggleProject(p.id, v === true)}
                  />
                  {p.name}
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
