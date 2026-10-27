"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function ShareGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden>
      <circle cx="6" cy="12" r="2.1" />
      <circle cx="17" cy="7" r="2.1" />
      <circle cx="17" cy="17" r="2.1" />
      <path d="m8 11 7-3M8 13.2l7 2.8" />
    </svg>
  );
}

export function ShareSheet({
  path,
  label,
  copiedLabel,
  internalLabel,
  onClose,
}: {
  path: string;
  label: string;
  copiedLabel: string;
  internalLabel: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const row = "flex h-11 w-full items-center px-3 text-left text-sm font-medium";

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function external() {
    const url = new URL(path, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({ url });
        onClose();
        return;
      }
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(onClose, 900);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0F172A]/40 md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={label}
        className="w-full max-w-lg border border-line bg-card p-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:max-w-xs md:rounded-2xl md:pb-1.5"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={row}
          onClick={() => {
            onClose();
            router.push(`/messages?share=${encodeURIComponent(path)}`);
          }}
        >
          {internalLabel}
        </button>
        <button type="button" className={row} onClick={() => void external()}>
          {copied ? copiedLabel : label}
        </button>
      </div>
    </div>
  );
}

export function ShareButton({
  path,
  label,
  copiedLabel,
  internalLabel,
  icon = false,
  className,
}: {
  path: string;
  label: string;
  copiedLabel: string;
  internalLabel: string;
  icon?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const chrome = icon
    ? "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-soft text-ink"
    : "inline-flex h-10 flex-1 items-center justify-center text-sm font-medium leading-none";
  return (
    <>
      <button type="button" aria-label={label} title={label} className={className ?? chrome} onClick={() => setOpen(true)}>
        {icon ? <ShareGlyph /> : label}
      </button>
      {open ? (
        <ShareSheet path={path} label={label} copiedLabel={copiedLabel} internalLabel={internalLabel} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
