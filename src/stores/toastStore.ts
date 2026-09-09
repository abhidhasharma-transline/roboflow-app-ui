import { create } from "zustand"

export interface ToastItem {
  id: string
  title: string
  description?: string
  /** "loading" is for a long-running action in progress (e.g. a download
   *  being prepared) — it never auto-dismisses on its own; the caller
   *  removes it (usually via removeToast, then adds a fresh success/error
   *  toast) once the action actually finishes. */
  variant: "success" | "error" | "loading"
  /** Optional inline action button (e.g. "Download") — rendered instead of
   *  auto-dismiss-only when present. Clicking it also dismisses the toast. */
  actionLabel?: string
  onAction?: () => void
}

interface ToastState {
  toasts: ToastItem[]
  addToast: (toast: Omit<ToastItem, "id">) => string
  removeToast: (id: string) => void
}

const TOAST_DURATION_MS = 6000
const TOAST_WITH_ACTION_DURATION_MS = 10000

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = crypto.randomUUID()
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
    if (toast.variant !== "loading") {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
      }, toast.actionLabel ? TOAST_WITH_ACTION_DURATION_MS : TOAST_DURATION_MS)
    }
    return id
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))
