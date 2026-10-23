"use client";

import { tx, type Locale } from "@/lib/i18n";

export function OtpChip({ locale, code, inputId }: { locale: Locale; code: string; inputId: string }) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-3 rounded-xl bg-soft px-3 py-2 text-left text-sm"
      onClick={() => {
        const input = document.getElementById(inputId);
        if (!(input instanceof HTMLInputElement)) return;
        input.value = code;
        input.focus();
      }}
    >
      <span>
        <span className="block text-xs text-muted">{tx(locale, "示範驗證碼", "Demo code")}</span>
        <span className="font-mono text-base font-semibold tracking-[0.18em]">{code}</span>
      </span>
      <span className="shrink-0 whitespace-nowrap text-xs text-link">{tx(locale, "填入", "Fill")}</span>
    </button>
  );
}
