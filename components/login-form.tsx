"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestOtp, verifyOtp } from "@/actions/auth";
import { OtpChip } from "./otp-chip";
import { Submit } from "./submit";
import { errText, tx, type Locale } from "@/lib/i18n";

export function LoginForm({ locale, next }: { locale: Locale; next: string }) {
  const [sent, send] = useActionState(requestOtp, null);
  const [verified, verify] = useActionState(verifyOtp, null);
  return (
    <div className="grid gap-6">
      <form action={send} className="grid gap-3">
        <label className="grid gap-1 text-sm">
          {tx(locale, "電郵或香港電話", "Email or Hong Kong phone")}
          <input className="field" name="target" required placeholder="name@email.com / 91234567" defaultValue={sent?.target} />
        </label>
        <Submit label={tx(locale, "索取驗證碼", "Send code")} pendingLabel="…" />
        {sent?.error ? <p className="text-sm text-danger">{errText(locale, sent.error)}</p> : null}
        {sent?.code ? <OtpChip locale={locale} code={sent.code} inputId="otp-code" /> : null}
      </form>
      <form action={verify} className="grid gap-3">
        <input type="hidden" name="target" value={sent?.target || ""} />
        <input type="hidden" name="next" value={next} />
        <label className="grid gap-1 text-sm">
          {tx(locale, "驗證碼", "Code")}
          <input id="otp-code" className="field" name="code" inputMode="numeric" autoComplete="one-time-code" required />
        </label>
        <label className="grid gap-1 text-sm">
          {tx(locale, "暱稱（新用戶）", "Nickname (new accounts)")}
          <input className="field" name="nickname" maxLength={24} />
        </label>
        <label className="flex items-start gap-3 text-sm leading-6">
          <input type="checkbox" name="accept" className="mt-0.5 h-5 w-5 shrink-0 accent-[#3d8ea3]" />
          <span>
            <span className="whitespace-nowrap">{tx(locale, "我同意", "I agree to")}</span>{" "}
            <Link href="/terms" className="whitespace-nowrap text-link underline">{tx(locale, "服務條款", "the Terms")}</Link>
            {" "}
            <span className="whitespace-nowrap">{tx(locale, "同", "and")}</span>{" "}
            <Link href="/privacy" className="whitespace-nowrap text-link underline">{tx(locale, "私隱政策", "Privacy")}</Link>
            <span className="mt-0.5 block whitespace-nowrap text-xs font-medium text-ink">{tx(locale, "新用戶須剔選", "Required for new accounts")}</span>
          </span>
        </label>
        <Submit label={tx(locale, "登入", "Log in")} pendingLabel="…" />
        {verified?.error ? <p className="text-sm text-danger">{errText(locale, verified.error)}</p> : null}
      </form>
      <div className="grid gap-1 text-sm leading-6 text-muted">
        <p className="font-medium text-ink">{tx(locale, "示範帳戶", "Demo accounts")}</p>
        <p>{tx(locale, "先索取驗證碼。", "Request a code first.")}</p>
        <p>{tx(locale, "6 位數字會顯示喺上面。", "The 6 digits appear above.")}</p>
        <p className="mt-1">mei@tysm.hk</p>
        <p>alex@tysm.hk</p>
        <p>ming@tysm.hk</p>
        <p>91111111</p>
        <p>admin@tysm.hk</p>
      </div>
    </div>
  );
}
