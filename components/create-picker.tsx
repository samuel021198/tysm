"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CREATE_MODES, createDest, createIndexFromScroll } from "@/lib/create-modes";
import { tx, type Locale } from "@/lib/i18n";
import { Icon } from "./icons";

export function CreatePicker({
  locale,
  loggedIn,
  variant,
  label,
}: {
  locale: Locale;
  loggedIn: boolean;
  variant: "corner" | "header";
  label?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [present, setPresent] = useState(false);
  const [index, setIndex] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const indexRef = useRef(0);
  const programmatic = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const goRef = useRef<(next: number) => void>(() => {});

  const pathRef = useRef(pathname);
  useEffect(() => {
    if (pathRef.current === pathname) return;
    pathRef.current = pathname;
    setPresent(false);
    setOpen(false);
  }, [pathname]);

  const creating =
    pathname.startsWith("/sell") || pathname.startsWith("/add") || pathname.startsWith("/story");
  const mode = CREATE_MODES[index] ?? CREATE_MODES[0];

  function close() {
    setPresent(false);
    programmatic.current = null;
    triggerRef.current?.focus();
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 280);
  }

  function openPicker() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpen(true);
    requestAnimationFrame(() => setPresent(true));
  }

  function go(next: number) {
    const el = scroller.current;
    const clamped = Math.min(CREATE_MODES.length - 1, Math.max(0, next));
    programmatic.current = clamped;
    indexRef.current = clamped;
    setIndex(clamped);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollTo({ left: clamped * (el.clientWidth || 0), behavior: reduce ? "auto" : "smooth" });
    window.setTimeout(() => {
      if (programmatic.current === clamped) programmatic.current = null;
    }, reduce ? 0 : 480);
  }

  goRef.current = go;

  function syncFromScroll() {
    const el = scroller.current;
    if (!el || programmatic.current !== null) return;
    const next = createIndexFromScroll(el.scrollLeft, el.clientWidth, CREATE_MODES.length);
    if (next !== indexRef.current) {
      indexRef.current = next;
      setIndex(next);
    }
  }

  useEffect(() => {
    if (!open) return;
    indexRef.current = 0;
    programmatic.current = null;
    setIndex(0);
    const frame = requestAnimationFrame(() => {
      if (scroller.current) scroller.current.scrollLeft = 0;
      setPresent(true);
      dialogRef.current?.focus();
    });
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        const dir = event.key === "ArrowRight" ? 1 : -1;
        goRef.current(indexRef.current + dir);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const nodes = [...dialogRef.current.querySelectorAll<HTMLElement>("button, a[href]")].filter(
        (el) => !el.hasAttribute("disabled") && el.getClientRects().length > 0,
      );
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    function onScrollEnd() {
      programmatic.current = null;
      syncFromScroll();
    }
    document.addEventListener("keydown", onKey);
    scroller.current?.addEventListener("scrollend", onScrollEnd);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      scroller.current?.removeEventListener("scrollend", onScrollEnd);
      document.body.style.overflow = prev;
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, [open]);

  const trigger =
    variant === "header" ? (
      <button
        ref={triggerRef}
        type="button"
        className="sell-cta inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openPicker}
      >
        {label}
      </button>
    ) : (
      <button
        ref={triggerRef}
        type="button"
        className={`fixed left-2.5 z-50 grid h-9 w-9 place-items-center rounded-full bg-accent text-white shadow-none md:hidden ${creating ? "ring-2 ring-ink ring-offset-2 ring-offset-[var(--bg)]" : ""}`}
        style={{ top: "calc(env(safe-area-inset-top) + 0.375rem)" }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-current={creating ? "page" : undefined}
        aria-label={tx(locale, "新增", "Create")}
        onClick={openPicker}
      >
        <Icon name="plus" className="h-4 w-4" strokeWidth={2.25} />
      </button>
    );

  const dialog = (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={tx(locale, "新增", "Create")}
      tabIndex={-1}
      className={`fixed inset-0 z-[80] flex flex-col text-white outline-none transition duration-300 ${present ? "opacity-100" : "opacity-0"}`}
      style={{ backgroundColor: "#0F172A" }}
    >
      <div className="grid grid-cols-3 items-center px-2 pt-[max(0.25rem,env(safe-area-inset-top))]">
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full text-white/90 active:bg-white/10"
          aria-label={tx(locale, "關閉", "Close")}
          onClick={close}
        >
          <span className="glyph-x" aria-hidden>×</span>
        </button>
        <p className="text-center text-sm font-semibold">{tx(locale, "新增", "Create")}</p>
        <p className="pr-3 text-right text-sm tabular-nums text-white/70">
          {index + 1} / {CREATE_MODES.length}
        </p>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          onScroll={syncFromScroll}
          className="flex h-full snap-x snap-mandatory touch-pan-x overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:h-0"
        >
          {CREATE_MODES.map((item, i) => (
            <section
              key={item.id}
              id={`create-panel-${item.id}`}
              role="tabpanel"
              aria-labelledby={`create-tab-${item.id}`}
              aria-hidden={i !== index}
              className="flex w-full shrink-0 snap-center snap-always items-center justify-center px-6"
            >
              <article className="flex w-[min(18rem,84vw)] flex-col items-center rounded-xl bg-card px-5 py-7 text-center text-ink shadow-card">
                <span className="grid h-16 w-16 place-items-center rounded-xl bg-accent text-white">
                  <Icon name={item.icon} className="h-8 w-8" strokeWidth={1.6} />
                </span>
                <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight">{tx(locale, item.zh, item.en)}</h2>
                <p className="mt-1.5 text-sm text-muted">{tx(locale, item.hintZh, item.hintEn)}</p>
              </article>
            </section>
          ))}
        </div>
        {index > 0 ? (
          <button
            type="button"
            className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl leading-none text-white md:grid"
            aria-label={tx(locale, "上一個", "Previous")}
            onClick={() => go(index - 1)}
          >
            <span aria-hidden>‹</span>
          </button>
        ) : null}
        {index < CREATE_MODES.length - 1 ? (
          <button
            type="button"
            className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl leading-none text-white md:grid"
            aria-label={tx(locale, "下一個", "Next")}
            onClick={() => go(index + 1)}
          >
            <span aria-hidden>›</span>
          </button>
        ) : null}
      </div>

      <p className="sr-only" aria-live="polite">
        {tx(locale, mode.zh, mode.en)}
      </p>
      <p className="pb-1 text-center text-xs text-white/60">{tx(locale, "左右滑動揀", "Swipe to choose")}</p>
      <div className="px-6">
        <Link
          href={createDest(mode.href, loggedIn)}
          className="btn btn-primary w-full max-w-sm"
          aria-label={`${tx(locale, mode.zh, mode.en)}，${tx(locale, mode.ctaZh, mode.ctaEn)}`}
          onClick={() => {
            setPresent(false);
            setOpen(false);
          }}
        >
          {tx(locale, mode.ctaZh, mode.ctaEn)}
        </Link>
      </div>
      <div
        role="tablist"
        aria-label={tx(locale, "新增", "Create")}
        className="grid px-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1"
        style={{ gridTemplateColumns: `repeat(${CREATE_MODES.length}, minmax(0, 1fr))` }}
      >
        {CREATE_MODES.map((item, i) => (
          <button
            key={item.id}
            id={`create-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-controls={`create-panel-${item.id}`}
            className={`min-h-14 whitespace-nowrap px-1 text-[13px] font-semibold ${i === index ? "" : "text-white/75"}`}
            onClick={() => go(i)}
          >
            <span className="inline-flex flex-col items-center">
              <span>{tx(locale, item.zh, item.en)}</span>
              <span className={`mt-1 h-1 w-6 rounded-full bg-accent ${i === index ? "opacity-100" : "opacity-0"}`} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {trigger}
      {open ? createPortal(dialog, document.body) : null}
    </>
  );
}
