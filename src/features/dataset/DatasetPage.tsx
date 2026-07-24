import { useParams } from "react-router-dom"
import { Topbar } from "@/components/layout/Topbar"
import { Button } from "@/components/ui/button"
import { ImageGrid } from "@/components/shared/ImageGrid"
import { useImages } from "@/hooks/useImages"
import { useProject } from "@/hooks/useProjects"
import { mockGetClasses } from "@/lib/mockApi"
import { useEffect, useState } from "react"
import type { ClassLabel } from "@/types/annotation"

export function DatasetPage() {
  const { projectId } = useParams()
  const { project } = useProject(projectId)
  const { images, isLoading } = useImages(projectId)
  const [classes, setClasses] = useState<ClassLabel[]>([])

  useEffect(() => {
    if (projectId) mockGetClasses(projectId).then(setClasses)
  }, [projectId])

  const datasetImages = images.filter((img) => img.status === "dataset")
  const totalAnnotations = classes.reduce((sum, c) => sum + c.count, 0)

  return (
    <>
      <Topbar>
        <span className="text-muted-foreground">{project?.name}</span>
        <span className="text-muted-foreground">/</span>
        <span>Dataset</span>
      </Topbar>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Class distribution
            </h2>
            <div className="flex flex-col gap-2">
              {classes.map((cls) => {
                const pct = totalAnnotations
                  ? Math.round((cls.count / totalAnnotations) * 100)
                  : 0
                return (
                  <div key={cls.id} className="flex items-center gap-2 text-sm">
                    <span
                      className="size-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: cls.color }}
                    />
                    <span className="w-24 truncate">{cls.name}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: cls.color }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs text-muted-foreground">
                      {cls.count}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex flex-col items-start justify-center gap-2 rounded-lg border border-border bg-muted/20 p-5">
            <p className="text-sm text-muted-foreground">
              Ready for training
            </p>
            <p className="text-2xl font-semibold text-foreground">
              {datasetImages.length} images
            </p>
            <Button variant="brand" size="sm">
              Generate new version
            </Button>
          </div>
        </div>

        <h2 className="mb-3 text-sm font-semibold text-foreground">Images</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading dataset…</p>
        ) : (
          <ImageGrid images={datasetImages} />
        )}
      </div>
    </>
  )
}
