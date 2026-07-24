import { useEffect, useState } from "react"
import type { Batch } from "@/types/image"
import type { AnnotationJob } from "@/types/annotation"
import { mockGetBatches, mockGetJobs } from "@/lib/mockApi"

export function useBatches(projectId: string | undefined) {
  const [batches, setBatches] = useState<Batch[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    setIsLoading(true)
    mockGetBatches(projectId)
      .then(setBatches)
      .finally(() => setIsLoading(false))
  }, [projectId])

  return { batches, isLoading }
}

export function useJobs(projectId: string | undefined) {
  const [jobs, setJobs] = useState<AnnotationJob[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    setIsLoading(true)
    mockGetJobs(projectId)
      .then(setJobs)
      .finally(() => setIsLoading(false))
  }, [projectId])

  return { jobs, isLoading }
}
