import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { ListChecks, Search, Plus, Trash2, Check, AlertTriangle, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useToastStore } from "@/stores/toastStore"
import { useProject } from "@/hooks/useProjects"
import {
  listClasses,
  createClass,
  updateClass,
  deleteClass,
  setClassesLocked,
  type ProjectClass,
} from "@/lib/classApi"
import { listTags, createTag, updateTag, deleteTag, type ImageTag } from "@/lib/tagApi"

const CLASS_COLORS = [
  "#FF3B3B", "#3B82F6", "#22C55E", "#F59E0B", "#A855F7", "#EC4899", "#14B8A6", "#F97316",
]

function InlineEditableName({
  value,
  onCommit,
}: {
  value: string
  onCommit: (next: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function commit() {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) onCommit(trimmed)
    else setDraft(value)
  }

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") {
            setDraft(value)
            setEditing(false)
          }
        }}
        className="h-7 max-w-56 text-sm"
      />
    )
  }

  return (
    <button
      onClick={() => {
        setDraft(value)
        setEditing(true)
      }}
      title="Click to rename"
      className="group flex items-center gap-1.5 rounded px-1 py-0.5 text-left text-sm text-foreground hover:bg-accent"
    >
      {value}
      <Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
    </button>
  )
}

function ColorSwatch({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <span
          className="block size-4 rounded-full ring-1 ring-black/10"
          style={{ backgroundColor: color }}
          title="Change color"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="flex w-auto flex-wrap gap-1.5 p-2">
        {CLASS_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className="flex size-6 items-center justify-center rounded-full ring-1 ring-black/10"
            style={{ backgroundColor: c }}
          >
            {c === color && <Check className="size-3.5 text-white" />}
          </button>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ClassesTagsPage() {
  const { projectId } = useParams()
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const addToast = useToastStore((s) => s.addToast)

  const { project, refetch: refetchProject } = useProject(projectId)

  const [tab, setTab] = useState<"classes" | "tags">("classes")
  const [classes, setClasses] = useState<ProjectClass[]>([])
  const [tags, setTags] = useState<ImageTag[]>([])
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [togglingLock, setTogglingLock] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState("")
  const [addColor, setAddColor] = useState(CLASS_COLORS[0])
  const [adding, setAdding] = useState(false)

  const [deleting, setDeleting] = useState(false)

  function refetch() {
    if (!workspaceId || !projectId) return
    listClasses(workspaceId, projectId).then(setClasses)
    listTags(workspaceId, projectId).then(setTags)
  }

  useEffect(refetch, [workspaceId, projectId])

  useEffect(() => setSelectedIds([]), [tab])

  const filteredClasses = useMemo(
    () => classes.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [classes, search]
  )
  const filteredTags = useMemo(
    () => tags.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())),
    [tags, search]
  )

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleToggleLock(next: boolean) {
    if (!workspaceId || !projectId || togglingLock) return
    setTogglingLock(true)
    try {
      await setClassesLocked(workspaceId, projectId, next)
      refetchProject()
    } catch {
      addToast({ variant: "error", title: "Couldn't update Lock Classes", description: "Please try again." })
    } finally {
      setTogglingLock(false)
    }
  }

  async function handleAdd() {
    if (!workspaceId || !projectId || !addName.trim()) return
    setAdding(true)
    try {
      if (tab === "classes") {
        await createClass(workspaceId, projectId, { name: addName.trim(), color: addColor })
      } else {
        await createTag(workspaceId, projectId, addName.trim())
      }
      setAddOpen(false)
      setAddName("")
      setAddColor(CLASS_COLORS[0])
      refetch()
    } catch {
      addToast({ variant: "error", title: `Couldn't create ${tab === "classes" ? "class" : "tag"}`, description: "Please try again." })
    } finally {
      setAdding(false)
    }
  }

  async function handleRenameClass(id: string, name: string) {
    if (!workspaceId || !projectId) return
    try {
      await updateClass(workspaceId, projectId, id, { name })
      refetch()
    } catch {
      addToast({ variant: "error", title: "Couldn't rename class", description: "Please try again." })
    }
  }

  async function handleRecolorClass(id: string, color: string) {
    if (!workspaceId || !projectId) return
    try {
      await updateClass(workspaceId, projectId, id, { color })
      refetch()
    } catch {
      addToast({ variant: "error", title: "Couldn't update color", description: "Please try again." })
    }
  }

  async function handleRenameTag(id: string, name: string) {
    if (!workspaceId || !projectId) return
    try {
      await updateTag(workspaceId, projectId, id, name)
      refetch()
    } catch {
      addToast({ variant: "error", title: "Couldn't rename tag", description: "Please try again." })
    }
  }

  async function handleDeleteSelected() {
    if (!workspaceId || !projectId || selectedIds.length === 0) return
    setDeleting(true)
    try {
      if (tab === "classes") {
        await Promise.all(selectedIds.map((id) => deleteClass(workspaceId, projectId, id)))
      } else {
        await Promise.all(selectedIds.map((id) => deleteTag(workspaceId, projectId, id)))
      }
      addToast({ variant: "success", title: `${selectedIds.length} deleted` })
      setSelectedIds([])
      refetch()
    } catch {
      addToast({ variant: "error", title: "Couldn't delete some rows", description: "Please try again." })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <h1 className="mb-4 flex items-center gap-2.5 text-2xl font-semibold text-foreground">
        <ListChecks className="size-6" />
        Classes & Tags
      </h1>

      <div className="mb-5 flex items-center gap-6 border-b border-border">
        <button
          onClick={() => setTab("classes")}
          className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
            tab === "classes" ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Classes
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{classes.length}</span>
        </button>
        <button
          onClick={() => setTab("tags")}
          className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
            tab === "tags" ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Tags
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{tags.length}</span>
        </button>
      </div>

      {project?.classes_locked && tab === "classes" && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="size-4 shrink-0" />
          Annotation classes in the Annotation tool are locked to the existing classes listed below.
        </div>
      )}

      <div className="mb-4 flex items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${tab}…`}
            className="h-9 pl-8"
          />
        </div>
        <Button variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          Add
        </Button>
        {tab === "classes" && (
          <label className="ml-2 flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={project?.classes_locked ?? false}
              onCheckedChange={(v) => handleToggleLock(v === true)}
              disabled={togglingLock || !project}
            />
            Lock Classes
          </label>
        )}

        {selectedIds.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto text-destructive hover:text-destructive"
            onClick={handleDeleteSelected}
            disabled={deleting}
          >
            <Trash2 className="size-3.5" />
            {deleting ? "Deleting…" : `Delete ${selectedIds.length} Selected`}
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground uppercase">
            <tr>
              {tab === "classes" && <th className="w-16 px-4 py-2.5 text-left font-medium">Color</th>}
              <th className="px-4 py-2.5 text-left font-medium">{tab === "classes" ? "Class Name" : "Tag Name"}</th>
              <th className="w-24 px-4 py-2.5 text-left font-medium">Count</th>
              <th className="w-20 px-4 py-2.5 text-right font-medium">Modify</th>
            </tr>
          </thead>
          <tbody>
            {tab === "classes" ? (
              filteredClasses.length === 0 ? (
                <tr><td colSpan={4} className="py-10 text-center text-muted-foreground">No classes yet.</td></tr>
              ) : (
                filteredClasses.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-2">
                      <ColorSwatch color={c.color} onChange={(color) => handleRecolorClass(c.id, color)} />
                    </td>
                    <td className="px-4 py-2">
                      <InlineEditableName value={c.name} onCommit={(name) => handleRenameClass(c.id, name)} />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{c.annotation_count}</td>
                    <td className="px-4 py-2 text-right">
                      <Checkbox checked={selectedIds.includes(c.id)} onCheckedChange={() => toggleSelect(c.id)} />
                    </td>
                  </tr>
                ))
              )
            ) : filteredTags.length === 0 ? (
              <tr><td colSpan={3} className="py-10 text-center text-muted-foreground">No tags yet.</td></tr>
            ) : (
              filteredTags.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-2">
                    <InlineEditableName value={t.name} onCommit={(name) => handleRenameTag(t.id, name)} />
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{t.image_count}</td>
                  <td className="px-4 py-2 text-right">
                    <Checkbox checked={selectedIds.includes(t.id)} onCheckedChange={() => toggleSelect(t.id)} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={addOpen} onOpenChange={adding ? undefined : setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add {tab === "classes" ? "class" : "tag"}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd()
            }}
            placeholder={tab === "classes" ? "Class name" : "Tag name"}
          />
          {tab === "classes" && (
            <div className="flex flex-wrap gap-2">
              {CLASS_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setAddColor(c)}
                  className="flex size-7 items-center justify-center rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: c }}
                >
                  {c === addColor && <Check className="size-4 text-white" />}
                </button>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={adding}>
              Cancel
            </Button>
            <Button variant="brand" onClick={handleAdd} disabled={adding || !addName.trim()}>
              {adding ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
