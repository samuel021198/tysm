import { LoginForm } from "@/components/login-form";
import { getPrefs, getViewer } from "@/lib/auth";
import { redirect } from "next/navigation";
import { tx } from "@/lib/i18n";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  const next = sp.next && sp.next.startsWith("/") ? sp.next : "/";
  if (viewer) redirect(next);
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-2xl font-semibold">{tx(prefs.locale, "登入 TYSM", "Log in to TYSM")}</h1>
      <LoginForm locale={prefs.locale} next={next} />
    </div>
  );
}
