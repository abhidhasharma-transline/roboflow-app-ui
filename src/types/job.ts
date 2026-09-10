export type JobType = "self" | "team"

export interface BatchDetail {
  id: string
  name: string
  status: string
  source_type: string
  created_at: string
  unassigned_count: number
}

export interface BatchSummary {
  id: string
  name: string
  status: string
  created_at: string
  unassigned_count: number
}

export interface JobAssignmentSummary {
  user_id: string
  image_count: number
}

export interface JobCreateResponse {
  job_id: string
  title: string
  assignments: JobAssignmentSummary[]
}

export interface JobAssignmentDetail {
  user_id: string
  name: string
  email: string
  image_count: number
}

export interface JobDetail {
  id: string
  title: string
  type: JobType
  /** "dataset" = every image here has already been promoted — a historical
   *  record card, not an active work queue. Actions like Start Annotating,
   *  Submit for Review, and Approve/Reject don't apply to it anymore. */
  stage: "annotating" | "dataset"
  instructions: string | null
  /** Whoever most recently set/edited the CURRENT instructions text — null
   *  if instructions were never written. Only that person (or an
   *  Admin/SA) can edit or clear them — see _check_can_edit_instructions
   *  on the backend. */
  instructions_updated_by: string | null
  instructions_updated_by_name: string | null
  status: string
  shuffle: boolean
  batch_id: string
  batch_name: string
  created_at: string
  total_images: number
  annotated_count: number
  unannotated_count: number
  /** approved_count is 0 until a reviewer actually approves something.
   *  pending_review_count is just annotated_count - approved_count, so on a
   *  job with no reviewers it equals annotated_count (never advances past
   *  pending) — only read either field once job.reviewers is non-empty. */
  approved_count: number
  pending_review_count: number
  /** Rejected images are already excluded from both annotated_count and
   *  unannotated_count — they're their own bucket until the labeler fixes
   *  and re-saves the image, which resets it back to unannotated. */
  rejected_count: number
  assignments: JobAssignmentDetail[]
}

export interface JobImageSummary {
  id: string
  filename: string
  thumbnail_url: string | null
  url: string
  status: string
  split: "train" | "valid" | "test" | null
}

export interface JobSummary {
  id: string
  title: string
  type: JobType
  batch_id: string
  batch_name: string
  batch_created_at: string
  total_images: number
  annotated_count: number
  unannotated_count: number
  created_at: string
  /** Same "0 until a reviewer actually approves something" caveat as
   *  JobDetail's approved_count/pending_review_count — only meaningful once
   *  needs_review (or the project otherwise has reviewers) is true. */
  approved_count: number
  pending_review_count: number
  /** true = fully annotated, at least one image still awaiting a review
   *  verdict, and this project actually has a reviewer-capable member —
   *  the Annotate board's Review column is exactly the annotating-stage
   *  jobs where this is true. */
  needs_review: boolean
  assignments: { user_id: string; name: string }[]
}

export interface JobActivityEntry {
  id: string
  action: string
  user_name: string
  user_email: string | null
  created_at: string
}

export interface JobReviewerSummary {
  user_id: string
  name: string
  email: string
  status: string
  /** Who clicked "Submit for Review" to create this row, and when — lets
   *  the reviewer's own job page say "X submitted N image(s) for your
   *  review" instead of images just silently appearing with nothing
   *  pointing out that anyone asked for anything. */
  assigned_by_name: string | null
  created_at: string
  /** This reviewer's own exclusive slice of the job's images — see
   *  _assign_pending_reviews on the backend. */
  pending: number
  approved: number
  rejected: number
}
