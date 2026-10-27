/** Long-press and swipe decisions. Pointer wiring lives in `useHoldSwipe`. */

export const HOLD_MS = 480;
/** A shaky finger can still count as a hold. Past this, the hold timer stops. */
export const HOLD_SLOP = 10;
/** Movement before we lock the gesture to horizontal or vertical. */
export const AXIS_LOCK = 14;
/** Horizontal distance that counts as a swipe, not a tap. */
export const SWIPE_X = 64;
/** Downward distance that closes a story. */
export const SWIPE_DOWN = 72;
/** Ignore swipe-right that starts here so the browser back gesture still wins. */
export const EDGE_GUARD = 28;

export type GestureDir = "left" | "right" | "down";

export function gestureEnd(input: {
  dx: number;
  dy: number;
  startX: number;
  axis: "x" | "y" | null;
  allowRight: boolean;
  allowDown: boolean;
  edgeGuard: boolean;
  /** When set with edgeGuard, a left swipe from the right screen edge is left for the tab pager. */
  viewportWidth?: number;
}): GestureDir | null {
  const adx = Math.abs(input.dx);
  const ady = Math.abs(input.dy);
  if (input.axis === "y") {
    if (input.allowDown && input.dy >= SWIPE_DOWN && input.dy > adx) return "down";
    return null;
  }
  if (input.axis !== "x") return null;
  if (adx < SWIPE_X || adx <= ady) return null;
  if (input.dx < 0) {
    const width = input.viewportWidth ?? 0;
    if (input.edgeGuard && width > 0 && input.startX > width - EDGE_GUARD) return null;
    return "left";
  }
  if (input.allowRight && (!input.edgeGuard || input.startX >= EDGE_GUARD)) return "right";
  return null;
}

export function lockAxis(dx: number, dy: number): "x" | "y" | null {
  if (Math.hypot(dx, dy) < AXIS_LOCK) return null;
  return Math.abs(dx) > Math.abs(dy) ? "x" : "y";
}
