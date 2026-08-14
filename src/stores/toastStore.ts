import { create } from "zustand"

export interface ToastItem {
  id: string
  title: string
  description?: string
  variant: "success" | "error"
}

interface ToastState {
  toasts: ToastItem[]
  addToast: (toast: Omit<ToastItem, "id">) => void
  removeToast: (id: string) => void
}

const TOAST_DURATION_MS = 4000

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = crypto.randomUUID()
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, TOAST_DURATION_MS)
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))
