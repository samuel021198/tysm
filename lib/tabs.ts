import { CREATE_HREF, createDest } from "./create-modes";
import { AXIS_LOCK, EDGE_GUARD, SWIPE_X } from "./gesture";

/**
 * Bottom tabs, left to right: 賣場, Message, 加, 消息, 個人頁.
 * 加 is the existing 上架 route. Logged-out 消息 opens 新聞 so that inner tab stays public.
 */
export function tabHref(index: number, loggedIn: boolean): string | null {
  if (index === 0) return "/shop";
  if (index === 1) return "/messages";
  if (index === 2) return createDest(CREATE_HREF, loggedIn);
  if (index === 3) return loggedIn ? "/notifications" : "/news";
  if (index === 4) return loggedIn ? "/me" : "/login";
  return null;
}

/** Only these pages are the pager. Nested routes keep their own gestures. */
export function tabPagerIndex(pathname: string): number | null {
  if (pathname === "/shop") return 0;
  if (pathname === "/messages") return 1;
  if (pathname === "/add") return 2;
  if (pathname === "/notifications" || pathname === "/news") return 3;
  if (pathname === "/me" || pathname === "/login") return 4;
  return null;
}

export function adjacentTab(pathname: string, dir: -1 | 1, loggedIn: boolean): string | null {
  const index = tabPagerIndex(pathname);
  if (index == null) return null;
  return tabHref(index + dir, loggedIn);
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

/** Profile board, left to right. The first screen is on-sale listings, then 買取. Drafts stay off this strip. */
export const PROFILE_TABS = ["shelf", "buyout", "saved", "selling", "reviews"] as const;
export type ProfileTabId = (typeof PROFILE_TABS)[number];

/** Visitors do not get the shop-management tab. Posts are not a tab. */
export function profileBoardTabs(isSelf: boolean): readonly ProfileTabId[] {
  return isSelf ? PROFILE_TABS : PROFILE_TABS.filter((id) => id !== "selling");
}

export function profileTabIndex(tab: string, tabs: readonly string[] = PROFILE_TABS): number {
  return tabs.indexOf(tab);
}

/** 1 = next (swipe left). An unknown tab, including the retired posts tab, steps onto the first screen. */
export function profileTabStep(tab: string, dir: -1 | 1, tabs: readonly string[] = PROFILE_TABS): string | null {
  const index = profileTabIndex(tab, tabs);
  if (index < 0) return dir === 1 ? (tabs[0] ?? null) : null;
  const next = index + dir;
  if (next < 0 || next >= tabs.length) return null;
  return tabs[next] ?? null;
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
