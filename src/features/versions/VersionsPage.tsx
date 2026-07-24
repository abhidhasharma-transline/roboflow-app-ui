import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { GitBranch, Download } from "lucide-react"
import { Topbar } from "@/components/layout/Topbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useProject } from "@/hooks/useProjects"
import { mockGetVersions } from "@/lib/mockApi"
import type { DatasetVersion } from "@/types/version"

export function VersionsPage() {
  const { projectId } = useParams()
  const { project } = useProject(projectId)
  const [versions, setVersions] = useState<DatasetVersion[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    mockGetVersions(projectId)
      .then(setVersions)
      .finally(() => setIsLoading(false))
  }, [projectId])

  return (
    <>
      <Topbar>
        <span className="text-muted-foreground">{project?.name}</span>
        <span className="text-muted-foreground">/</span>
        <span>Versions</span>
      </Topbar>
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading versions…</p>
        ) : (
          <div className="flex flex-col gap-4">
            {versions.map((v) => (
              <Card key={v.id} className="py-4">
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <GitBranch className="size-4 text-brand" />
                      <h3 className="font-semibold text-foreground">
                        Version {v.versionNumber}
                      </h3>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Train</p>
                      <p className="font-medium text-foreground">{v.trainCount}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Valid</p>
                      <p className="font-medium text-foreground">{v.validCount}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Test</p>
                      <p className="font-medium text-foreground">{v.testCount}</p>
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                      Preprocessing
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {v.preprocessingSteps.map((step) => (
                        <Badge key={step} variant="secondary">
                          {step}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                      Augmentation
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {v.augmentationSteps.map((step) => (
                        <Badge key={step} variant="secondary">
                          {step}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground">
                      Export as:
                    </span>
                    {v.exportFormats.map((fmt) => (
                      <Button key={fmt} variant="outline" size="sm">
                        <Download className="size-3.5" />
                        {fmt}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
