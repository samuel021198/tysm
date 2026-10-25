"use client";

import { useState } from "react";

export function ShareButton({ path, label, copiedLabel, icon = false }: { path: string; label: string; copiedLabel: string; icon?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={icon ? (copied ? copiedLabel : label) : undefined}
      className={icon ? "grid h-12 w-12 shrink-0 place-items-center rounded-full bg-soft text-ink" : "grid h-12 flex-1 place-items-center text-sm font-medium"}
      onClick={async () => {
        const url = new URL(path, window.location.origin).toString();
        try {
          if (navigator.share) {
            await navigator.share({ url });
            return;
          }
        } catch {
          return;
        }
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
    >
      {icon ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <circle cx="6" cy="12" r="2.1" />
          <circle cx="17" cy="7" r="2.1" />
          <circle cx="17" cy="17" r="2.1" />
          <path d="m8 11 7-3M8 13.2l7 2.8" />
        </svg>
      ) : copied ? (
        copiedLabel
      ) : (
        label
      )}
    </button>
  );
}
