import { useRef } from "react"
import {
  X, FileText,
  Bold, Italic, Strikethrough, Heading2, Minus, Link as LinkIcon, Quote, Code,
  MessageSquare, Image as ImageIcon, Table as TableIcon, List, ListOrdered, ListChecks, HelpCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

const TOOLBAR_BUTTON_CLASS =
  "flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"

function ToolbarButton({
  icon: Icon,
  onClick,
  title,
}: {
  icon: typeof Bold
  onClick?: () => void
  title: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={TOOLBAR_BUTTON_CLASS}
      disabled={!onClick}
    >
      <Icon className="size-3.5" />
    </button>
  )
}

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6]

interface InstructionsEditorProps {
  value: string
  onChange: (value: string) => void
  onClose: () => void
  onSave: () => void
  saving?: boolean
}

/** Matches the "Labeling Instructions" card used across the assign/reassign
 * and job-detail flows — a lightweight toolbar that inserts markdown syntax
 * into the textarea (no WYSIWYG rendering; visual match only, by design). */
export function InstructionsEditor({ value, onChange, onClose, onSave, saving }: InstructionsEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  /** The word (non-whitespace run) touching a cursor position, if any —
   *  shared by the inline-wrap toggle and the code button's inline-vs-block
   *  decision. */
  function wordRangeAt(pos: number): [number, number] {
    const isWordChar = (c: string) => !!c && !/\s/.test(c)
    let start = pos
    while (start > 0 && isWordChar(value[start - 1])) start--
    let end = pos
    while (end < value.length && isWordChar(value[end])) end++
    return [start, end]
  }

  /** Toggle: click once to wrap the selection, click again (with the same
   *  spot selected) to unwrap it — either because the markers sit just
   *  outside the current selection (the common case, since we leave the
   *  selection on the inner text after wrapping) or because the user
   *  selected the markers themselves. */
  function wrapSelection(marker: string, after: string = marker) {
    const el = textareaRef.current
    if (!el) return
    let start = el.selectionStart
    let end = el.selectionEnd

    // Nothing selected — wrap whichever word the cursor is touching (typed
    // text right before/after it) instead of dropping empty markers.
    if (start === end) {
      const [wordStart, wordEnd] = wordRangeAt(start)
      if (wordStart < wordEnd) {
        start = wordStart
        end = wordEnd
      }
    }

    const before = value.slice(0, start)
    const selected = value.slice(start, end)
    const afterText = value.slice(end)

    if (before.endsWith(marker) && afterText.startsWith(after)) {
      const next = before.slice(0, before.length - marker.length) + selected + afterText.slice(after.length)
      onChange(next)
      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(start - marker.length, end - marker.length)
      })
      return
    }

    if (selected.length >= marker.length + after.length && selected.startsWith(marker) && selected.endsWith(after)) {
      const inner = selected.slice(marker.length, selected.length - after.length)
      onChange(before + inner + afterText)
      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(start, end - marker.length - after.length)
      })
      return
    }

    onChange(before + marker + selected + after + afterText)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + marker.length, end + marker.length)
    })
  }

  /** Toggle: click once to prefix the current line, click again to remove
   *  the same prefix if it's already there. */
  function prefixLines(prefix: string) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const lineStart = value.lastIndexOf("\n", start - 1) + 1

    if (value.slice(lineStart, lineStart + prefix.length) === prefix) {
      const next = value.slice(0, lineStart) + value.slice(lineStart + prefix.length)
      onChange(next)
      requestAnimationFrame(() => {
        el.focus()
        const newStart = Math.max(lineStart, start - prefix.length)
        const newEnd = Math.max(lineStart, end - prefix.length)
        el.setSelectionRange(newStart, newEnd)
      })
      return
    }

    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + prefix.length, end + prefix.length)
    })
  }

  /** Heading dropdown: picking a level toggles it off if the line is
   *  already at that level, swaps the level in place if it's at a
   *  different one, or adds it fresh — never stacks multiple "#" prefixes
   *  from repeated clicks. */
  function setHeading(level: number) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const lineStart = value.lastIndexOf("\n", start - 1) + 1
    const match = value.slice(lineStart).match(/^(#{1,6}) /)
    const newPrefix = "#".repeat(level) + " "

    if (match && match[1].length === level) {
      const next = value.slice(0, lineStart) + value.slice(lineStart + match[0].length)
      onChange(next)
      requestAnimationFrame(() => {
        el.focus()
        const shift = match[0].length
        el.setSelectionRange(Math.max(lineStart, start - shift), Math.max(lineStart, end - shift))
      })
      return
    }

    const oldLength = match ? match[0].length : 0
    const next = value.slice(0, lineStart) + newPrefix + value.slice(lineStart + oldLength)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      const delta = newPrefix.length - oldLength
      el.setSelectionRange(start + delta, end + delta)
    })
  }

  /** Inserts on its own paragraph, matching how these render as markdown. */
  function insertBlock(build: (prefix: string) => string, cursorOffsetIn: (prefix: string) => number) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const before = value.slice(0, start)
    const prefix = before.length === 0 || before.endsWith("\n") ? "" : "\n"
    const snippet = build(prefix)
    onChange(before + snippet + value.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      const pos = before.length + cursorOffsetIn(prefix)
      el.setSelectionRange(pos, pos)
    })
  }

  function insertDivider() {
    insertBlock((prefix) => `${prefix}\n---\n`, (prefix) => prefix.length + 4)
  }

  function insertTable() {
    insertBlock(
      (prefix) => `${prefix}\n| Header | Header |\n| --- | --- |\n| Cell | Cell |\n| Cell | Cell |\n`,
      (prefix) => prefix.length + 1 + "| Header | Header |\n| --- | --- |\n| Cell | Cell |\n| Cell | Cell |\n".length
    )
  }

  function insertComment() {
    insertBlock((prefix) => `${prefix}<!--  -->`, (prefix) => prefix.length + 5)
  }

  function insertLink() {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const label = value.slice(start, end) || "title"
    const snippet = `[${label}](url)`
    onChange(value.slice(0, start) + snippet + value.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + 1, start + 1 + label.length)
    })
  }

  /** Code button: wraps a selected/adjacent word inline (toggle, like
   *  Bold/Italic), but with no word to wrap — an empty line — drops a
   *  fenced code block with the cursor ready on the middle line instead of
   *  the useless empty double-backtick the plain wrap would leave. */
  function insertCode() {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    if (start !== end || wordRangeAt(start)[0] < wordRangeAt(start)[1]) {
      wrapSelection("`")
      return
    }
    insertBlock((prefix) => `${prefix}\`\`\`\n\n\`\`\`\n`, (prefix) => prefix.length + 4)
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted/20">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <FileText className="size-3.5" />
          Labeling Instructions
        </p>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="size-3.5" />
        </button>
      </div>

      <p className="px-3 pt-2.5 text-xs text-muted-foreground">
        Add optional labeling instructions for your team members.
      </p>

      <div className="mx-3 mt-2.5 rounded-md border border-border bg-background">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1">
          <ToolbarButton icon={Bold} title="Bold" onClick={() => wrapSelection("**")} />
          <ToolbarButton icon={Italic} title="Italic" onClick={() => wrapSelection("*")} />
          <ToolbarButton icon={Strikethrough} title="Strikethrough" onClick={() => wrapSelection("~~")} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" title="Heading" className={TOOLBAR_BUTTON_CLASS}>
                <Heading2 className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {HEADING_LEVELS.map((level) => (
                <DropdownMenuItem key={level} onClick={() => setHeading(level)}>
                  Heading {level}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="mx-1 h-4 w-px bg-border" />
          <ToolbarButton icon={Minus} title="Divider" onClick={insertDivider} />
          <ToolbarButton icon={LinkIcon} title="Link" onClick={insertLink} />
          <ToolbarButton icon={Quote} title="Quote" onClick={() => prefixLines("> ")} />
          <ToolbarButton icon={Code} title="Code" onClick={insertCode} />
          <ToolbarButton icon={MessageSquare} title="Comment" onClick={insertComment} />
          <ToolbarButton icon={ImageIcon} title="Image" />
          <ToolbarButton icon={TableIcon} title="Table" onClick={insertTable} />
          <div className="mx-1 h-4 w-px bg-border" />
          <ToolbarButton icon={List} title="Bullet list" onClick={() => prefixLines("- ")} />
          <ToolbarButton icon={ListOrdered} title="Numbered list" onClick={() => prefixLines("1. ")} />
          <ToolbarButton icon={ListChecks} title="Checklist" onClick={() => prefixLines("- [ ] ")} />
          <ToolbarButton icon={HelpCircle} title="Formatting help" />
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-32 w-full resize-y p-2.5 text-sm outline-none"
        />
      </div>

      <div className="p-3 pt-2.5">
        <Button type="button" variant="brand" className="w-full" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save Instructions"}
        </Button>
      </div>
    </div>
  )
}
