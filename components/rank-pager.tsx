"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EDGE_GUARD } from "@/lib/gesture";
import { rankPath, rankTabStep, type RankTab } from "@/lib/rank";
import { adjacentTab, setTabIntent, swipeBlocked, tabAxis, tabPagerIndex, tabSwipeDirection } from "@/lib/tabs";

/** Rank segments, then the neighbouring root once a segment ends. Vertical scrolls stay scrolls. */
export function RankPager({ tab, loggedIn, children }: { tab: RankTab; loggedIn: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const frame = useRef<HTMLDivElement>(null);
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const axis = useRef<"x" | "y" | null>(null);
  const lockX = useRef(false);
  const busy = useRef(false);
  const suppress = useRef(false);
  const tabRef = useRef(tab);
  const signedIn = useRef(loggedIn);
  const timer = useRef(0);
  tabRef.current = tab;
  signedIn.current = loggedIn;
  const [offset, setOffset] = useState(0);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setOffset(0);
    setAnimate(false);
    busy.current = false;
  }, [tab]);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    function onTouchMove(event: TouchEvent) {
      if (lockX.current && event.cancelable) event.preventDefault();
    }
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, []);

  function destination(dir: -1 | 1) {
    const segment = rankTabStep(tabRef.current, dir);
    if (segment) return rankPath(segment);
    return adjacentTab("/rank", dir, signedIn.current);
  }

  function onPointerDown(event: React.PointerEvent) {
    if (event.pointerType !== "touch" || busy.current) return;
    if (swipeBlocked()) return;
    if (!(event.target instanceof Element)) return;
    if (event.target.closest("input, textarea, select")) return;
    const gesture = event.target.closest("[data-gesture]");
    if (gesture && gesture !== frame.current) return;
    // The bottom pager listens on window. Stopping here keeps one owner for this gesture.
    event.stopPropagation();
    origin.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    axis.current = null;
    lockX.current = false;
    setAnimate(false);
  }

  function onPointerMove(event: React.PointerEvent) {
    const start = origin.current;
    if (!start || event.pointerId !== start.id || busy.current) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!axis.current) axis.current = tabAxis(dx, dy);
    if (axis.current !== "x") {
      lockX.current = false;
      return;
    }
    if (dx > 0 && start.x < EDGE_GUARD) {
      lockX.current = false;
      return;
    }
    lockX.current = true;
    const dir = dx < 0 ? 1 : -1;
    const segment = rankTabStep(tabRef.current, dir);
    const href = segment ? rankPath(segment) : adjacentTab("/rank", dir, signedIn.current);
    setOffset(href ? dx * 0.28 : dx * 0.08);
    const index = tabPagerIndex("/rank");
    if (!segment && href && index != null && Math.abs(dx) > 24) setTabIntent(index + dir);
    else setTabIntent(null);
  }

  function end(event: React.PointerEvent, commit: boolean) {
    const start = origin.current;
    if (!start || event.pointerId !== start.id) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const locked = axis.current;
    origin.current = null;
    axis.current = null;
    lockX.current = false;
    if (Math.hypot(dx, dy) > 24) {
      suppress.current = true;
      window.setTimeout(() => {
        suppress.current = false;
      }, 400);
    }
    const dir = commit
      ? tabSwipeDirection({ dx, dy, startX: start.x, axis: locked, viewportWidth: window.innerWidth, owner: null })
      : null;
    const href = dir ? destination(dir) : null;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!href || !dir) {
      setTabIntent(null);
      setAnimate(true);
      setOffset(0);
      return;
    }
    if (!rankTabStep(tabRef.current, dir)) {
      const index = tabPagerIndex("/rank");
      if (index != null) setTabIntent(index + dir);
    }
    busy.current = true;
    setAnimate(true);
    setOffset(reduce ? 0 : dir > 0 ? -window.innerWidth * 0.22 : window.innerWidth * 0.22);
    timer.current = window.setTimeout(() => {
      router.push(href);
    }, reduce ? 0 : 160);
  }

  return (
    <div
      ref={frame}
      data-gesture=""
      data-rank-pager=""
      style={{ transform: offset ? `translate3d(${offset}px,0,0)` : undefined, transition: animate ? "transform 180ms ease" : "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => end(event, true)}
      onPointerCancel={(event) => end(event, false)}
      onClickCapture={(event) => {
        if (!suppress.current) return;
        suppress.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {children}
    </div>
  );
}
