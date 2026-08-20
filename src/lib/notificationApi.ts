import { api } from "@/lib/api"

export interface AppNotification {
  id: string
  workspace_id: string | null
  project_id: string | null
  entity_type: string | null
  entity_id: string | null
  title: string
  message: string | null
  is_read: boolean
  created_at: string
}

export async function listNotifications(unreadOnly = false): Promise<AppNotification[]> {
  const res = await api.get<AppNotification[]>("/users/me/notifications", {
    params: { unread_only: unreadOnly || undefined },
  })
  return res.data
}

export async function getUnreadCount(): Promise<number> {
  const res = await api.get<{ unread_count: number }>("/users/me/notifications/unread-count")
  return res.data.unread_count
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  const res = await api.post<AppNotification>(`/users/me/notifications/${id}/read`)
  return res.data
}

export async function markAllNotificationsRead(): Promise<{ updated: number }> {
  const res = await api.post<{ updated: number }>("/users/me/notifications/read-all")
  return res.data
}
