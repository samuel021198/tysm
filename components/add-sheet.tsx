"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { tx, type Locale } from "@/lib/i18n";
import { Icon } from "./icons";

const ACTIONS = [
  { href: "/sell", zh: "販售", en: "Sell", hintZh: "進階上架，拍賣同運送", hintEn: "Advanced listing, auctions and shipping", icon: "tag" as const },
  { href: "/add", zh: "加入收藏", en: "Collect", hintZh: "只收入收藏格", hintEn: "Save it to your collection", icon: "bookmark" as const },
  { href: "/add?kind=post", zh: "發貼", en: "Post", hintZh: "寫一則動態", hintEn: "Write a feed post", icon: "note" as const },
  { href: "/story/new", zh: "發限時動態", en: "Story", hintZh: "影相，24 小時後消失", hintEn: "A photo that lasts 24 hours", icon: "camera" as const },
];

function dest(href: string, loggedIn: boolean) {
  return loggedIn ? href : `/login?next=${encodeURIComponent(href)}`;
}

export function AddSheet({
  locale,
  loggedIn,
  variant,
  active = false,
  label,
}: {
  locale: Locale;
  loggedIn: boolean;
  variant: "tab" | "header";
  active?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [present, setPresent] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const closeTimer = useRef<number | null>(null);

  function close() {
    setPresent(false);
    setDragging(false);
    setDragY(0);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 280);
  }

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => setPresent(true));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, [open]);

  function onHandleDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    startY.current = event.clientY;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onHandleMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setDragY(Math.max(0, event.clientY - startY.current));
  }

  function onHandleUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const dy = Math.max(0, event.clientY - startY.current);
    setDragging(false);
    if (dy > 88) close();
    else setDragY(0);
  }

  const trigger =
    variant === "header" ? (
      <button type="button" className="sell-cta inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        {label}
      </button>
    ) : (
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-current={active ? "page" : undefined}
        className={`flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${active || open ? "text-ink" : "text-muted"}`}
        onClick={() => setOpen(true)}
      >
        <Icon name="plus" strokeWidth={active || open ? 2.15 : 1.7} />
        <span>{tx(locale, "新增", "Add")}</span>
      </button>
    );

  return (
    <>
      {trigger}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="presentation">
          <button
            type="button"
            className={`absolute inset-0 bg-[#221820]/45 transition-opacity duration-300 ${present ? "opacity-100" : "opacity-0"}`}
            aria-label={tx(locale, "關閉", "Close")}
            onClick={close}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={tx(locale, "新增", "Add")}
            className="relative w-full max-w-lg rounded-t-[1.75rem] bg-card px-4 pt-1 shadow-[0_-18px_50px_rgba(34,24,32,0.18)]"
            style={{
              transform: present ? `translateY(${dragY}px)` : "translateY(110%)",
              transition: dragging ? "none" : "transform 320ms cubic-bezier(0.22, 1.2, 0.36, 1)",
              paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
            }}
          >
            <div
              className="flex cursor-grab touch-none justify-center py-3 active:cursor-grabbing"
              onPointerDown={onHandleDown}
              onPointerMove={onHandleMove}
              onPointerUp={onHandleUp}
              onPointerCancel={onHandleUp}
            >
              <span className="h-1.5 w-11 rounded-full bg-ink/20" />
            </div>
            <p className="px-2 pb-2 text-sm font-semibold text-muted">{tx(locale, "想做咩？", "What do you want to add?")}</p>
            <ul className="grid gap-1">
              {ACTIONS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={dest(item.href, loggedIn)}
                    className="flex min-h-[4.5rem] items-center gap-4 rounded-2xl px-2 py-2 active:bg-soft"
                    onClick={close}
                  >
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-rose to-teal text-[#1b1418]">
                      <Icon name={item.icon} className="h-7 w-7" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 text-left">
                      <span className="block text-base font-semibold text-ink">{tx(locale, item.zh, item.en)}</span>
                      <span className="block text-sm text-muted">{tx(locale, item.hintZh, item.hintEn)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
