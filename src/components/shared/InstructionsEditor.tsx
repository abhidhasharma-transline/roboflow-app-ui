import { useRef } from "react"
import {
  X, FileText,
  Bold, Italic, Strikethrough, Heading2, Minus, Link as LinkIcon, Quote, Code,
  MessageSquare, Image as ImageIcon, Table as TableIcon, List, ListOrdered, ListChecks, HelpCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"

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
      className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      disabled={!onClick}
    >
      <Icon className="size-3.5" />
    </button>
  )
}

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

  function wrapSelection(before: string, after: string = before) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const next = value.slice(0, start) + before + value.slice(start, end) + after + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + before.length, end + before.length)
    })
  }

  function prefixLines(prefix: string) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const lineStart = value.lastIndexOf("\n", start - 1) + 1
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + prefix.length, end + prefix.length)
    })
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
          <ToolbarButton icon={Heading2} title="Heading" onClick={() => prefixLines("## ")} />
          <div className="mx-1 h-4 w-px bg-border" />
          <ToolbarButton icon={Minus} title="Divider" />
          <ToolbarButton icon={LinkIcon} title="Link" />
          <ToolbarButton icon={Quote} title="Quote" onClick={() => prefixLines("> ")} />
          <ToolbarButton icon={Code} title="Code" onClick={() => wrapSelection("`")} />
          <ToolbarButton icon={MessageSquare} title="Comment" />
          <ToolbarButton icon={ImageIcon} title="Image" />
          <ToolbarButton icon={TableIcon} title="Table" />
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
