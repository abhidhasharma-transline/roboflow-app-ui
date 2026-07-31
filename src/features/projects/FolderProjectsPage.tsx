import { useEffect, useMemo, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { ArrowLeft, Plus, Search, ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { ProjectCard } from "@/components/shared/ProjectCard"
import { CreateProjectDialog } from "./CreateProjectDialog"
import { listProjects, getFolder } from "@/lib/projectApi"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import type { Project, ProjectFolder } from "@/types/project"

type SortOrder = "newest" | "oldest" | "name"

export function FolderProjectsPage() {
  const { folderId } = useParams<{ folderId: string }>()
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const [folder, setFolder] = useState<ProjectFolder | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest")
  const [dialogOpen, setDialogOpen] = useState(false)

  const sortedProjects = useMemo(() => {
    const sorted = [...projects]
    if (sortOrder === "newest") {
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    } else if (sortOrder === "oldest") {
      sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name))
    }
    return sorted
  }, [projects, sortOrder])

  function refetch() {
    if (!workspaceId || !folderId) return
    setIsLoading(true)
    Promise.all([
      getFolder(workspaceId, folderId),
      listProjects(workspaceId, { folderId, search: search || undefined }),
    ])
      .then(([fol, proj]) => {
        setFolder(fol)
        setProjects(proj)
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(refetch, [workspaceId, folderId])
  useEffect(() => {
    const id = setTimeout(refetch, 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  if (!workspaceId || !folderId) return null

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <Link
        to="/projects"
        className="mb-1 flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
      >
        <ArrowLeft className="size-3.5" />
        Projects
      </Link>
      <h1 className="mb-6 text-2xl font-semibold text-foreground">
        {folder?.name ?? "Folder"} Projects
      </h1>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative w-72">
            <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search projects"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
            <SelectTrigger className="w-44">
              <ArrowUpDown className="size-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="name">Name (A–Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="brand" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          New Project
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <p className="text-lg font-semibold text-foreground">
            There are no projects in this folder.
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Create a new project here to start labeling, training, and
            deploying your computer vision model.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/projects">
                <ArrowLeft className="size-4" />
                All Projects
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <CreateProjectDialog
        workspaceId={workspaceId}
        folderId={folderId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={refetch}
      />
    </div>
  )
}
