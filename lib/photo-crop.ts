/** Listing cover. Square card art. */
export const LISTING_CROP_ASPECT = 1;

/** Feed photos use aspect-[4/5]. */
export const POST_CROP_ASPECT = 4 / 5;

export const CROP_MAX_EDGE = 960;

export function cropOutputSize(aspect: number, maxEdge = CROP_MAX_EDGE): { width: number; height: number } {
  const safe = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  if (Math.abs(safe - 1) < 1e-6) return { width: maxEdge, height: maxEdge };
  if (safe > 1) return { width: maxEdge, height: Math.max(1, Math.round(maxEdge / safe)) };
  return { width: Math.max(1, Math.round(maxEdge * safe)), height: maxEdge };
}

export function quarterTurns(turns: number): number {
  return ((Math.trunc(turns) % 4) + 4) % 4;
}

/** Axis-aligned size after clockwise 90° steps. */
export function rotatedBounds(width: number, height: number, turns: number): { width: number; height: number } {
  return quarterTurns(turns) % 2 === 1 ? { width: height, height: width } : { width, height };
}

export function coverScale(srcW: number, srcH: number, frameW: number, frameH: number): number {
  if (srcW <= 0 || srcH <= 0 || frameW <= 0 || frameH <= 0) return 1;
  return Math.max(frameW / srcW, frameH / srcH);
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(4, Math.max(1, zoom));
}

export function clampPan(
  dx: number,
  dy: number,
  srcW: number,
  srcH: number,
  frameW: number,
  frameH: number,
  zoom: number,
): { x: number; y: number } {
  const z = clampZoom(zoom);
  const cover = coverScale(srcW, srcH, frameW, frameH);
  const maxX = Math.max(0, (srcW * cover * z - frameW) / 2);
  const maxY = Math.max(0, (srcH * cover * z - frameH) / 2);
  const x = Number.isFinite(dx) ? dx : 0;
  const y = Number.isFinite(dy) ? dy : 0;
  return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
}

export type CropView = {
  turns: number;
  /** Multiplier on the unrotated bitmap. Rotation is applied after this scale. */
  scale: number;
  panX: number;
  panY: number;
};

export function cropView(input: {
  srcWidth: number;
  srcHeight: number;
  turns: number;
  frameWidth: number;
  frameHeight: number;
  zoom: number;
  panX: number;
  panY: number;
}): CropView {
  const turns = quarterTurns(input.turns);
  const bounds = rotatedBounds(input.srcWidth, input.srcHeight, turns);
  const zoom = clampZoom(input.zoom);
  const pan = clampPan(input.panX, input.panY, bounds.width, bounds.height, input.frameWidth, input.frameHeight, zoom);
  return {
    turns,
    scale: coverScale(bounds.width, bounds.height, input.frameWidth, input.frameHeight) * zoom,
    panX: pan.x,
    panY: pan.y,
  };
}
