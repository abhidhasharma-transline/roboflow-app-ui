import { useEffect, useMemo, useState } from "react"
import { Plus, Search, FolderPlus, UserPlus, ArrowUpDown } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ProjectCard } from "@/components/shared/ProjectCard"
import { FolderCard } from "./FolderCard"
import { CreateFolderDialog } from "./CreateFolderDialog"
import { CreateProjectDialog } from "./CreateProjectDialog"
import { InviteMemberDialog } from "@/features/workspace/InviteMemberDialog"
import { listProjects, listFolders } from "@/lib/projectApi"
import { getWorkspace, listWorkspaceMembers } from "@/lib/workspaceApi"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { initials } from "@/lib/userDisplay"
import type { Project, ProjectFolder } from "@/types/project"
import type { Workspace, WorkspaceMember } from "@/types/workspace"

type SortOrder = "newest" | "oldest" | "name"

export function ProjectsPage() {
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [folders, setFolders] = useState<ProjectFolder[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest")

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
    // TODO: once the backend supports an `ordering` query param, pass
    // sortOrder straight to listProjects() instead of sorting client-side.
  }, [projects, sortOrder])

  function refetch() {
    if (!workspaceId) return
    setIsLoading(true)
    Promise.all([
      getWorkspace(workspaceId),
      listWorkspaceMembers(workspaceId),
      listFolders(workspaceId),
      listProjects(workspaceId, { search: search || undefined }),
    ])
      .then(([ws, mem, fol, proj]) => {
        setWorkspace(ws)
        setMembers(mem)
        setFolders(fol)
        setProjects(proj)
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(refetch, [workspaceId])
  useEffect(() => {
    const id = setTimeout(refetch, 300) // debounce search
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  if (!workspaceId) {
    return (
      <div className="flex-1 p-8 text-sm text-muted-foreground">
        Loading your workspace…{" "}
        <Link to="/workspace" className="text-brand underline">
          Pick one manually
        </Link>{" "}
        if this doesn't resolve in a moment.
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">
          {workspace?.name ?? "Projects"}
        </h1>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {members.slice(0, 4).map((m) => (
              <Avatar key={m.id} className="size-8 border-2 border-background">
                <AvatarFallback className="bg-brand/15 text-xs text-brand">
                  {initials(m)}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          <Button variant="outline" onClick={() => setInviteDialogOpen(true)}>
            <UserPlus className="size-4" />
            Invite Team
          </Button>
        </div>
      </div>

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
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setFolderDialogOpen(true)}>
            <FolderPlus className="size-4" />
            New Folder
          </Button>
          <Button variant="brand" onClick={() => setProjectDialogOpen(true)}>
            <Plus className="size-4" />
            New Project
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          {folders.length > 0 && (
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {folders.map((folder) => (
                <FolderCard key={folder.id} folder={folder} />
              ))}
            </div>
          )}

          {projects.length === 0 && folders.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
              <p className="text-sm font-medium text-foreground">No projects yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first project to start uploading data.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {sortedProjects.map((project) => (
                <ProjectCard key={project.id} project={project} workspaceId={workspaceId} onChanged={refetch} />
              ))}
            </div>
          )}
        </>
      )}

      <CreateFolderDialog
        workspaceId={workspaceId}
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
        onCreated={(folder) => setFolders((prev) => [folder, ...prev])}
      />
      <CreateProjectDialog
        workspaceId={workspaceId}
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        onCreated={refetch}
      />
      <InviteMemberDialog
        workspaceId={workspaceId}
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onInvited={refetch}
      />
    </div>
  )
}
