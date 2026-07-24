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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Authenticated app shell */}
        <Route element={<AppShell />}>
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
        </Route>

        <Route path="*" element={<Navigate to="/workspace" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App