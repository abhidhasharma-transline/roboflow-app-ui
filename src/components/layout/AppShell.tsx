import { Outlet, useParams } from "react-router-dom"
import { IconRail } from "./IconRail"
import { ProjectSidebar } from "./ProjectSidebar"

export function AppShell() {
  const { projectId } = useParams()

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <IconRail expanded={!projectId} />
      {projectId && <ProjectSidebar />}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <Outlet />
      </div>
    </div>
  )
}