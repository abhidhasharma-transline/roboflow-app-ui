import { NavLink, useParams } from "react-router-dom"
import {
  LayoutGrid,
  FolderKanban,
  UploadCloud,
  PencilRuler,
  Database,
  GitBranch,
  Settings,
  ChevronsUpDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

const projectNavItems = [
  { label: "Upload", icon: UploadCloud, path: "upload" },
  { label: "Annotate", icon: PencilRuler, path: "annotate" },
  { label: "Dataset", icon: Database, path: "dataset" },
  { label: "Versions", icon: GitBranch, path: "versions" },
]

export function Sidebar() {
  const { projectId } = useParams()

  return (
    <aside className="bg-sidebar text-sidebar-foreground flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border">
      {/* Workspace switcher */}
      <div className="border-b border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-sidebar-accent">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand text-sm font-semibold text-brand-foreground">
              A
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">Acme Robotics</p>
              <p className="truncate text-xs text-sidebar-muted">Enterprise</p>
            </div>
            <ChevronsUpDown className="size-4 text-sidebar-muted" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem>Acme Robotics</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Create workspace</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Top-level nav */}
      <nav className="flex flex-col gap-0.5 p-3">
        <NavLink
          to="/workspace"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
            )
          }
        >
          <LayoutGrid className="size-4" />
          Workspace
        </NavLink>
        <NavLink
          to="/projects"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
            )
          }
        >
          <FolderKanban className="size-4" />
          Projects
        </NavLink>
      </nav>

      {/* Project-scoped nav — only shown when inside a project */}
      {projectId && (
        <>
          <div className="mx-3 my-1 h-px bg-sidebar-border" />
          <p className="px-5 pt-2 pb-1 text-[11px] font-medium tracking-wide text-sidebar-muted uppercase">
            Project
          </p>
          <nav className="flex flex-col gap-0.5 p-3 pt-0">
            {projectNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={`/projects/${projectId}/${item.path}`}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isActive &&
                      "bg-sidebar-accent text-sidebar-accent-foreground"
                  )
                }
              >
                <item.icon className="size-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </>
      )}

      <div className="mt-auto p-3">
        <NavLink
          to="/settings"
          className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Settings className="size-4" />
          Settings
        </NavLink>
      </div>
    </aside>
  )
}
