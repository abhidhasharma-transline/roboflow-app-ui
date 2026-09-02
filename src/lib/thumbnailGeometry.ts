/**
 * A grid thumbnail tile has a fixed CSS aspect ratio, but the real image
 * rarely matches it — with `object-cover` the browser crops the image to
 * fill the tile. An annotation overlay's percent coordinates are always
 * relative to the FULL original image, so drawing them with a plain
 * "0 0 100 100" viewBox ignores that crop and the boxes land in the wrong
 * spot near any cropped edge. This computes the viewBox that maps to
 * exactly the slice of the original image object-cover left visible, so
 * overlay coordinates line up with what's actually on screen.
 */
export function objectCoverViewBox(
  imgWidth: number | null | undefined,
  imgHeight: number | null | undefined,
  containerAspect: number
): string {
  if (!imgWidth || !imgHeight) return "0 0 100 100"
  const imgAspect = imgWidth / imgHeight
  if (imgAspect > containerAspect) {
    // Image is relatively wider than the tile — object-cover crops left/right.
    const visibleWidthPct = (containerAspect / imgAspect) * 100
    const x0 = (100 - visibleWidthPct) / 2
    return `${x0} 0 ${visibleWidthPct} 100`
  }
  // Image is relatively taller than the tile — object-cover crops top/bottom.
  const visibleHeightPct = (imgAspect / containerAspect) * 100
  const y0 = (100 - visibleHeightPct) / 2
  return `0 ${y0} 100 ${visibleHeightPct}`
}
