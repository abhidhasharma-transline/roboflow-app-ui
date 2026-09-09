import { Loader2 } from "lucide-react"

/** Matches the spinner already used in the "loading" toast variant
 *  (ToastContainer.tsx) — same icon, same brand color — so a page waiting
 *  on its first fetch reads as the same "working on it" state as
 *  everything else in the app, not a plain word sitting on a blank page.
 *  `fill` is for a whole page/panel's only content (needs a flex parent to
 *  actually fill); `section` (default) is for a loading state that's one
 *  child among others further down the same view. */
export function PageLoader({ variant = "section" }: { variant?: "section" | "fill" }) {
  return (
    <div className={variant === "fill" ? "flex flex-1 items-center justify-center" : "flex items-center justify-center py-12"}>
      <Loader2 className="size-6 animate-spin text-brand" />
    </div>
  )
}
