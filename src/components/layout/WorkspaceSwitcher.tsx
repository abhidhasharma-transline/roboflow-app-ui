import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronsUpDown, Check, Plus } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { listWorkspaces, getWorkspace } from "@/lib/workspaceApi"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useAuthStore } from "@/stores/authStore"
import type { Workspace } from "@/types/workspace"
import { CreateWorkspaceDialog } from "./CreateWorkspaceDialog"

export function WorkspaceSwitcher({ collapsed }: { collapsed?: boolean }) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { activeWorkspaceId, activeWorkspaceName, setActiveWorkspace } = useWorkspaceStore()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    // mineOnly: this is "your workspaces" — even a super admin should only
    // see workspaces they're actually a member of here, not every workspace
    // on the platform (that bypass is reserved for the admin-wide
    // /settings/workspaces panel).
    listWorkspaces({ mineOnly: true }).then(async (list) => {
      if (cancelled) return
      setWorkspaces(list) // show immediately with whatever data we have

      // The list endpoint doesn't always include `name` per item — backfill
      // it with the single-workspace GET (which does), in parallel, one
      // request per workspace missing a name. Fine for the small counts a
      // switcher realistically shows; drop this once the list endpoint
      // itself returns name (see backend note).
      const missing = list.filter((w) => !w.name)
      if (missing.length === 0) return

      const filled = await Promise.all(
        missing.map((w) => getWorkspace(w.id).catch(() => w))
      )
      if (cancelled) return
      setWorkspaces((prev) =>
        prev.map((w) => filled.find((f) => f.id === w.id) ?? w)
      )
    }).catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  // Belt-and-suspenders: if the store's cached name is missing for any
  // reason, fall back to whatever this component's own fetch found.
  const displayName =
    activeWorkspaceName ?? workspaces.find((w) => w.id === activeWorkspaceId)?.name ?? "Loading…"

  function selectWorkspace(ws: Workspace) {
    if (ws.id !== activeWorkspaceId) {
      setActiveWorkspace(ws.id, ws.name)
      navigate("/projects")
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {collapsed ? (
          <button
            className="flex size-9 items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-accent"
            title="Switch workspace"
          >
            <ChevronsUpDown className="size-4" />
          </button>
        ) : (
          <button className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-sidebar-accent">
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {displayName}
              </p>
            </div>
            <ChevronsUpDown className="size-4 shrink-0 text-sidebar-muted" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <p className="px-2 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Your workspaces
        </p>
        {workspaces.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">No workspaces yet</p>
        ) : (
          workspaces.map((ws) => (
            <DropdownMenuItem key={ws.id} onClick={() => selectWorkspace(ws)}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{ws.name ?? "Loading…"}</p>
                <p className="text-xs text-muted-foreground">
                  {ws.owner_id === user?.id ? "Owner" : "Shared with you"}
                </p>
              </div>
              {ws.id === activeWorkspaceId && <Check className="size-3.5 shrink-0 text-brand" />}
            </DropdownMenuItem>
          ))
        )}
        {user?.role === "super_admin" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" />
              Create Workspace
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>

      <CreateWorkspaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(ws) => {
          setWorkspaces((prev) => [...prev, ws])
          setActiveWorkspace(ws.id, ws.name)
          navigate("/projects")
        }}
      />
    </DropdownMenu>
  )
}
