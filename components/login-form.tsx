"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { loginWithPassword, registerWithPassword } from "@/actions/auth";
import { Submit } from "./submit";
import { errText, tx, type Locale } from "@/lib/i18n";

function FieldError({ locale, code }: { locale: Locale; code?: string }) {
  if (!code) return null;
  return <p className="text-sm text-danger">{errText(locale, code)}</p>;
}

function LoginMode({ locale, next, notice, onRegister }: { locale: Locale; next: string; notice?: string; onRegister: () => void }) {
  const [state, action] = useActionState(loginWithPassword, null);
  const error = state?.error;
  return (
    <>
      <h1 className="accent mt-2 text-[1.3rem] font-bold">{tx(locale, "登入 TSM", "Log in to TSM")}</h1>
      <p className="mt-2 text-sm text-muted">{tx(locale, "用香港電話與密碼登入。管理員請輸入帳號 admin。", "Sign in with your Hong Kong phone and password. Admins enter the account admin.")}</p>
      <form action={action} className="mt-6 grid gap-3" noValidate>
        <input type="hidden" name="next" value={next} />
        <label className="grid gap-1 text-sm">
          {tx(locale, "電話／帳號", "Phone / account")}
          <input className="field" name="account" inputMode="tel" placeholder="91234567" autoComplete="username" />
          <FieldError locale={locale} code={error === "phone_format" ? error : undefined} />
        </label>
        <label className="grid gap-1 text-sm">
          {tx(locale, "密碼", "Password")}
          <input className="field" name="password" type="password" autoComplete="current-password" />
          <FieldError locale={locale} code={error === "password_short" ? error : undefined} />
        </label>
        {error === "credentials" || error === "disabled" ? <FieldError locale={locale} code={error} /> : notice ? <FieldError locale={locale} code={notice} /> : null}
        <Submit label={tx(locale, "登入", "Log in")} pendingLabel="…" />
      </form>
      <p className="mt-4 text-sm">
        <button type="button" className="text-link underline" onClick={onRegister}>
          {tx(locale, "尚未有帳號？註冊", "No account yet? Register")}
        </button>
      </p>
    </>
  );
}

function RegisterMode({ locale, next, onLogin }: { locale: Locale; next: string; onLogin: () => void }) {
  const [state, action] = useActionState(registerWithPassword, null);
  const error = state?.error;
  return (
    <>
      <h1 className="accent mt-2 text-[1.3rem] font-bold">{tx(locale, "註冊 TSM", "Register for TSM")}</h1>
      <p className="mt-2 text-sm text-muted">{tx(locale, "一個電話號碼對應一個帳號。", "One phone number is one account.")}</p>
      <form action={action} className="mt-6 grid gap-3" noValidate>
        <input type="hidden" name="next" value={next} />
        <label className="grid gap-1 text-sm">
          {tx(locale, "電話號碼", "Phone number")}
          <input className="field" name="phone" inputMode="tel" autoComplete="tel" />
          <FieldError locale={locale} code={error === "phone_format" || error === "phone_taken" ? error : undefined} />
        </label>
        <label className="grid gap-1 text-sm">
          {tx(locale, "密碼", "Password")}
          <input className="field" name="password" type="password" autoComplete="new-password" />
          <FieldError locale={locale} code={error === "password_short" ? error : undefined} />
        </label>
        <label className="grid gap-1 text-sm">
          {tx(locale, "確認密碼", "Confirm password")}
          <input className="field" name="confirm" type="password" autoComplete="new-password" />
          <FieldError locale={locale} code={error === "password_mismatch" ? error : undefined} />
        </label>
        <label className="grid gap-1 text-sm">
          {tx(locale, "暱稱", "Nickname")}
          <input className="field" name="nickname" maxLength={24} autoComplete="nickname" />
          <FieldError locale={locale} code={error === "nickname_required" || error === "nickname" ? error : undefined} />
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
            <FieldError locale={locale} code={error === "terms_tick" ? error : undefined} />
          </span>
        </label>
        <Submit label={tx(locale, "註冊", "Register")} pendingLabel="…" />
      </form>
      <p className="mt-4 text-sm">
        <button type="button" className="text-link underline" onClick={onLogin}>
          {tx(locale, "已有帳號？登入", "Already have an account? Log in")}
        </button>
      </p>
    </>
  );
}

export function LoginForm({ locale, next, notice }: { locale: Locale; next: string; notice?: string }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  return (
    <div>
      <p className="font-display text-xs font-semibold tracking-[0.16em] text-accent">TSM</p>
      {mode === "login" ? (
        <LoginMode locale={locale} next={next} notice={notice} onRegister={() => setMode("register")} />
      ) : (
        <RegisterMode locale={locale} next={next} onLogin={() => setMode("login")} />
      )}
    </div>
  );
}
