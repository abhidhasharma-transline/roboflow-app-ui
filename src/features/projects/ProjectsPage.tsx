import { Plus, Search, FolderPlus, ArrowUpDown, UserPlus } from "lucide-react"
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
import { useProjects } from "@/hooks/useProjects"
import { useWorkspaceStore } from "@/stores/workspaceStore"

export function ProjectsPage() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const { projects, isLoading } = useProjects(activeWorkspaceId ?? "ws1")

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">mohan</h1>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <Avatar className="size-8 border-2 border-background">
              <AvatarFallback className="bg-brand/15 text-xs text-brand">
                AS
              </AvatarFallback>
            </Avatar>
            <Avatar className="size-8 border-2 border-background">
              <AvatarFallback className="bg-muted text-xs">MO</AvatarFallback>
            </Avatar>
          </div>
          <Button variant="outline">
            <UserPlus className="size-4" />
            Invite Team
          </Button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative w-72">
            <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input placeholder="Search projects" className="pl-8" />
          </div>
          <Select defaultValue="edited">
            <SelectTrigger className="w-44">
              <span className="text-muted-foreground">Sort:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="edited">Date Edited</SelectItem>
              <SelectItem value="created">Date Created</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon">
            <ArrowUpDown className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <FolderPlus className="size-4" />
            New Folder
          </Button>
          <Button variant="brand">
            <Plus className="size-4" />
            New Project
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading projects…</p>
      ) : projects.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
          <p className="text-sm font-medium text-foreground">No projects yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first project to start uploading data.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}