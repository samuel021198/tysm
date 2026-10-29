"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
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
  variant: "top" | "header";
  label?: string;
}) {
  const pathname = usePathname();
  const rootRef = useRef<HTMLDetailsElement>(null);
  const creating = pathname.startsWith("/sell") || pathname.startsWith("/add");

  useEffect(() => {
    function onPointer(event: PointerEvent) {
      const root = rootRef.current;
      if (!root?.open || !(event.target instanceof Node) || root.contains(event.target)) return;
      root.open = false;
    }
    function onKey(event: KeyboardEvent) {
      const root = rootRef.current;
      if (!root?.open || event.key !== "Escape") return;
      event.preventDefault();
      root.open = false;
      root.querySelector("summary")?.focus();
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function onToggle(event: React.ToggleEvent<HTMLDetailsElement>) {
    const root = event.currentTarget;
    if (!root.open) return;
    const id = CREATE_MODES[createDefaultIndex()]?.id;
    requestAnimationFrame(() => {
      root.querySelector<HTMLElement>(`[data-mode="${id}"]`)?.focus({ preventScroll: true });
    });
  }

  function onMenuKey(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const links = [...event.currentTarget.querySelectorAll<HTMLElement>("a[href]")];
    if (!links.length) return;
    event.preventDefault();
    const dir = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
    const current = links.findIndex((el) => el === document.activeElement);
    links[(current + dir + links.length) % links.length]?.focus({ preventScroll: true });
  }

  const rootClass = variant === "header" ? "relative shrink-0" : "relative";
  const summaryClass =
    variant === "header"
      ? "inline-flex h-9 shrink-0 cursor-pointer list-none items-center gap-1 whitespace-nowrap rounded-full bg-accent/10 px-2.5 text-sm font-medium text-link ring-1 ring-inset ring-accent/15 hover:bg-accent/15 [&::-webkit-details-marker]:hidden"
      : "grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full bg-accent text-white [&::-webkit-details-marker]:hidden";

  return (
    <details key={pathname} ref={rootRef} className={rootClass} onToggle={onToggle}>
      <summary
        className={summaryClass}
        aria-haspopup="menu"
        aria-label={variant === "header" && label ? undefined : tx(locale, "新增", "Create")}
        aria-current={variant === "top" && creating ? "page" : undefined}
      >
        <Icon
          name="plus"
          className={variant === "header" ? "h-3.5 w-3.5" : "h-[22px] w-[22px] text-white"}
          strokeWidth={variant === "header" ? 2.25 : 2}
        />
        {variant === "header" ? label : null}
      </summary>
      <div
        role="menu"
        aria-label={tx(locale, "新增", "Create")}
        onKeyDown={onMenuKey}
        className={`absolute top-full z-50 w-64 rounded-xl border border-line bg-card p-1 text-ink shadow-card ${variant === "header" ? "right-0 mt-4" : "left-1/2 mt-1 -translate-x-1/2"}`}
      >
        {CREATE_MODES.map((item) => (
          <Link
            key={item.id}
            href={createDest(item.href, loggedIn)}
            data-mode={item.id}
            role="menuitem"
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-soft focus:bg-soft"
            onClick={() => {
              if (rootRef.current) rootRef.current.open = false;
            }}
          >
            <Icon name={item.icon} className="h-4 w-4 shrink-0 text-muted" />
            <span className="min-w-0">
              <span className="block text-sm font-medium leading-tight">{tx(locale, item.zh, item.en)}</span>
              <span className="mt-0.5 block text-xs leading-snug text-muted">{tx(locale, item.hintZh, item.hintEn)}</span>
            </span>
          </Link>
        ))}
      </div>
    </details>
  );
}
