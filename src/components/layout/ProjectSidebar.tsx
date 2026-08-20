import { useEffect, useState } from "react"
import { useParams, Link, useNavigate, useLocation } from "react-router-dom"
import { GuardedNavLink as NavLink } from "./GuardedNavLink"
import {
  ArrowLeft,
  ChevronDown,
  Upload,
  Image as ImageIcon,
  Database,
  Layers,
  HeartPulse,
  Tags,
  Share2,
  Grid3x3,
  Wand2,
  ListChecks,
  MoreVertical,
  Copy,
  Pencil,
  Trash2,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useProject } from "@/hooks/useProjects"
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { renameProject, deleteProject } from "@/lib/projectApi"
import { listProjectImages } from "@/lib/imageApi"

interface SubNavItem {
  label: string
  icon: typeof Upload
  path?: string
  badge?: number
  /** Not wired up to a backend yet — visible but non-interactive. */
  disabled?: boolean
}

export function ProjectSidebar() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const { project, refetch } = useProject(projectId)
  const { name: workspaceName } = useActiveWorkspace()
  const [dataOpen, setDataOpen] = useState(true)
  const [modelsOpen, setModelsOpen] = useState(true)
  const [datasetCount, setDatasetCount] = useState<number | undefined>(undefined)

  // The sidebar stays mounted across every page in a project, so this can't
  // just fetch once on mount — it'd go stale the moment a dataset-changing
  // action happens on whatever page you're on (add-to-dataset, assign for
  // labeling, mark null, delete...). Re-run on every navigation instead.
  useEffect(() => {
    if (!workspaceId || !projectId) return
    listProjectImages(workspaceId, projectId, { status: "dataset", limit: 1 })
      .then((res) => setDatasetCount(res.total))
      .catch(() => setDatasetCount(undefined))
  }, [workspaceId, projectId, location.key])

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState("")
  const [renameSaving, setRenameSaving] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function openRename() {
    setRenameValue(project?.name ?? "")
    setRenameError(null)
    setRenameOpen(true)
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (!workspaceId || !projectId || !renameValue.trim()) return
    setRenameSaving(true)
    setRenameError(null)
    try {
      await renameProject(workspaceId, projectId, renameValue.trim())
      refetch()
      setRenameOpen(false)
    } catch (err) {
      setRenameError(extractErrorMessage(err))
    } finally {
      setRenameSaving(false)
    }
  }

  async function handleDelete() {
    if (!workspaceId || !projectId) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteProject(workspaceId, projectId)
      navigate("/projects")
    } catch (err) {
      setDeleteError(extractErrorMessage(err))
      setDeleting(false)
    }
  }

  const dataItems: SubNavItem[] = [
    { label: "Upload Data", icon: Upload, path: `/projects/${projectId}/upload` },
    { label: "Annotate", icon: ImageIcon, path: `/projects/${projectId}/annotate` },
    {
      label: "Dataset",
      icon: Database,
      path: `/projects/${projectId}/dataset`,
      badge: datasetCount,
    },
    { label: "Versions", icon: Layers, path: `/projects/${projectId}/versions` },
    { label: "Analytics", icon: HeartPulse, disabled: true },
    { label: "Classes & Tags", icon: Tags, path: `/projects/${projectId}/classes` },
    { label: "Team", icon: Users, path: `/projects/${projectId}/team` },
  ]

  const modelItems: SubNavItem[] = [
    { label: "Train", icon: Share2, path: `/projects/${projectId}/train` },
    { label: "Models", icon: Grid3x3, disabled: true },
    { label: "NAS", icon: Wand2, disabled: true },
    { label: "Test", icon: ListChecks, disabled: true },
  ]

  return (
    <>
    <aside className="flex h-full w-56 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar">
      <div className="p-3 pb-2">
        <Link
          to="/projects"
          className="mb-3 flex items-center gap-1 text-xs font-medium tracking-wide text-sidebar-muted uppercase hover:text-sidebar-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {workspaceName ?? "Workspace"}
        </Link>

        <div className="mb-2 overflow-hidden rounded-md border border-sidebar-border">
          {project?.thumbnail_url ? (
            <img
              src={project.thumbnail_url}
              alt={project.name}
              className="aspect-video w-full object-cover"
            />
          ) : (
            <div className="flex aspect-video items-center justify-center bg-muted">
              <ImageIcon className="size-6 text-muted-foreground/40" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-sidebar-foreground">
            {project?.name ?? "Loading…"}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger className="shrink-0 rounded p-0.5 text-sidebar-muted hover:bg-sidebar-accent">
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => projectId && navigator.clipboard.writeText(projectId)}
              >
                <Copy className="size-4" />
                Copy Project ID
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openRename}>
                <Pencil className="size-4" />
                Rename Project
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                variant="destructive"
              >
                <Trash2 className="size-4" />
                Move to Trash
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mx-3 my-1 h-px bg-sidebar-border" />

      {/* DATA section */}
      <div className="px-3 py-1">
        <button
          onClick={() => setDataOpen((v) => !v)}
          className="flex w-full items-center justify-between px-0.5 py-1.5 text-[11px] font-semibold tracking-wide text-sidebar-muted uppercase"
        >
          Data
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              !dataOpen && "-rotate-90"
            )}
          />
        </button>
        {dataOpen && (
          <nav className="flex flex-col gap-0.5 pt-0.5">
            {dataItems.map((item) => (
              <SubNavLink key={item.label} item={item} />
            ))}
          </nav>
        )}
      </div>

      {/* MODELS section */}
      <div className="px-3 py-1">
        <button
          onClick={() => setModelsOpen((v) => !v)}
          className="flex w-full items-center justify-between px-0.5 py-1.5 text-[11px] font-semibold tracking-wide text-sidebar-muted uppercase"
        >
          Models
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              !modelsOpen && "-rotate-90"
            )}
          />
        </button>
        {modelsOpen && (
          <nav className="flex flex-col gap-0.5 pt-0.5">
            {modelItems.map((item) => (
              <SubNavLink key={item.label} item={item} />
            ))}
          </nav>
        )}
      </div>
    </aside>

    <Dialog open={renameOpen} onOpenChange={renameSaving ? undefined : setRenameOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename project</DialogTitle>
          <DialogDescription>Choose a new name for this project.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleRename} className="flex flex-col gap-4">
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
            required
          />
          {renameError && <p className="text-sm text-destructive">{renameError}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenameOpen(false)}
              disabled={renameSaving}
            >
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={renameSaving || !renameValue.trim()}>
              {renameSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={deleteOpen} onOpenChange={deleting ? undefined : setDeleteOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move "{project?.name}" to trash?</DialogTitle>
          <DialogDescription>
            This removes the project from your workspace. This can't be undone from here.
          </DialogDescription>
        </DialogHeader>
        {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Moving…" : "Move to Trash"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

function SubNavLink({ item }: { item: SubNavItem }) {
  if (item.disabled || !item.path) {
    return (
      <span
        className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-muted/50"
        aria-disabled
        title="Not wired up yet"
      >
        <item.icon className="size-4" />
        <span className="flex-1">{item.label}</span>
        {item.badge !== undefined && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
            {item.badge}
          </span>
        )}
      </span>
    )
  }

  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent",
          isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
        )
      }
    >
      <item.icon className="size-4" />
      <span className="flex-1">{item.label}</span>
      {item.badge !== undefined && (
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
          {item.badge}
        </span>
      )}
    </NavLink>
  )
}

function extractErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const resp = (err as { response?: { data?: { detail?: unknown } } }).response
    const detail = resp?.data?.detail
    if (typeof detail === "string") return detail
  }
  return "Something went wrong — please try again."
}
