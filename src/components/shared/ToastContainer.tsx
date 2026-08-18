import { CheckCircle2, XCircle, X } from "lucide-react"
import { useToastStore } from "@/stores/toastStore"

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const removeToast = useToastStore((s) => s.removeToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col-reverse gap-2.5">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex w-80 items-start gap-3 rounded-xl border border-border bg-popover p-3.5 shadow-xl shadow-black/10 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2"
        >
          <div
            className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
              t.variant === "success" ? "bg-green-500/15" : "bg-destructive/15"
            }`}
          >
            {t.variant === "success" ? (
              <CheckCircle2 className="size-4 text-green-500" />
            ) : (
              <XCircle className="size-4 text-destructive" />
            )}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm font-semibold text-popover-foreground">{t.title}</p>
            {t.description && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.description}</p>
            )}
            {t.actionLabel && t.onAction && (
              <button
                onClick={() => {
                  t.onAction?.()
                  removeToast(t.id)
                }}
                className="mt-2 rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-brand-foreground hover:bg-brand/90"
              >
                {t.actionLabel}
              </button>
            )}
          </div>
          <button
            onClick={() => removeToast(t.id)}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
