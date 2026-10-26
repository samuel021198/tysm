import { LoginForm } from "@/components/login-form";
import { PrefToggles } from "@/components/shell";
import { getPrefs, getViewer } from "@/lib/auth";
import { redirect } from "next/navigation";
import { tx } from "@/lib/i18n";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  const next = sp.next && sp.next.startsWith("/") ? sp.next : "/";
  if (viewer) redirect(next);
  return (
    <div className="mx-auto max-w-md pt-2">
      <div className="surface px-5 py-6 md:px-7 md:py-8">
        <p className="font-display text-xs font-semibold tracking-[0.16em] text-accent">TYSM</p>
        <h1 className="accent mt-2 text-3xl font-bold">{tx(prefs.locale, "登入 TYSM", "Log in to TYSM")}</h1>
        <p className="mt-2 text-sm text-muted">{tx(prefs.locale, "用電郵或香港電話登入，然後輸入驗證碼。", "Use your email or Hong Kong phone, then enter the code.")}</p>
        <div className="mt-6">
          <LoginForm locale={prefs.locale} next={next} />
        </div>
        <div className="mt-4 flex justify-end md:hidden">
          <PrefToggles locale={prefs.locale} theme={prefs.theme} />
        </div>
      </div>
    </div>
  );
}
