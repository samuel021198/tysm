"use client";

import { useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { deletePost, hidePost } from "@/actions/collect";
import { tx, type Locale } from "@/lib/i18n";
import { shareUrl } from "./share-button";

const HOLD_MS = 480;
const MOVE_PX = 12;

export function PostMenu({
  locale,
  deleteId,
  hideKey,
  sharePath,
  dot = "header",
  children,
}: {
  locale: Locale;
  deleteId: string | null;
  hideKey: string;
  sharePath: string;
  dot?: "header" | "tile";
  children: ReactNode;
}) {
  const reactId = useId().replace(/:/g, "");
  const deleteFormId = `del${reactId}`;
  const hideFormId = `hide${reactId}`;
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const suppress = useRef(false);

  function clearTimer() {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = null;
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("button, input, textarea, select")) return;
    clearTimer();
    start.current = { x: event.clientX, y: event.clientY };
    timer.current = window.setTimeout(() => {
      suppress.current = true;
      setOpen(true);
    }, HOLD_MS);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const origin = start.current;
    if (!origin || timer.current == null) return;
    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > MOVE_PX) clearTimer();
  }

  async function onShare() {
    const result = await shareUrl(sharePath);
    if (result === "copied") {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
      return;
    }
    if (result === "shared") setOpen(false);
  }

  return (
    <div
      className="relative min-w-0"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={clearTimer}
      onPointerCancel={clearTimer}
      onContextMenu={(event) => {
        event.preventDefault();
        setOpen(true);
      }}
      onClickCapture={(event) => {
        if (!suppress.current) return;
        event.preventDefault();
        event.stopPropagation();
        suppress.current = false;
      }}
    >
      {children}
      <button
        type="button"
        aria-label={tx(locale, "更多", "More")}
        className={
          dot === "tile"
            ? "absolute bottom-1 right-1 z-10 grid h-6 w-6 place-items-center rounded-full bg-card/90 text-sm leading-none text-ink"
            : "absolute right-0.5 top-0.5 z-10 grid h-8 w-8 place-items-center text-lg leading-none text-ink"
        }
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <span aria-hidden>⋯</span>
      </button>
      {deleteId ? (
        <form
          id={deleteFormId}
          action={deletePost}
          className="hidden"
          onSubmit={(event) => {
            if (!window.confirm(tx(locale, "刪除這則貼文？", "Delete this post?"))) event.preventDefault();
          }}
        >
          <input type="hidden" name="postId" value={deleteId} />
        </form>
      ) : null}
      <form id={hideFormId} action={hidePost} className="hidden" onSubmit={() => setOpen(false)}>
        <input type="hidden" name="key" value={hideKey} />
      </form>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 p-3 pb-[calc(var(--tab-h)+0.75rem)] md:items-center md:p-6"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="menu"
            aria-label={tx(locale, "貼文", "Post")}
            className="w-full max-w-sm divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card"
            onClick={(event) => event.stopPropagation()}
          >
            {deleteId ? (
              <button type="submit" form={deleteFormId} role="menuitem" className="flex h-12 w-full items-center px-4 text-sm font-medium text-danger">
                {tx(locale, "剷除", "Delete")}
              </button>
            ) : null}
            <button type="button" role="menuitem" className="flex h-12 w-full items-center px-4 text-sm font-medium" onClick={() => void onShare()}>
              {copied ? tx(locale, "已複製", "Copied") : tx(locale, "分享", "Share")}
            </button>
            <button type="submit" form={hideFormId} role="menuitem" className="flex h-12 w-full items-center px-4 text-sm font-medium">
              {tx(locale, "隱藏", "Hide")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
