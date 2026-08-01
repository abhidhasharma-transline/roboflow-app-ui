import { create } from "zustand"

interface PendingBatch {
  workspaceId: string
  projectId: string
  batchId: string
}

interface UnsavedUploadState {
  pendingBatch: PendingBatch | null
  setPendingBatch: (batch: PendingBatch) => void
  clearPendingBatch: () => void
}

/** A batch enters "pending" the moment it's committed to the server (either
 *  via uploadImages() or a completed video extraction) and leaves it only
 *  when saveBatch() succeeds. While pending, the batch — and any images or
 *  the video row under it — exist in MinIO/DB but haven't been confirmed by
 *  the person as something they actually want to keep. */
export const useUnsavedUploadStore = create<UnsavedUploadState>((set) => ({
  pendingBatch: null,
  setPendingBatch: (batch) => set({ pendingBatch: batch }),
  clearPendingBatch: () => set({ pendingBatch: null }),
}))
