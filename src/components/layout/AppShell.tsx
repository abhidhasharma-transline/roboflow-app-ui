import { Outlet, useParams } from "react-router-dom"
import { IconRail } from "./IconRail"
import { ProjectSidebar } from "./ProjectSidebar"
import { Topbar } from "./Topbar"

export function AppShell() {
  const { projectId } = useParams()

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      {/* Full-width top bar — logo lives here now, not in the sidebar */}
      <Topbar />
      <div className="flex min-w-0 flex-1 overflow-hidden">
        <IconRail expanded={!projectId} />
        {projectId && <ProjectSidebar />}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
