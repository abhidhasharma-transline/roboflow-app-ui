import { Bell } from "lucide-react"

export function NotificationsPage() {
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-1 text-2xl font-semibold text-foreground">Notifications</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Updates about your workspaces and projects.
        </p>

        <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
          <Bell className="mb-2 size-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No notifications yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            You'll see invites, role changes, and other updates here.
          </p>
        </div>
      </div>
    </div>
  )
}
