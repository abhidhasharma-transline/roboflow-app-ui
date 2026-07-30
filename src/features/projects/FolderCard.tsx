import { Link } from "react-router-dom"
import { Folder, MoreVertical } from "lucide-react"

export function FolderCard({
  folder,
}: {
  folder: { id: string; name: string; project_count: number }
}) {
  return (
    <Link
      to={`/projects/folders/${folder.id}`}
      className="group flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Folder className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{folder.name}</p>
        <p className="text-xs text-muted-foreground">
          {folder.project_count} Project{folder.project_count !== 1 && "s"}
        </p>
      </div>
      <button
        onClick={(e) => e.preventDefault()}
        className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-accent group-hover:opacity-100"
      >
        <MoreVertical className="size-4" />
      </button>
    </Link>
  )
}