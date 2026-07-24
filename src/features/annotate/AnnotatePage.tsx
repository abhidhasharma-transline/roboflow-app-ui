import { useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Topbar } from "@/components/layout/Topbar"
import { ImageGrid } from "@/components/shared/ImageGrid"
import { Badge } from "@/components/ui/badge"
import { useImages } from "@/hooks/useImages"
import { useProject } from "@/hooks/useProjects"
import type { ImageStatus } from "@/types/image"

const columns: { key: ImageStatus; title: string; hint: string }[] = [
  {
    key: "unassigned",
    title: "Unassigned",
    hint: "Newly uploaded images waiting to be assigned to an annotator.",
  },
  {
    key: "annotating",
    title: "Annotating",
    hint: "In progress — currently being labeled.",
  },
  {
    key: "dataset",
    title: "Dataset",
    hint: "Annotated and approved, ready for training.",
  },
]

export function AnnotatePage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { project } = useProject(projectId)
  const { images, isLoading } = useImages(projectId)

  const grouped = useMemo(() => {
    return columns.reduce(
      (acc, col) => {
        acc[col.key] = images.filter((img) => img.status === col.key)
        return acc
      },
      {} as Record<ImageStatus, typeof images>
    )
  }, [images])

  return (
    <>
      <Topbar>
        <span className="text-muted-foreground">{project?.name}</span>
        <span className="text-muted-foreground">/</span>
        <span>Annotate</span>
      </Topbar>
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading images…</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {columns.map((col) => (
              <div key={col.key} className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      {col.title}
                    </h2>
                    <p className="text-xs text-muted-foreground">{col.hint}</p>
                  </div>
                  <Badge variant="secondary">{grouped[col.key].length}</Badge>
                </div>
                <div className="min-h-40 rounded-lg border border-border bg-muted/20 p-3">
                  <div
                    onClick={() =>
                      navigate(`/projects/${projectId}/annotate/batch/${col.key}`)
                    }
                    className="cursor-pointer"
                  >
                    <ImageGrid images={grouped[col.key].slice(0, 6)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
