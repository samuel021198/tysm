"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { EDGE_GUARD } from "@/lib/gesture";
import { adjacentTab, scrollerTakesSwipe, setTabIntent, swipeBlocked, tabAxis, tabPagerIndex, tabSwipeDirection, type SwipeOwner } from "@/lib/tabs";

function scrollHost(target: Element): HTMLElement | null {
  let el: Element | null = target;
  while (el && el !== document.body && el !== document.documentElement) {
    if (el instanceof HTMLElement && !el.hasAttribute("data-profile-pager") && !el.hasAttribute("data-rank-pager")) {
      const ox = getComputedStyle(el).overflowX;
      if ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth + 4) return el;
    }
    el = el.parentElement;
  }
  return null;
}

function hostOf(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  if (target.closest("[data-profile-pager], [data-rank-pager]")) return null;
  return scrollHost(target);
}

/** Inner pagers always own the gesture. A photo strip owns it only while that strip can still move. */
function swipeOwner(target: EventTarget | null, dx: number): SwipeOwner {
  if (!(target instanceof Element)) return null;
  if (target.closest("input, textarea, select, [contenteditable='true']")) return "carousel";
  if (target.closest("[data-profile-pager], [data-rank-pager]")) return "carousel";
  const host = scrollHost(target);
  if (host) {
    const max = host.scrollWidth - host.clientWidth;
    if (scrollerTakesSwipe({ scrollLeft: host.scrollLeft, maxScroll: max, dx })) return "carousel";
    return null;
  }
  if (target.closest("[data-gesture]")) return "carousel";
  return target.closest("[data-card-swipe]") ? "card" : null;
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
    let origin: { x: number; y: number; pointerId: number; target: EventTarget | null; scrollLeft: number } | null = null;
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
      if (swipeBlocked()) return;
      const main = document.getElementById("main");
      const header = document.querySelector("header");
      if (!(event.target instanceof Node)) return;
      const inMain = Boolean(main?.contains(event.target));
      const inHeader = Boolean(header?.contains(event.target));
      if (!inMain && !inHeader) return;
      origin = {
        x: event.clientX,
        y: event.clientY,
        pointerId: event.pointerId,
        target: event.target,
        scrollLeft: hostOf(event.target)?.scrollLeft ?? 0,
      };
      axis = null;
      lockX.current = false;
    }

    function onMove(event: PointerEvent) {
      if (!origin || event.pointerId !== origin.pointerId) return;
      const dx = event.clientX - origin.x;
      const dy = event.clientY - origin.y;
      if (!axis) axis = tabAxis(dx, dy);
      if (axis !== "x") return;
      const host = hostOf(origin.target);
      if (host && Math.abs(host.scrollLeft - origin.scrollLeft) > 4) {
        lockX.current = false;
        paint(0, true);
        return;
      }
      const owner = swipeOwner(origin.target, dx);
      const edge = dx < 0 && origin.x > window.innerWidth - EDGE_GUARD;
      if (owner === "carousel" || (owner === "card" && !edge)) {
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
      const host = hostOf(start.target);
      const stripMoved = Boolean(host && Math.abs(host.scrollLeft - start.scrollLeft) > 4);
      const owner: SwipeOwner = stripMoved ? "carousel" : swipeOwner(start.target, dx);
      if (owner !== "carousel" && Math.hypot(dx, dy) > 24) {
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
            owner,
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
