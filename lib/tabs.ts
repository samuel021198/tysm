import { AXIS_LOCK, EDGE_GUARD, SWIPE_X } from "./gesture";

/** Bottom tab roots, left to right. Profile is /me or /login. Rank stays on the top bar. */
export const TAB_ROOTS = ["/", "/shop", "/find", "/news"] as const;

/** Only these pages are the pager. Nested routes keep their own gestures. */
export function tabPagerIndex(pathname: string): number | null {
  if (pathname === "/") return 0;
  if (pathname === "/shop") return 1;
  if (pathname === "/find") return 2;
  if (pathname === "/news") return 3;
  if (pathname === "/me" || pathname === "/login") return 4;
  return null;
}

export function adjacentTab(pathname: string, dir: -1 | 1, loggedIn: boolean): string | null {
  const index = tabPagerIndex(pathname);
  if (index == null) return null;
  const next = index + dir;
  if (next < 0 || next > 4) return null;
  if (next === 4) return loggedIn ? "/me" : "/login";
  return TAB_ROOTS[next];
}

/** Horizontal has to win clearly so a vertical flick still scrolls. */
export function tabAxis(dx: number, dy: number): "x" | "y" | null {
  if (Math.hypot(dx, dy) < AXIS_LOCK) return null;
  if (Math.abs(dx) > Math.abs(dy) * 1.35) return "x";
  if (Math.abs(dy) >= Math.abs(dx)) return "y";
  return null;
}

export type SwipeOwner = "carousel" | "card" | null;

/**
 * 1 = next tab (swipe left), -1 = previous (swipe right).
 * ponytail: feed/collection cards keep #50 swipes; only the right 28px edge of a card changes tabs.
 * A photo strip is `carousel` only while it can still scroll that way. Profile and rank pagers always are.
 * Left-edge swipe-right stays the browser back gesture.
 */
export function tabSwipeDirection(input: {
  dx: number;
  dy: number;
  startX: number;
  axis: "x" | "y" | null;
  viewportWidth: number;
  owner: SwipeOwner;
}): -1 | 1 | null {
  if (input.axis !== "x") return null;
  const adx = Math.abs(input.dx);
  if (adx < SWIPE_X || adx <= Math.abs(input.dy)) return null;
  if (input.owner === "carousel") return null;
  if (input.dx > 0 && input.startX < EDGE_GUARD) return null;
  if (input.owner === "card") {
    if (input.dx < 0 && input.viewportWidth > 0 && input.startX > input.viewportWidth - EDGE_GUARD) return 1;
    return null;
  }
  return input.dx < 0 ? 1 : -1;
}

/** Profile board, left to right. Drafts stay off this strip. */
export const PROFILE_TABS = ["posts", "saved", "selling", "reviews"] as const;
export type ProfileTabId = (typeof PROFILE_TABS)[number];

export function profileTabIndex(tab: string): number {
  return PROFILE_TABS.indexOf(tab as ProfileTabId);
}

/** 1 = next (swipe left). Drafts are outside the strip; swipe left lands on My Binder. */
export function profileTabStep(tab: string, dir: -1 | 1): ProfileTabId | null {
  const index = profileTabIndex(tab);
  if (index < 0) return dir === 1 ? PROFILE_TABS[0] : null;
  const next = index + dir;
  if (next < 0 || next >= PROFILE_TABS.length) return null;
  return PROFILE_TABS[next];
}

/** Tab query without flashing ok/err. No navigation — the board calls history.replaceState. */
export function profileTabHref(base: string, tab: string): string {
  const url = new URL(base.split("#")[0], "http://local");
  url.searchParams.set("tab", tab);
  url.searchParams.delete("ok");
  url.searchParams.delete("err");
  return `${url.pathname}${url.search}`;
}

/** Same thresholds as the bottom pager. The left edge stays the browser back gesture. */
export function profileSwipeDirection(input: {
  dx: number;
  dy: number;
  startX: number;
  axis: "x" | "y" | null;
  viewportWidth: number;
}): -1 | 1 | null {
  return tabSwipeDirection({ ...input, owner: null });
}

let intent: number | null = null;
const listeners = new Set<(index: number | null) => void>();

export function setTabIntent(index: number | null) {
  if (intent === index) return;
  intent = index;
  for (const listener of listeners) listener(index);
}

export function subscribeTabIntent(listener: (index: number | null) => void) {
  listeners.add(listener);
  listener(intent);
  return () => {
    listeners.delete(listener);
  };
}

/** True while a horizontal scroller can still move in this direction. At either end it yields. */
export function scrollerTakesSwipe(input: { scrollLeft: number; maxScroll: number; dx: number }): boolean {
  if (input.maxScroll <= 4 || input.dx === 0) return false;
  if (input.dx < 0) return input.scrollLeft < input.maxScroll - 2;
  return input.scrollLeft > 2;
}

/**
 * Open sheets block paging. A closed `<details>` menu stays in the DOM (the create picker)
 * and must not. ponytail: visibility via layout rects, not a mutation observer.
 */
export function swipeBlocked(): boolean {
  if (typeof document === "undefined") return false;
  for (const node of document.querySelectorAll('[role="dialog"], [role="menu"]')) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.closest("details:not([open])")) continue;
    if (node.getClientRects().length === 0) continue;
    return true;
  }
  return false;
}
