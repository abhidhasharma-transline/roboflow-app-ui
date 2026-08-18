import { create } from "zustand"

export interface ToastItem {
  id: string
  title: string
  description?: string
  variant: "success" | "error"
  /** Optional inline action button (e.g. "Download") — rendered instead of
   *  auto-dismiss-only when present. Clicking it also dismisses the toast. */
  actionLabel?: string
  onAction?: () => void
}

interface ToastState {
  toasts: ToastItem[]
  addToast: (toast: Omit<ToastItem, "id">) => void
  removeToast: (id: string) => void
}

const TOAST_DURATION_MS = 6000
const TOAST_WITH_ACTION_DURATION_MS = 10000

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = crypto.randomUUID()
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, toast.actionLabel ? TOAST_WITH_ACTION_DURATION_MS : TOAST_DURATION_MS)
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))
