"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CREATE_MODES, createDefaultIndex, createDest } from "@/lib/create-modes";
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
  const [index, setIndex] = useState(createDefaultIndex);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | null>(null);

  const pathRef = useRef(pathname);
  useEffect(() => {
    if (pathRef.current === pathname) return;
    pathRef.current = pathname;
    setPresent(false);
    setOpen(false);
  }, [pathname]);

  const creating =
    pathname.startsWith("/sell") || pathname.startsWith("/add") || pathname.startsWith("/story");
  const mode = CREATE_MODES[index] ?? CREATE_MODES[createDefaultIndex()];

  function close() {
    setPresent(false);
    triggerRef.current?.focus();
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 280);
  }

  function openPicker() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setIndex(createDefaultIndex());
    setOpen(true);
    requestAnimationFrame(() => setPresent(true));
  }

  function select(next: number) {
    setIndex(Math.min(CREATE_MODES.length - 1, Math.max(0, next)));
  }

  useEffect(() => {
    if (!open) return;
    setIndex(createDefaultIndex());
    const frame = requestAnimationFrame(() => {
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
        setIndex((current) => Math.min(CREATE_MODES.length - 1, Math.max(0, current + dir)));
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

  const trigger =
    variant === "header" ? (
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-accent/10 px-2.5 text-sm font-medium text-link ring-1 ring-inset ring-accent/15 hover:bg-accent/15"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openPicker}
      >
        <Icon name="plus" className="h-3.5 w-3.5" strokeWidth={2.25} />
        {label}
      </button>
    ) : (
      <button
        ref={triggerRef}
        type="button"
        className={`absolute left-1 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full active:bg-soft md:hidden ${creating ? "bg-soft text-ink" : "text-muted"}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-current={creating ? "page" : undefined}
        aria-label={tx(locale, "新增", "Create")}
        onClick={openPicker}
      >
        <Icon name="plus" className="h-[18px] w-[18px]" />
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
        <span />
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6">
        <div role="tablist" aria-label={tx(locale, "新增", "Create")} className="inline-flex rounded-full bg-white/10 p-1">
          {CREATE_MODES.map((item, i) => (
            <button
              key={item.id}
              id={`create-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-controls="create-panel"
              className={`min-h-9 rounded-full px-3.5 text-sm font-semibold ${i === index ? "bg-white text-[#0F172A]" : "text-white/75"}`}
              onClick={() => select(i)}
            >
              {tx(locale, item.zh, item.en)}
            </button>
          ))}
        </div>
        <article
          id="create-panel"
          role="tabpanel"
          aria-labelledby={`create-tab-${mode.id}`}
          className="mt-8 flex w-[min(18rem,84vw)] flex-col items-center rounded-2xl border border-white/10 bg-[#1E293B] px-5 py-8 text-center text-white"
        >
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-accent text-white">
            <Icon name={mode.icon} className="h-8 w-8" strokeWidth={1.6} />
          </span>
          <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight">{tx(locale, mode.zh, mode.en)}</h2>
          <p className="mt-1.5 text-sm text-white/70">{tx(locale, mode.hintZh, mode.hintEn)}</p>
        </article>
        <p className="sr-only" aria-live="polite">
          {tx(locale, mode.zh, mode.en)}
        </p>
      </div>

      <div className="flex justify-center px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
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
    </div>
  );

  return (
    <>
      {trigger}
      {open ? createPortal(dialog, document.body) : null}
    </>
  );
}
