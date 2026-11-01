import { LoginForm } from "@/components/login-form";
import { PrefToggles } from "@/components/shell";
import { getPrefs, getViewer } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; err?: string }> }) {
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  const next = sp.next && sp.next.startsWith("/") ? sp.next : "/";
  if (viewer) redirect(next);
  return (
    <div className="mx-auto max-w-md pt-2">
      <div className="surface px-5 py-6 md:px-7 md:py-8">
        <LoginForm locale={prefs.locale} next={next} notice={sp.err} />
        <div className="mt-4 flex justify-end md:hidden">
          <PrefToggles locale={prefs.locale} theme={prefs.theme} />
        </div>
      </div>
    </div>
  );
}
