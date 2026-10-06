import { create } from "zustand"

interface WorkspaceState {
  activeWorkspaceId: string | null
  activeWorkspaceName: string | null
  activeProjectId: string | null
  setActiveWorkspace: (id: string, name?: string) => void
  setActiveProject: (id: string) => void
  /** Clears the active workspace/project — called on logout (see authStore)
   *  so the next login starts clean. Without this, signing out and back in
   *  as someone else in the same tab kept the previous user's workspace
   *  name/id sitting in this store (it's plain in-memory Zustand, not reset
   *  by anything until a hard page reload), and useDefaultWorkspace's own
   *  "don't overwrite an already-active workspace" guard then skipped
   *  fetching the new user's real one — the sidebar showed the wrong
   *  workspace/projects until the user manually refreshed. */
  reset: () => void
  /** WorkspaceSwitcher (the sidebar dropdown) only ever fetches its own
   *  workspace list once, on mount — it stays mounted across route changes,
   *  so deleting a workspace from Settings never made it disappear from
   *  that dropdown until a hard refresh. Bumping this gives the switcher's
   *  effect a dependency to react to instead of adding a direct callback
   *  between two otherwise-unrelated components. */
  workspacesVersion: number
  bumpWorkspacesVersion: () => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeWorkspaceId: null,
  activeWorkspaceName: null,
  activeProjectId: null,
  setActiveWorkspace: (id, name) =>
    set((state) => ({
      activeWorkspaceId: id,
      activeWorkspaceName: name ?? state.activeWorkspaceName,
    })),
  setActiveProject: (id) => set({ activeProjectId: id }),
  reset: () => set({ activeWorkspaceId: null, activeWorkspaceName: null, activeProjectId: null }),
  workspacesVersion: 0,
  bumpWorkspacesVersion: () => set((state) => ({ workspacesVersion: state.workspacesVersion + 1 })),
}))