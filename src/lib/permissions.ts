// Mirrors app/core/permissions.py — keep these two files in sync.
import type { WorkspaceRole } from "@/types/auth"
import { roleLabel } from "@/lib/userDisplay"

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

/** The sparse diff to actually persist as an override: only the keys where
 *  `edited` differs from the role's own defaults. Saving the full 8-key
 *  effective object instead (as if every key were customized) freezes
 *  every permission at its CURRENT value forever — including ones the
 *  person never touched — so a later role change (e.g. reviewer → labeler)
 *  has nothing left to apply defaults to, and the member keeps their old
 *  role's permissions under their new role. */
export function diffFromRoleDefaults(
  role: WorkspaceRole,
  edited: Record<PermissionKey, boolean>
): Record<string, boolean> {
  const defaults = ROLE_DEFAULT_PERMISSIONS[role]
  const diff: Record<string, boolean> = {}
  for (const key of PERMISSION_KEYS) {
    if (edited[key] !== defaults[key]) diff[key] = edited[key]
  }
  return diff
}

/** Just the permission keys that are `true`, in display order — for compact badge lists. */
export function grantedPermissions(
  role: WorkspaceRole,
  overrides: Record<string, boolean> | null | undefined
): PermissionKey[] {
  const effective = effectivePermissions(role, overrides)
  return PERMISSION_KEYS.filter((key) => effective[key])
}

/** A role's own display name, plus " + Reviewer"/" + Labeler" whenever an
 *  override has granted the OTHER role's core capability on top of this
 *  one — e.g. a Labeler who's had "Review Images" switched on for them
 *  still shows as "Labeler" everywhere else in the app (their role field
 *  genuinely didn't change), but without this they'd look like a plain
 *  Labeler even though they can now also review. Admin already has every
 *  permission by default, so there's never anything extra to add for it. */
export function roleBadgeLabel(
  role: WorkspaceRole,
  overrides: Record<string, boolean> | null | undefined
): string {
  const base = roleLabel(role)
  if (role === "admin") return base
  const effective = effectivePermissions(role, overrides)
  if (role === "labeler" && effective.review_images) return `${base} + Reviewer`
  if (role === "reviewer" && effective.annotate) return `${base} + Labeler`
  return base
}
