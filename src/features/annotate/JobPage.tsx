import { useParams, useNavigate, Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { Topbar } from "@/components/layout/Topbar"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { JobStatusBadge } from "@/components/shared/StatusBadge"
import { useJobs } from "@/hooks/useBatch"

export function JobPage() {
  const { projectId, jobId } = useParams()
  const navigate = useNavigate()
  const { jobs, isLoading } = useJobs(projectId)
  const job = jobs.find((j) => j.id === jobId)

  return (
    <>
      <Topbar>
        <button
          onClick={() => navigate(`/projects/${projectId}/annotate`)}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Annotate
        </button>
        <span className="text-muted-foreground">/</span>
        <span>{job?.name ?? "Job"}</span>
      </Topbar>
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading || !job ? (
          <p className="text-sm text-muted-foreground">Loading job…</p>
        ) : (
          <div className="mx-auto max-w-2xl">
            <Card className="py-5">
              <CardContent className="flex flex-col gap-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-lg font-semibold text-foreground">
                      {job.name}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      Due {job.dueDate ?? "—"}
                    </p>
                  </div>
                  <JobStatusBadge status={job.status} />
                </div>

                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {job.assigneeName
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {job.assigneeName}
                    </p>
                    <p className="text-xs text-muted-foreground">Assignee</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium text-foreground">
                      {job.completedCount} / {job.imageCount}
                    </span>
                  </div>
                  <Progress
                    value={(job.completedCount / job.imageCount) * 100}
                  />
                </div>

                <Button variant="brand" asChild className="w-fit">
                  <Link to={`/projects/${projectId}/annotate/tool/${job.id}`}>
                    Continue annotating
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  )
}
