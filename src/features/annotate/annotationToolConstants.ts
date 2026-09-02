import {
  MousePointer2, Square, Spline,
  Tag as TagIcon, Sparkles, MessageSquare, CircleSlash,
  History as HistoryIcon,
} from "lucide-react"
import type { AnnotationTool } from "@/stores/annotationStore"
import type { ResizeHandle } from "./annotationCanvasTypes"

export const RESIZE_HANDLES: { key: ResizeHandle; className: string; cursor: string }[] = [
  { key: "nw", className: "-left-1 -top-1", cursor: "nwse-resize" },
  { key: "n", className: "left-1/2 -top-1 -translate-x-1/2", cursor: "ns-resize" },
  { key: "ne", className: "-top-1 -right-1", cursor: "nesw-resize" },
  { key: "e", className: "top-1/2 -right-1 -translate-y-1/2", cursor: "ew-resize" },
  { key: "se", className: "-right-1 -bottom-1", cursor: "nwse-resize" },
  { key: "s", className: "left-1/2 -bottom-1 -translate-x-1/2", cursor: "ns-resize" },
  { key: "sw", className: "-bottom-1 -left-1", cursor: "nesw-resize" },
  { key: "w", className: "top-1/2 -left-1 -translate-y-1/2", cursor: "ew-resize" },
]

export const NEW_CLASS_COLORS = [
  "#FF3B3B", "#3B82F6", "#22C55E", "#F59E0B", "#A855F7", "#EC4899", "#14B8A6", "#F97316",
]

export const tools: { key: AnnotationTool; icon: typeof MousePointer2; label: string }[] = [
  { key: "select", icon: MousePointer2, label: "Select (D)" },
  { key: "bbox", icon: Square, label: "Bounding box (B)" },
  { key: "polygon", icon: Spline, label: "Polygon (P)" },
]

// Documents the shortcuts actually wired up in AnnotationTool.tsx — kept in
// sync by hand, since a mismatch here is worse than not having the dialog
// at all.
export const SHORTCUT_GROUPS: { title: string; items: { keys: string[]; label: string; hint?: string }[] }[] = [
  {
    title: "General Shortcuts",
    items: [
      { keys: ["B"], label: "Bounding Box tool" },
      { keys: ["P"], label: "Polygon tool" },
      { keys: ["D"], label: "Select tool" },
      { keys: ["Space", "drag"], label: "Pan the image" },
      { keys: ["+"], label: "Zoom in" },
      { keys: ["–"], label: "Zoom out" },
      { keys: ["0"], label: "Reset zoom" },
      { keys: ["←"], label: "Previous image" },
      { keys: ["→"], label: "Next image" },
      { keys: ["R"], label: "Repeat Previous", hint: "Copies every annotation from the last image onto this one." },
      { keys: ["Shift", "A"], label: "Add Image to Dataset / Send to Unannotated", hint: "Toggles once the image has at least one annotation." },
      { keys: ["Esc"], label: "Exit the annotation editor / cancel the shape you're drawing" },
      { keys: ["Ctrl", "Z"], label: "Undo" },
      { keys: ["Ctrl", "Y"], label: "Redo" },
    ],
  },
  {
    title: "With Annotation Selected",
    items: [
      { keys: ["Enter"], label: "Save changes to selection and label" },
      { keys: ["Esc"], label: "Cancel changes and deselect" },
      { keys: ["↑"], label: "Previous class" },
      { keys: ["↓"], label: "Next class" },
      { keys: ["1", "–", "9"], label: "Jump straight to the Nth class in the list" },
      { keys: ["Backspace", "Delete"], label: "Delete selection" },
      { keys: ["Ctrl", "C"], label: "Copy selected annotation" },
      { keys: ["Ctrl", "V"], label: "Paste copied annotation onto the current image" },
    ],
  },
]

export const leftNavItems = [
  { key: "labels", icon: TagIcon, label: "Labels" },
  { key: "attributes", icon: Sparkles, label: "Attributes" },
  { key: "comments", icon: MessageSquare, label: "Comments" },
  { key: "history", icon: HistoryIcon, label: "History" },
  { key: "raw", icon: CircleSlash, label: "Raw Data" },
]
