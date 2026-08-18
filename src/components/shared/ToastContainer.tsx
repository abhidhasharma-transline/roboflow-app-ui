import { CheckCircle2, XCircle, X } from "lucide-react"
import { useToastStore } from "@/stores/toastStore"

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const removeToast = useToastStore((s) => s.removeToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex w-72 items-start gap-2 rounded-lg border border-border bg-popover px-3.5 py-3 text-sm shadow-lg"
        >
          {t.variant === "success" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-500" />
          ) : (
            <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          )}
          <div className="flex-1 overflow-hidden">
            <p className="truncate font-medium text-popover-foreground">{t.title}</p>
            {t.description && (
              <p className="truncate text-xs text-muted-foreground">{t.description}</p>
            )}
          </div>
          <button
            onClick={() => removeToast(t.id)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
