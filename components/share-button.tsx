"use client";

import { useState } from "react";

export async function shareUrl(path: string): Promise<"shared" | "copied" | "aborted" | "failed"> {
  const url = new URL(path, window.location.origin).toString();
  try {
    if (navigator.share) {
      await navigator.share({ url });
      return "shared";
    }
  } catch {
    return "aborted";
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

export function ShareButton({ path, label, copiedLabel, icon = false }: { path: string; label: string; copiedLabel: string; icon?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={icon ? (copied ? copiedLabel : label) : undefined}
      className={icon ? "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-soft text-ink" : "inline-flex h-10 flex-1 items-center justify-center text-sm font-medium leading-none"}
      onClick={async () => {
        const result = await shareUrl(path);
        if (result !== "copied") return;
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {icon ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
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
