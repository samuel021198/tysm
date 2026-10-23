"use client";

import { tx, type Locale } from "@/lib/i18n";

export function OtpChip({ locale, code, inputId }: { locale: Locale; code: string; inputId: string }) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-3 rounded-2xl bg-[#1b1418] px-4 py-3 text-left text-[#fff8f4] ring-2 ring-[#7cb9c8]"
      onClick={() => {
        const input = document.getElementById(inputId);
        if (!(input instanceof HTMLInputElement)) return;
        input.value = code;
        input.focus();
      }}
    >
      <span>
        <span className="block text-xs font-medium text-[#d7eef3]">{tx(locale, "驗證碼", "Code")}</span>
        <span className="font-mono text-2xl font-bold tracking-[0.22em]">{code}</span>
      </span>
      <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-[#9fd4e0]">{tx(locale, "點一下填入", "Tap to fill")}</span>
    </button>
  );
}
