import { enterDemo } from "@/actions/auth";
import { LoginForm } from "@/components/login-form";
import { PrefToggles } from "@/components/shell";
import { getPrefs, getViewer } from "@/lib/auth";
import { DEMO_ACCOUNTS, DEMO_CODE } from "@/lib/demo-login";
import { redirect } from "next/navigation";
import { errText, tx } from "@/lib/i18n";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; err?: string }> }) {
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  const next = sp.next && sp.next.startsWith("/") ? sp.next : "/";
  if (viewer) redirect(next);
  return (
    <div className="mx-auto max-w-md pt-2 pb-28">
      <div className="surface px-5 py-6 md:px-7 md:py-8">
        <p className="font-display text-xs font-semibold tracking-[0.16em] text-accent">TYSM</p>
        <h1 className="accent mt-2 text-[1.3rem] font-bold">{tx(prefs.locale, "登入 TYSM", "Log in to TYSM")}</h1>
        <p className="mt-2 text-sm text-muted">{tx(prefs.locale, "用電郵或香港電話登入，然後輸入驗證碼。", "Use your email or Hong Kong phone, then enter the code.")}</p>
        <div className="mt-6">
          <LoginForm locale={prefs.locale} next={next} />
        </div>
        <div className="mt-4 flex justify-end md:hidden">
          <PrefToggles locale={prefs.locale} theme={prefs.theme} />
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-[var(--tab-h)] z-30 border-t border-line bg-[var(--bg)] px-3 pb-3 pt-2 md:bottom-0">
        <div className="mx-auto max-w-md">
        <p className="text-center text-xs text-muted">{tx(prefs.locale, "示範帳戶", "Demo accounts")}</p>
        <p className="mt-1 text-center font-mono text-xs text-ink">{DEMO_CODE}</p>
        {sp.err ? <p className="mt-2 text-center text-sm text-danger">{errText(prefs.locale, sp.err)}</p> : null}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <form key={account.id} action={enterDemo}>
              <input type="hidden" name="userId" value={account.id} />
              <input type="hidden" name="next" value={next} />
              <button type="submit" className="btn btn-primary w-full">
                {account.nickname}
              </button>
            </form>
          ))}
        </div>
        </div>
      </div>
    </div>
  );
}
