/** Deliberately looser than User itself — WorkspaceMember only optionally
 *  carries first_name/last_name (until the backend's members-list endpoint
 *  adds them), so both types need to satisfy this. */
interface NameLike {
  first_name?: string
  last_name?: string
  username: string
}

export function fullName(user: NameLike): string {
  const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
  return name || user.username
}

export function initials(user: NameLike): string {
  const first = user.first_name?.[0]
  const last = user.last_name?.[0]
  if (first && last) return `${first}${last}`.toUpperCase()
  return user.username.slice(0, 2).toUpperCase()
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  labeler: "Labeler",
  reviewer: "Reviewer",
}

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "Member"
  return ROLE_LABELS[role] ?? role
}
