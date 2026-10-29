/** Visible band for the fullscreen thread.
 * ponytail: 120px separates a keyboard from the Safari toolbar. Upgrade: env(keyboard-inset-height) once iOS reports 0 while the keyboard is closed.
 * Pinch-zoom also shrinks the visual viewport; leave the CSS fallback alone so a zoom does not resize the thread.
 */
export function threadFrameBox(input: {
  innerHeight: number;
  height: number;
  offsetTop: number;
  scale?: number;
}): { height: number; top: number; keyboard: boolean } | null {
  if ((input.scale ?? 1) > 1.01) return null;
  const top = Math.max(0, Math.round(input.offsetTop));
  const height = Math.max(0, Math.round(input.height));
  const covered = input.innerHeight - height - top;
  return { height, top, keyboard: covered > 120 };
}
