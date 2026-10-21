"use client";

import { useActionState } from "react";
import { confirmPhone, requestPhoneOtp } from "@/actions/auth";
import { Submit } from "./submit";
import { errText, tx, type Locale } from "@/lib/i18n";

export function PhoneForm({ locale }: { locale: Locale }) {
  const [sent, send] = useActionState(requestPhoneOtp, null);
  const [done, confirm] = useActionState(confirmPhone, null);
  return (
    <div className="surface mx-auto grid max-w-lg gap-4 p-5">
      <h1 className="text-[1.65rem] font-bold">{tx(locale, "驗證電話先可以賣", "Verify your phone to sell")}</h1>
      <p className="text-sm text-muted">{tx(locale, "輸入 8 位香港電話。驗證碼會顯示在呢度。", "Enter an 8-digit Hong Kong number. The code is shown here.")}</p>
      <form action={send} className="grid gap-2">
        <input className="field" name="target" placeholder="91234567" required />
        <Submit label={tx(locale, "索取驗證碼", "Send code")} pendingLabel="…" />
        {sent?.error ? <p className="text-sm text-danger">{errText(locale, sent.error)}</p> : null}
        {sent?.code ? <p className="rounded-xl bg-soft px-3 py-2 text-sm">{tx(locale, "開發用驗證碼", "Dev code")}: <strong>{sent.code}</strong></p> : null}
      </form>
      <form action={confirm} className="grid gap-2">
        <input type="hidden" name="target" value={sent?.target || ""} />
        <input className="field" name="code" required />
        <Submit label={tx(locale, "驗證", "Verify")} pendingLabel="…" />
        {done?.error ? <p className="text-sm text-danger">{errText(locale, done.error)}</p> : null}
      </form>
    </div>
  );
}
