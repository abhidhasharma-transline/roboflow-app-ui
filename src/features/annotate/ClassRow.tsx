import { useState } from "react"
import { Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ProjectClass } from "@/lib/classApi"

/** A class picked wrong while drawing (quick-create typo, wrong click) used
 *  to mean a trip to Classes & Tags to fix the name — renaming right here,
 *  next to the mistake, is a lot less friction. Click-to-edit, same pattern
 *  as ClassesTagsPage's InlineEditableName, but the row itself is also a
 *  click target (selects this as the active class), so the rename trigger
 *  has to be its own element with stopPropagation rather than reusing the
 *  row's own click. */
export function ClassRow({
  cls,
  count,
  active,
  muted,
  onSelect,
  onRename,
}: {
  cls: ProjectClass
  count?: number
  active: boolean
  muted?: boolean
  onSelect: () => void
  onRename: (name: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(cls.name)

  function commit() {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== cls.name) onRename(trimmed)
    else setDraft(cls.name)
  }

  return (
    <div
      onClick={editing ? undefined : onSelect}
      className={cn(
        "group flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-accent",
        active && "bg-accent",
        !editing && "cursor-pointer"
      )}
    >
      <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: cls.color }} />
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
            if (e.key === "Escape") {
              setDraft(cls.name)
              setEditing(false)
            }
          }}
          className="h-5 flex-1 rounded border border-border bg-background px-1 text-xs text-foreground outline-none"
        />
      ) : (
        <span className={cn("flex-1 truncate", muted ? "text-muted-foreground italic" : "text-foreground")}>
          {cls.name}
        </span>
      )}
      {count !== undefined && <span className="text-xs text-muted-foreground">{count}</span>}
      {!editing && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setDraft(cls.name)
            setEditing(true)
          }}
          title="Rename class"
          className="shrink-0 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
        >
          <Pencil className="size-3" />
        </button>
      )}
    </div>
  )
}
