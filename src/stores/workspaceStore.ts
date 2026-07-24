import { create } from "zustand"

interface WorkspaceState {
  activeWorkspaceId: string | null
  activeProjectId: string | null
  setActiveWorkspace: (id: string) => void
  setActiveProject: (id: string) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeWorkspaceId: null,
  activeProjectId: null,
  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
  setActiveProject: (id) => set({ activeProjectId: id }),
}))
