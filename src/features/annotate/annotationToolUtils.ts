export function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max)
}

/** True while focus is in any text-entry field — inputs AND textareas (the
 *  comment box is a textarea, which `tagName === "INPUT"` alone never
 *  matches), plus contentEditable elements. Every global keyboard shortcut
 *  in AnnotationTool.tsx must check this first, or things like
 *  Space/Backspace/Ctrl+Z leak through while the user is just typing a
 *  comment. */
export function isTypingInField(): boolean {
  const el = document.activeElement as HTMLElement | null
  return el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || !!el?.isContentEditable
}
