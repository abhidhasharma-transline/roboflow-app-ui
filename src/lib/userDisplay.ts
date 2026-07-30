import type { User } from "@/types/auth"

export function fullName(user: Pick<User, "first_name" | "last_name" | "username">): string {
  const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
  return name || user.username
}

export function initials(user: Pick<User, "first_name" | "last_name" | "username">): string {
  const first = user.first_name?.[0]
  const last = user.last_name?.[0]
  if (first && last) return `${first}${last}`.toUpperCase()
  return user.username.slice(0, 2).toUpperCase()
}