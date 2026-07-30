import { useState } from "react"
import { NavLink, useParams, Link } from "react-router-dom"
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useProject } from "@/hooks/useProjects"
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace"

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
  const { project } = useProject(projectId)
  const { name: workspaceName } = useActiveWorkspace()
  const [dataOpen, setDataOpen] = useState(true)
  const [modelsOpen, setModelsOpen] = useState(true)

  const dataItems: SubNavItem[] = [
    { label: "Upload Data", icon: Upload, path: `/projects/${projectId}/upload` },
    { label: "Annotate", icon: ImageIcon, disabled: true },
    {
      label: "Dataset",
      icon: Database,
      disabled: true,
    },
    { label: "Versions", icon: Layers, disabled: true },
    { label: "Analytics", icon: HeartPulse, disabled: true },
    { label: "Classes & Tags", icon: Tags, disabled: true },
  ]

  const modelItems: SubNavItem[] = [
    { label: "Train", icon: Share2, path: `/projects/${projectId}/train` },
    { label: "Models", icon: Grid3x3, disabled: true },
    { label: "NAS", icon: Wand2, disabled: true },
    { label: "Test", icon: ListChecks, disabled: true },
  ]

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar">
      <div className="p-3 pb-2">
        <Link
          to="/projects"
          className="mb-3 flex items-center gap-1 text-xs font-medium tracking-wide text-sidebar-muted uppercase hover:text-sidebar-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {workspaceName ?? "Workspace"}
        </Link>

        <div className="mb-2 overflow-hidden rounded-md border border-sidebar-border">
          <div className="flex aspect-video items-center justify-center bg-muted">
            <ImageIcon className="size-6 text-muted-foreground/40" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-sidebar-foreground">
            {project?.name ?? "Loading…"}
          </p>
          <button className="shrink-0 rounded p-0.5 text-sidebar-muted hover:bg-sidebar-accent">
            <MoreVertical className="size-4" />
          </button>
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