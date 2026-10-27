"use client";

import { useRef } from "react";
import { gestureEnd, HOLD_MS, HOLD_SLOP, lockAxis, type GestureDir } from "@/lib/gesture";

type Options = {
  onLongPress?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeDown?: () => void;
  /** Block swipe-right from the screen edge so the browser can go back. */
  edgeGuard?: boolean;
  /** Story tap zones are buttons. Post menus are not: their buttons stay clicks. */
  trackButtons?: boolean;
};

/** Touch swipes. A mouse hold still opens the menu; a mouse drag does not swipe. */
export function useHoldSwipe(options: Options) {
  const opts = useRef(options);
  opts.current = options;
  const timer = useRef(0);
  const suppressClick = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<"x" | "y" | null>(null);
  const fired = useRef(false);
  const touch = useRef(false);

  function clearTimer() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = 0;
  }

  function reset() {
    clearTimer();
    start.current = null;
    axis.current = null;
    fired.current = false;
  }

  function armSuppress() {
    suppressClick.current = true;
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 800);
  }

  function fire(dir: GestureDir) {
    if (dir === "left") opts.current.onSwipeLeft?.();
    if (dir === "right") opts.current.onSwipeRight?.();
    if (dir === "down") opts.current.onSwipeDown?.();
  }

  function onPointerDown(event: React.PointerEvent) {
    if (event.button !== 0) return;
    const target = event.target;
    if (!opts.current.trackButtons && target instanceof Element && target.closest("button, input, textarea, select, label")) return;
    start.current = { x: event.clientX, y: event.clientY };
    axis.current = null;
    fired.current = false;
    touch.current = event.pointerType !== "mouse";
    clearTimer();
    if (!opts.current.onLongPress) return;
    timer.current = window.setTimeout(() => {
      timer.current = 0;
      if (!start.current || fired.current) return;
      fired.current = true;
      armSuppress();
      opts.current.onLongPress?.();
    }, HOLD_MS);
  }

  function onPointerMove(event: React.PointerEvent) {
    const origin = start.current;
    if (!origin || fired.current) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (Math.hypot(dx, dy) > HOLD_SLOP) clearTimer();
    if (!axis.current) axis.current = lockAxis(dx, dy);
  }

  function onPointerUp(event: React.PointerEvent) {
    const origin = start.current;
    const locked = axis.current;
    const fromTouch = touch.current;
    if (!origin || fired.current) {
      reset();
      return;
    }
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    const moved = Math.hypot(dx, dy) > HOLD_SLOP;
    const dir = fromTouch
      ? gestureEnd({
          dx,
          dy,
          startX: origin.x,
          axis: locked,
          allowRight: Boolean(opts.current.onSwipeRight),
          allowDown: Boolean(opts.current.onSwipeDown),
          edgeGuard: Boolean(opts.current.edgeGuard),
        })
      : null;
    reset();
    if (dir) {
      armSuppress();
      fire(dir);
      return;
    }
    if (moved) armSuppress();
  }

  function onClickCapture(event: React.MouseEvent) {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: reset,
    onClickCapture,
    style: {
      touchAction: options.onSwipeDown ? ("none" as const) : ("pan-y" as const),
      WebkitTouchCallout: "none" as const,
    },
  };
}
