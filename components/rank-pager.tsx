"use client";

import { useEffect, useRef } from "react";
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

  function paint(dx: number, live: boolean) {
    const el = frame.current;
    if (!el) return;
    const reduce = !live && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.style.transition = live || reduce ? "none" : "transform 180ms ease";
    el.style.transform = dx ? `translate3d(${dx}px,0,0)` : "";
  }

  // Partial link prefetch stops at app/loading.tsx and aliases every ?tab= to that shell.
  function warm() {
    const next = rankTabStep(tabRef.current, 1);
    const prev = rankTabStep(tabRef.current, -1);
    if (next) router.prefetch(rankPath(next));
    if (prev) router.prefetch(rankPath(prev));
  }

  useEffect(() => {
    busy.current = false;
    const el = frame.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.transform = "";
  }, [tab]);

  useEffect(() => {
    warm();
  }, [tab, router]);

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
    if (frame.current) frame.current.style.transition = "none";
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
    if (!lockX.current) {
      warm();
      // The row moves with the finger. Capture keeps pointermove coming after it slides out from under the touch.
      try {
        frame.current?.setPointerCapture(event.pointerId);
      } catch {
        // The pointer can already be gone. The drag still tracks while the finger is over the page.
      }
    }
    lockX.current = true;
    const dir = dx < 0 ? 1 : -1;
    const segment = rankTabStep(tabRef.current, dir);
    const href = segment ? rankPath(segment) : adjacentTab("/rank", dir, signedIn.current);
    paint(href ? dx * 0.28 : dx * 0.08, true);
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
      paint(0, false);
      return;
    }
    if (!rankTabStep(tabRef.current, dir)) {
      const index = tabPagerIndex("/rank");
      if (index != null) setTabIntent(index + dir);
    }
    busy.current = true;
    paint(reduce ? 0 : dir > 0 ? -window.innerWidth * 0.22 : window.innerWidth * 0.22, false);
    timer.current = window.setTimeout(() => {
      router.push(href);
    }, reduce ? 0 : 160);
  }

  return (
    <div
      ref={frame}
      data-gesture=""
      data-rank-pager=""
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
