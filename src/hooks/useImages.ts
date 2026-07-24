import { useEffect, useState, useCallback } from "react"
import type { ImageItem } from "@/types/image"
import { mockGetImages } from "@/lib/mockApi"

export function useImages(projectId: string | undefined) {
  const [images, setImages] = useState<ImageItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refetch = useCallback(() => {
    if (!projectId) return
    setIsLoading(true)
    mockGetImages(projectId)
      .then(setImages)
      .finally(() => setIsLoading(false))
  }, [projectId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { images, isLoading, refetch }
}
