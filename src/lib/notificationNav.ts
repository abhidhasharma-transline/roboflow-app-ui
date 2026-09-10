import type { AppNotification } from "@/lib/notificationApi"
import { getImageJob } from "@/lib/imageApi"

/** Resolves a notification to the in-app path it should open, given the
 * `activeWorkspaceId` to fall back on when the notification itself doesn't
 * carry one (e.g. an "image" notification only ever has entity_id set).
 * Pure — doesn't navigate, mark-as-read, or switch the active workspace;
 * callers (NotificationsPage's click handler, the floating toast's "View"
 * action) each do those themselves since exactly when they happen differs
 * slightly between the two. Returns null when there's nowhere sensible to
 * go (e.g. no project_id at all) or when resolution fails (a since-deleted
 * image whose job lookup 404s).
 */
export async function resolveNotificationPath(
  n: AppNotification,
  activeWorkspaceId: string | null
): Promise<string | null> {
  if (!n.project_id) return null

  // "You were assigned to review X" / "N image(s) sent back for changes in
  // X" both carry entity_type="job" — jump straight to that job's page
  // instead of leaving the click a dead end.
  if (n.entity_type === "job" && n.entity_id) {
    return `/projects/${n.project_id}/annotate/job/${n.entity_id}`
  }
  // "Project X created/deleted", ownership transfers — land on the
  // project's board. A deleted project's id naturally 404s there, which
  // is still a more honest outcome than the click doing nothing at all.
  if (n.entity_type === "project" && n.entity_id) {
    return `/projects/${n.entity_id}/annotate`
  }
  // Version created/trashed/restored — the Versions panel lists all of
  // them, trashed ones included, so it's the one landing spot that works
  // regardless of which of those three this was.
  if (n.entity_type === "version") {
    return `/projects/${n.project_id}/versions`
  }
  // A batch either being uploaded/processed or merged — same board every
  // batch lives on.
  if (n.entity_type === "batch" && n.entity_id) {
    return `/projects/${n.project_id}/annotate/batch/${n.entity_id}`
  }
  // "X mentioned you in a comment" carries only the image's own id — the
  // annotation tool's URL needs a job id too, so this looks up whichever
  // job currently holds that image before it can actually link anywhere.
  if (n.entity_type === "image" && n.entity_id) {
    try {
      const { job_id } = await getImageJob(n.workspace_id ?? activeWorkspaceId!, n.project_id, n.entity_id)
      return `/projects/${n.project_id}/annotate/tool/${job_id}?image=${n.entity_id}`
    } catch {
      return null
    }
  }
  return null
}
