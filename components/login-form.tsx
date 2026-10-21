"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestOtp, verifyOtp } from "@/actions/auth";
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
        {sent?.code ? (
          <p className="rounded-xl bg-soft px-3 py-2 text-sm">
            {tx(locale, "開發用驗證碼", "Dev code")}: <strong>{sent.code}</strong>
          </p>
        ) : null}
      </form>
      <form action={verify} className="grid gap-3">
        <input type="hidden" name="target" value={sent?.target || ""} />
        <input type="hidden" name="next" value={next} />
        <label className="grid gap-1 text-sm">
          {tx(locale, "驗證碼", "Code")}
          <input className="field" name="code" inputMode="numeric" required />
        </label>
        <label className="grid gap-1 text-sm">
          {tx(locale, "暱稱（新用戶）", "Nickname (new accounts)")}
          <input className="field" name="nickname" maxLength={24} />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="accept" className="mt-1" />
          <span>
            {tx(locale, "我已閱讀並同意", "I agree to the")} <Link href="/terms">{tx(locale, "條款", "Terms")}</Link> {tx(locale, "同", "and")}{" "}
            <Link href="/privacy">{tx(locale, "私隱政策", "Privacy Policy")}</Link>
            {tx(locale, "（新用戶必須勾選）", " (required for new accounts)")}
          </span>
        </label>
        <Submit label={tx(locale, "登入", "Log in")} pendingLabel="…" />
        {verified?.error ? <p className="text-sm text-danger">{errText(locale, verified.error)}</p> : null}
      </form>
      <div className="text-sm text-muted">
        <p>{tx(locale, "示範帳戶（先索取驗證碼，畫面上會顯示 6 位數字）", "Demo accounts (request a code; the 6 digits appear on screen)")}</p>
        <p>mei@tysm.hk · alex@tysm.hk · ming@tysm.hk · 91111111 · admin@tysm.hk</p>
      </div>
    </div>
  );
}
