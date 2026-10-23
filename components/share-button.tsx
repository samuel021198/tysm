"use client";

import { useState } from "react";

export function ShareButton({ path, label, copiedLabel }: { path: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="grid h-12 flex-1 place-items-center text-sm font-medium"
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
      {copied ? copiedLabel : label}
    </button>
  );
}
