import { create } from "zustand"
import type { Annotation } from "@/types/annotation"

export type AnnotationTool = "select" | "bbox" | "polygon" | "brush" | "comment"

interface AnnotationState {
  activeTool: AnnotationTool
  activeClassId: string | null
  annotations: Annotation[]
  zoom: number
  setActiveTool: (tool: AnnotationTool) => void
  setActiveClassId: (id: string) => void
  setAnnotations: (annotations: Annotation[]) => void
  addAnnotation: (annotation: Annotation) => void
  upsertAnnotation: (annotation: Annotation) => void
  removeAnnotation: (id: string) => void
  setZoom: (zoom: number) => void
}

export const useAnnotationStore = create<AnnotationState>((set) => ({
  activeTool: "select",
  activeClassId: null,
  annotations: [],
  zoom: 1,
  setActiveTool: (tool) => set({ activeTool: tool }),
  setActiveClassId: (id) => set({ activeClassId: id }),
  setAnnotations: (annotations) => set({ annotations }),
  addAnnotation: (annotation) =>
    set((state) => ({ annotations: [...state.annotations, annotation] })),
  upsertAnnotation: (annotation) =>
    set((state) => {
      const exists = state.annotations.some((a) => a.id === annotation.id)
      return {
        annotations: exists
          ? state.annotations.map((a) => (a.id === annotation.id ? annotation : a))
          : [...state.annotations, annotation],
      }
    }),
  removeAnnotation: (id) =>
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== id),
    })),
  setZoom: (zoom) => set({ zoom }),
}))
