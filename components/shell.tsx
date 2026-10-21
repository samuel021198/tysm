import Link from "next/link";
import { logout, setPrefs } from "@/actions/auth";
import type { User } from "@prisma/client";
import { errText, navLabels, tx, type Locale } from "@/lib/i18n";
import { SearchBox } from "./search-box";

export function Header({
  locale,
  theme,
  user,
  cartCount,
  unread,
}: {
  locale: Locale;
  theme: "light" | "dark";
  user: User | null;
  cartCount: number;
  unread: number;
}) {
  const nav = navLabels(locale);
  const links = [
    [nav.feed, "/"],
    [nav.search, "/search"],
    [nav.sell, "/sell"],
    [`${nav.cart}${cartCount ? ` (${cartCount})` : ""}`, "/cart"],
    [nav.orders, "/orders"],
    [nav.messages, "/messages"],
    [`${nav.notifications}${unread ? ` (${unread})` : ""}`, "/notifications"],
    [nav.favorites, "/me/favorites"],
    [nav.bids, "/me/bids"],
    [nav.profile, "/me"],
    ...(user?.role === "ADMIN" ? [[nav.admin, "/admin"] as const] : []),
  ] as const;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="shrink-0">
          <img src="/brand/tysm-wordmark.png" alt="TYSM" className="h-9 w-auto" />
        </Link>
        <div className="hidden min-w-0 flex-1 md:block">
          <SearchBox locale={locale} />
        </div>
        <nav className="ml-auto hidden items-center gap-3 text-sm md:flex">
          <Link href="/sell">{nav.sell}</Link>
          <Link href="/cart">{nav.cart}{cartCount ? ` (${cartCount})` : ""}</Link>
          <Link href="/orders">{nav.orders}</Link>
          <Link href="/messages">{nav.messages}</Link>
          <Link href="/notifications">{nav.notifications}{unread ? ` (${unread})` : ""}</Link>
          {user?.role === "ADMIN" ? <Link href="/admin">{nav.admin}</Link> : null}
          {user ? <Link href="/me">{user.nickname}</Link> : <Link href="/login">{nav.login}</Link>}
          {user ? (
            <form action={logout}>
              <button>{nav.logout}</button>
            </form>
          ) : null}
        </nav>
        <form action={setPrefs} className="flex items-center gap-1">
          <button className="btn-ghost btn px-3 py-1" name="locale" value={locale === "en" ? "zh-HK" : "en"}>
            {locale === "en" ? "中文" : "EN"}
          </button>
          <button className="btn-ghost btn px-3 py-1" name="theme" value={theme === "dark" ? "light" : "dark"}>
            {theme === "dark" ? tx(locale, "淺色", "Light") : tx(locale, "深色", "Dark")}
          </button>
        </form>
        <details className="relative md:hidden">
          <summary className="btn-ghost btn cursor-pointer list-none">{tx(locale, "選單", "Menu")}</summary>
          <div className="absolute right-0 z-20 mt-2 grid w-52 gap-2 rounded-2xl border border-line bg-card p-3 text-sm shadow">
            {links.map(([label, href]) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
            {user ? (
              <form action={logout}>
                <button>{nav.logout}</button>
              </form>
            ) : (
              <Link href="/login">{nav.login}</Link>
            )}
          </div>
        </details>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-3 md:hidden">
        <SearchBox locale={locale} />
      </div>
    </header>
  );
}

export function Footer({ locale }: { locale: Locale }) {
  return (
    <footer className="mt-16 border-t border-line py-8 text-sm text-muted">
      <div className="mx-auto flex max-w-6xl flex-wrap gap-4 px-4">
        <span>TYSM · HKD · Asia/Hong_Kong</span>
        <Link href="/faq">FAQ</Link>
        <Link href="/terms">{tx(locale, "條款", "Terms")}</Link>
        <Link href="/privacy">{tx(locale, "私隱", "Privacy")}</Link>
      </div>
    </footer>
  );
}

export function Flash({ locale, ok, err }: { locale: Locale; ok?: string; err?: string }) {
  const success: Record<string, [string, string]> = {
    saved: ["已儲存", "Saved"],
    bid: ["出價已記錄", "Bid placed"],
    offer: ["議價已更新", "Offer updated"],
    paid: ["付款狀態已更新", "Payment updated"],
    done: ["訂單已完成，託管已撥出（模擬）", "Order completed. Escrow released (mock)."],
    dispute: ["爭議已提交", "Dispute submitted"],
    cart: ["已加入購物車", "Added to cart"],
    phone: ["電話已驗證", "Phone verified"],
    report: ["已送出檢舉", "Report sent"],
    review: ["評價已送出", "Review posted"],
    imported: ["CSV 已全部匯入", "CSV imported"],
  };
  if (ok && success[ok]) {
    return <p className="mb-4 rounded-xl bg-soft px-3 py-2 text-sm text-ok">{tx(locale, success[ok][0], success[ok][1])}</p>;
  }
  if (err) {
    return <p className="mb-4 rounded-xl bg-soft px-3 py-2 text-sm text-danger">{errText(locale, err)}</p>;
  }
  return null;
}
