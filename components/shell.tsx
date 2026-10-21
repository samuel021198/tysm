import Link from "next/link";
import { logout, setPrefs } from "@/actions/auth";
import type { User } from "@prisma/client";
import { errText, navLabels, tx, type Locale } from "@/lib/i18n";
import { Icon } from "./icons";
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
  return (
    <header className="sticky top-0 z-30 pt-[env(safe-area-inset-top)]">
      <div className="bg-bg">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 overflow-x-auto px-3 md:h-16 md:gap-3 md:px-5">
          <Link href="/" className="shrink-0 pr-1">
            <img src="/brand/tysm-wordmark.png" alt="TYSM" className="h-8 w-auto bg-transparent sm:h-9 md:h-10" />
          </Link>
          <div className="mx-auto hidden min-w-0 max-w-xl flex-1 md:block">
            <SearchBox locale={locale} />
          </div>
          <div className="ml-auto flex items-center md:hidden">
            <Link href="/cart" aria-label={nav.cart} className="relative grid h-11 w-11 place-items-center rounded-full active:bg-soft">
              <Icon name="bag" />
              {cartCount ? <Count n={cartCount} /> : null}
            </Link>
            <Link href="/notifications" aria-label={nav.notifications} className="relative grid h-11 w-11 place-items-center rounded-full active:bg-soft">
              <Icon name="bell" />
              {unread ? <Count n={unread} /> : null}
            </Link>
          </div>
          <nav className="ml-auto hidden items-center gap-x-4 text-sm font-medium text-muted md:flex">
            <Link className="hover:text-ink" href="/sell">{nav.sell}</Link>
            <Link className="hover:text-ink" href="/cart">{nav.cart}{cartCount ? ` (${cartCount})` : ""}</Link>
            <Link className="hover:text-ink" href="/orders">{nav.orders}</Link>
            <Link className="hover:text-ink" href="/messages">{nav.messages}</Link>
            <Link className="hover:text-ink" href="/notifications">{nav.notifications}{unread ? ` (${unread})` : ""}</Link>
            {user?.role === "ADMIN" ? <Link className="hover:text-ink" href="/admin">{nav.admin}</Link> : null}
            {user ? <Link className="font-medium text-ink" href="/me">{user.nickname}</Link> : <Link className="font-medium text-ink" href="/login">{nav.login}</Link>}
            {user ? (
              <form action={logout}>
                <button className="text-sm text-muted hover:text-ink">{nav.logout}</button>
              </form>
            ) : null}
          </nav>
          <form action={setPrefs} className="flex items-center">
            <button className="grid h-11 min-w-11 place-items-center rounded-full px-2 text-xs font-semibold text-muted" name="locale" value={locale === "en" ? "zh-HK" : "en"}>
              {locale === "en" ? "中" : "EN"}
            </button>
            <button
              className="grid h-11 w-11 place-items-center rounded-full text-muted"
              name="theme"
              value={theme === "dark" ? "light" : "dark"}
              aria-label={theme === "dark" ? tx(locale, "淺色", "Light") : tx(locale, "深色", "Dark")}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} className="h-5 w-5" />
            </button>
          </form>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-rose/70 to-teal/80" />
      </div>
    </header>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-gradient-to-br from-rose to-teal px-1 text-[10px] font-bold leading-none text-[#1b1418]">
      {n > 9 ? "9+" : n}
    </span>
  );
}

export function Footer({ locale }: { locale: Locale }) {
  return (
    <footer className="mt-14 text-xs text-muted md:mt-20">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-8 md:justify-start">
        <span className="font-display tracking-wide">TYSM · HKD</span>
        <Link className="inline-flex h-11 items-center" href="/faq">FAQ</Link>
        <Link className="inline-flex h-11 items-center" href="/terms">{tx(locale, "條款", "Terms")}</Link>
        <Link className="inline-flex h-11 items-center" href="/privacy">{tx(locale, "私隱", "Privacy")}</Link>
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
    return <p className="mb-4 rounded-2xl bg-soft px-4 py-3 text-sm text-ok">{tx(locale, success[ok][0], success[ok][1])}</p>;
  }
  if (err) {
    return <p className="mb-4 rounded-2xl bg-soft px-4 py-3 text-sm text-danger">{errText(locale, err)}</p>;
  }
  return null;
}
