"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { EDGE_GUARD } from "@/lib/gesture";
import { adjacentTab, setTabIntent, tabAxis, tabPagerIndex, tabSwipeDirection, type SwipeOwner } from "@/lib/tabs";

function swipeOwner(target: EventTarget | null): SwipeOwner {
  if (!(target instanceof Element)) return null;
  if (target.closest("input, textarea, select, [contenteditable='true']")) return "carousel";
  if (target.closest("[data-gesture]")) return "carousel";
  const card = target.closest("[data-card-swipe]");
  let el: Element | null = target;
  while (el && el !== document.body && el !== document.documentElement) {
    if (el !== card) {
      const ox = getComputedStyle(el).overflowX;
      if ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth + 4) return "carousel";
    }
    el = el.parentElement;
  }
  return card ? "card" : null;
}

/** Touch pager across the tab roots. Mouse and desktop stay as taps. */
export function TabSwipe({ loggedIn, children }: { loggedIn: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const frame = useRef<HTMLDivElement>(null);
  const path = useRef(pathname);
  const signedIn = useRef(loggedIn);
  const from = useRef<1 | -1 | 0>(0);
  const lockX = useRef(false);
  path.current = pathname;
  signedIn.current = loggedIn;

  useEffect(() => {
    setTabIntent(null);
    const el = frame.current;
    const dir = from.current;
    from.current = 0;
    if (!el || !dir) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      el.style.transition = "";
      el.style.transform = "";
      return;
    }
    el.style.transition = "none";
    el.style.transform = `translate3d(${dir > 0 ? "16%" : "-16%"},0,0)`;
    const id = requestAnimationFrame(() => {
      el.style.transition = "transform 180ms ease";
      el.style.transform = "translate3d(0,0,0)";
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    let origin: { x: number; y: number; pointerId: number; owner: SwipeOwner } | null = null;
    let axis: "x" | "y" | null = null;
    let suppress = false;
    let busy = false;

    function paint(dx: number, live: boolean) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el!.style.transition = live || reduce ? "none" : "transform 180ms ease";
      el!.style.transform = dx ? `translate3d(${dx}px,0,0)` : "";
    }

    function onDown(event: PointerEvent) {
      if (event.pointerType !== "touch" || busy || window.innerWidth >= 768) return;
      if (tabPagerIndex(path.current) == null) return;
      if (document.querySelector('[role="dialog"], [role="menu"]')) return;
      const main = document.getElementById("main");
      const header = document.querySelector("header");
      if (!(event.target instanceof Node)) return;
      const inMain = Boolean(main?.contains(event.target));
      const inHeader = Boolean(header?.contains(event.target));
      if (!inMain && !inHeader) return;
      origin = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, owner: swipeOwner(event.target) };
      axis = null;
      lockX.current = false;
    }

    function onMove(event: PointerEvent) {
      if (!origin || event.pointerId !== origin.pointerId) return;
      const dx = event.clientX - origin.x;
      const dy = event.clientY - origin.y;
      if (!axis) axis = tabAxis(dx, dy);
      if (axis !== "x") return;
      const edge = dx < 0 && origin.x > window.innerWidth - EDGE_GUARD;
      if (origin.owner === "carousel" || (origin.owner === "card" && !edge)) {
        lockX.current = false;
        return;
      }
      lockX.current = true;
      const dir = dx < 0 ? 1 : -1;
      const href = adjacentTab(path.current, dir, signedIn.current);
      paint(href ? dx * 0.28 : dx * 0.08, true);
      const index = tabPagerIndex(path.current);
      if (index != null && href && Math.abs(dx) > 24) setTabIntent(index + dir);
    }

    function end(event: PointerEvent, commit: boolean) {
      if (!origin || event.pointerId !== origin.pointerId) return;
      const start = origin;
      const locked = axis;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      origin = null;
      axis = null;
      lockX.current = false;
      if (start.owner !== "carousel" && Math.hypot(dx, dy) > 24) {
        suppress = true;
        window.setTimeout(() => {
          suppress = false;
        }, 400);
      }
      const dir = commit
        ? tabSwipeDirection({
            dx,
            dy,
            startX: start.x,
            axis: locked,
            viewportWidth: window.innerWidth,
            owner: start.owner,
          })
        : null;
      const href = dir ? adjacentTab(path.current, dir, signedIn.current) : null;
      if (!href || !dir) {
        setTabIntent(null);
        paint(0, false);
        return;
      }
      const index = tabPagerIndex(path.current);
      if (index != null) setTabIntent(index + dir);
      busy = true;
      from.current = dir;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      paint(reduce ? 0 : dir > 0 ? -window.innerWidth * 0.22 : window.innerWidth * 0.22, false);
      window.setTimeout(() => {
        busy = false;
        router.push(href);
      }, reduce ? 0 : 160);
    }

    function onUp(event: PointerEvent) {
      end(event, true);
    }

    function onCancel(event: PointerEvent) {
      end(event, false);
    }

    function onTouchMove(event: TouchEvent) {
      if (lockX.current && event.cancelable) event.preventDefault();
    }

    function onClick(event: MouseEvent) {
      if (!suppress) return;
      suppress = false;
      event.preventDefault();
      event.stopPropagation();
    }

    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("click", onClick, true);
    };
  }, [router]);

  return <div ref={frame}>{children}</div>;
}
