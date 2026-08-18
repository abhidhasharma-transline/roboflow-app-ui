import { useEffect } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AppShell } from "@/components/layout/AppShell"
import { LoginPage } from "@/features/auth/LoginPage"
import { RegisterPage } from "@/features/auth/RegisterPage"
import { ActivateAccountPage } from "@/features/auth/ActivateAccountPage"
import { WorkspacePage } from "@/features/workspace/WorkspacePage"
import { ProjectsPage } from "@/features/projects/ProjectsPage"
import { FolderProjectsPage } from "@/features/projects/FolderProjectsPage"
import { UploadPage } from "@/features/upload/UploadPage"
import { TrainPage } from "@/features/train/TrainPage"
import { AnnotatePage } from "@/features/annotate/AnnotatePage"
import { BatchAssignPage } from "@/features/annotate/BatchAssignPage"
import { JobPage } from "@/features/annotate/JobPage"
import { AnnotationToolPage } from "@/features/annotate/AnnotationTool"
import { DatasetPage } from "@/features/dataset/DatasetPage"
import { ClassesTagsPage } from "@/features/classes/ClassesTagsPage"
import { VersionsPage } from "@/features/versions/VersionsPage"
import { SettingsLayout } from "@/features/settings/SettingsLayout"
import { AccountSettingsPage } from "@/features/settings/AccountSettingsPage"
import { WorkspacesOverviewPage } from "@/features/settings/WorkspacesOverviewPage"
import { UsersSettingsPage } from "@/features/settings/UsersSettingsPage"
import { WorkspaceMembersPage } from "@/features/settings/WorkspaceMembersPage"
import { InvitationAcceptPage } from "@/features/workspace/InvitationAcceptPage"
import { NotificationsPage } from "@/features/notifications/NotificationsPage"
import { ToastContainer } from "@/components/shared/ToastContainer"
import { useAuthStore } from "@/stores/authStore"
import { useDefaultWorkspace } from "@/hooks/useDefaultWorkspace"

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isHydrating, hydrate } = useAuthStore()
  useDefaultWorkspace()

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
      <ToastContainer />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/activate/:token" element={<ActivateAccountPage />} />
        <Route path="/workspace/invitations/:token" element={<InvitationAcceptPage />} />

        {/* Full-screen annotation tool — deliberately outside AppShell so no
            app chrome (Topbar/ProjectSidebar) bleeds into the editor. */}
        <Route
          path="/projects/:projectId/annotate/tool/:jobId"
          element={
            <RequireAuth>
              <AnnotationToolPage />
            </RequireAuth>
          }
        />

        {/* Authenticated app shell */}
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/workspace" element={<WorkspacePage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/folders/:folderId" element={<FolderProjectsPage />} />
          <Route path="/projects/:projectId/train" element={<TrainPage />} />
          <Route path="/projects/:projectId/upload" element={<UploadPage />} />
          <Route path="/projects/:projectId/annotate" element={<AnnotatePage />} />
          <Route
            path="/projects/:projectId/annotate/batch/:batchId"
            element={<BatchAssignPage />}
          />
          <Route
            path="/projects/:projectId/annotate/job/:jobId"
            element={<JobPage />}
          />
          <Route path="/projects/:projectId/dataset" element={<DatasetPage />} />
          <Route path="/projects/:projectId/classes" element={<ClassesTagsPage />} />
          <Route path="/projects/:projectId/versions" element={<VersionsPage />} />

          <Route path="/notifications" element={<NotificationsPage />} />

          <Route path="/settings" element={<SettingsLayout />}>
            <Route path="account" element={<AccountSettingsPage />} />
            <Route path="workspaces" element={<WorkspacesOverviewPage />} />
            <Route path="workspaces/:workspaceId/members" element={<WorkspaceMembersPage />} />
          </Route>
          <Route path="/settings/users" element={<UsersSettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
