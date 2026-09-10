import { Outlet, useParams } from "react-router-dom"
import { IconRail } from "./IconRail"
import { ProjectSidebar } from "./ProjectSidebar"
import { Topbar } from "./Topbar"
import { NotificationToastBridge } from "@/components/shared/NotificationToastBridge"

export function AppShell() {
  const { projectId } = useParams()

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      {/* Polls for new notifications and floats a toast for each — mounted
          here so it's alive on every authenticated page (inside a project's
          job/annotation views included), not just while IconRail is shown. */}
      <NotificationToastBridge />
      {/* Full-width top bar — logo lives here now, not in the sidebar */}
      <Topbar />
      <div className="flex min-w-0 flex-1 overflow-hidden">
        {/* Inside a project, only the project's own sidebar (Upload/Annotate/
            Train) shows — the workspace-level icon rail (Agent/Projects/…)
            is hidden entirely, not just collapsed. */}
        {!projectId && <IconRail expanded />}
        {projectId && <ProjectSidebar />}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
