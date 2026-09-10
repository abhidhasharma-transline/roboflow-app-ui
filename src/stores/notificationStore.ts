import { create } from "zustand"
import { getUnreadCount } from "@/lib/notificationApi"

interface NotificationState {
  unreadCount: number
  refetchUnreadCount: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  refetchUnreadCount: () => {
    getUnreadCount()
      .then((count) => set({ unreadCount: count }))
      .catch(() => {})
  },
}))
