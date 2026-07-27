import { useEffect } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AppShell } from "@/components/layout/AppShell"
import { LoginPage } from "@/features/auth/LoginPage"
import { RegisterPage } from "@/features/auth/RegisterPage"
import { WorkspacePage } from "@/features/workspace/WorkspacePage"
import { ProjectsPage } from "@/features/projects/ProjectsPage"
import { UploadPage } from "@/features/upload/UploadPage"
import { TrainPage } from "@/features/train/TrainPage"
import { AnnotatePage } from "@/features/annotate/AnnotatePage"
import { BatchView } from "@/features/annotate/BatchView"
import { JobPage } from "@/features/annotate/JobPage"
import { AnnotationToolPage } from "@/features/annotate/AnnotationTool"
import { DatasetPage } from "@/features/dataset/DatasetPage"
import { VersionsPage } from "@/features/versions/VersionsPage"
import { AccountSettingsPage } from "@/features/settings/AccountSettingsPage"
import { WorkspaceMembersPage } from "@/features/settings/WorkspaceMembersPage"
import { useAuthStore } from "@/stores/authStore"

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isHydrating, hydrate } = useAuthStore()

  useEffect(() => {
    hydrate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isHydrating) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Navigate to="/workspace" replace />} />
          <Route path="/workspace" element={<WorkspacePage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId/train" element={<TrainPage />} />
          <Route path="/projects/:projectId/upload" element={<UploadPage />} />
          <Route path="/projects/:projectId/annotate" element={<AnnotatePage />} />
          <Route
            path="/projects/:projectId/annotate/batch/:status"
            element={<BatchView />}
          />
          <Route
            path="/projects/:projectId/annotate/job/:jobId"
            element={<JobPage />}
          />
          <Route
            path="/projects/:projectId/annotate/tool/:jobId"
            element={<AnnotationToolPage />}
          />
          <Route path="/projects/:projectId/dataset" element={<DatasetPage />} />
          <Route path="/projects/:projectId/versions" element={<VersionsPage />} />

          <Route path="/settings/account" element={<AccountSettingsPage />} />
          <Route
            path="/settings/workspaces/:workspaceId/members"
            element={<WorkspaceMembersPage />}
          />
        </Route>

        <Route path="*" element={<Navigate to="/workspace" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App