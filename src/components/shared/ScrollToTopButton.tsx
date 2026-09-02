import { useEffect, useState, type RefObject } from "react"
import { ArrowUp } from "lucide-react"

/**
 * These pages scroll their own root div (`overflow-y-auto`), not the window
 * — so a plain `window.scrollTo` back-to-top wouldn't do anything. Pass the
 * ref of that scrolling div; the button appears once it's scrolled down a
 * bit and scrolls it back to 0. Long lists (paginated batches/datasets/
 * versions with hundreds of items loaded via "Load more") are exactly where
 * this is needed — scrolling back up by hand gets tedious fast.
 */
export function ScrollToTopButton({ containerRef }: { containerRef: RefObject<HTMLElement | null> }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function onScroll() {
      setVisible((el as HTMLElement).scrollTop > 400)
    }
    el.addEventListener("scroll", onScroll)
    return () => el.removeEventListener("scroll", onScroll)
  }, [containerRef])

  if (!visible) return null

  return (
    <button
      onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
      title="Back to top"
      className="fixed right-6 bottom-6 z-40 flex size-10 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg transition-opacity hover:opacity-90"
    >
      <ArrowUp className="size-5" />
    </button>
  )
}
