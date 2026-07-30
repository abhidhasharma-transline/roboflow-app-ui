import { create } from "zustand"

interface WorkspaceState {
  activeWorkspaceId: string | null
  activeWorkspaceName: string | null
  activeProjectId: string | null
  setActiveWorkspace: (id: string, name?: string) => void
  setActiveProject: (id: string) => void
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
}))