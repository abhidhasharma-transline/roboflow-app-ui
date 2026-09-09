import type { CSSProperties } from "react"
import type { PreprocessingConfig } from "@/lib/versionApi"

/** Real preprocessing (grayscale, contrast) is only ever applied lazily at
 *  export time (see app/versions/imaging.py) — nothing about a version's
 *  images is materialized/reprocessed at creation time. Without this, a
 *  version's thumbnails looked identical to the raw dataset even when
 *  "Grayscale: Applied" was shown right next to them in text, which read as
 *  broken. A CSS filter can't replace the real export-time conversion, but
 *  it gives an honest, immediate visual preview of what was chosen — same
 *  filter values already used by the picker tiles in PreprocessingDialogs.
 */
export function preprocessingPreviewStyle(
  preprocessing: PreprocessingConfig | null | undefined
): CSSProperties {
  const filters: string[] = []
  if (preprocessing?.grayscale) filters.push("grayscale(1)")
  if (preprocessing?.auto_contrast) filters.push("contrast(1.3)")
  return filters.length > 0 ? { filter: filters.join(" ") } : {}
}

/** Stacks two preview styles into one — `filter` strings concatenate
 *  (CSS applies space-separated filter functions left to right) rather
 *  than one overwriting the other, and same for `transform`. Used so the
 *  Augmentation step's previews show BOTH the chosen preprocessing
 *  (grayscale, contrast — set earlier in the wizard) AND whichever
 *  augmentation is being configured, instead of the augmentation preview
 *  silently reverting to full color/no-contrast. */
export function combineStyles(base: CSSProperties, extra: CSSProperties): CSSProperties {
  const filter = [base.filter, extra.filter].filter(Boolean).join(" ")
  const transform = [base.transform, extra.transform].filter(Boolean).join(" ")
  return {
    ...base,
    ...extra,
    ...(filter ? { filter } : {}),
    ...(transform ? { transform } : {}),
  }
}
