// Mirrors app/core/permissions.py — keep these two files in sync.
import type { WorkspaceRole } from "@/types/auth"

export const PERMISSION_KEYS = [
  "create_project",
  "create_batch",
  "label_images",
  "review_images",
  "delete_project",
  "invite_to_project",
  "annotate",
  "downgrade_roles",
] as const

export type PermissionKey = (typeof PERMISSION_KEYS)[number]

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  create_project: "Create Projects",
  create_batch: "Create Batches",
  label_images: "Label Images",
  review_images: "Review Images",
  delete_project: "Delete Projects",
  invite_to_project: "Invite to Projects",
  annotate: "Annotate",
  downgrade_roles: "Downgrade Member Roles",
}

const ADMIN_DEFAULTS: Record<PermissionKey, boolean> = Object.fromEntries(
  PERMISSION_KEYS.map((key) => [key, true])
) as Record<PermissionKey, boolean>

export const ROLE_DEFAULT_PERMISSIONS: Record<WorkspaceRole, Record<PermissionKey, boolean>> = {
  admin: ADMIN_DEFAULTS,
  labeler: {
    create_project: false,
    create_batch: false,
    label_images: true,
    review_images: false,
    delete_project: false,
    invite_to_project: false,
    annotate: true,
    downgrade_roles: false,
  },
  reviewer: {
    create_project: false,
    create_batch: false,
    label_images: false,
    review_images: true,
    delete_project: false,
    invite_to_project: false,
    annotate: false,
    downgrade_roles: false,
  },
}

/** Every permission is customizable for every role — this is just the starting point. */
export function effectivePermissions(
  role: WorkspaceRole,
  overrides: Record<string, boolean> | null | undefined
): Record<PermissionKey, boolean> {
  const defaults = ROLE_DEFAULT_PERMISSIONS[role]
  if (!overrides) return { ...defaults }
  return { ...defaults, ...overrides } as Record<PermissionKey, boolean>
}

/** Just the permission keys that are `true`, in display order — for compact badge lists. */
export function grantedPermissions(
  role: WorkspaceRole,
  overrides: Record<string, boolean> | null | undefined
): PermissionKey[] {
  const effective = effectivePermissions(role, overrides)
  return PERMISSION_KEYS.filter((key) => effective[key])
}
