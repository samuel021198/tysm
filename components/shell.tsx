import Link from "next/link";
import { logout, setPrefs } from "@/actions/auth";
import type { User } from "@prisma/client";
import { errText, navLabels, tx, type Locale } from "@/lib/i18n";
import { CreatePicker } from "./create-picker";
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
    <header className="site-header sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
      <div>
        <CreatePicker locale={locale} loggedIn={Boolean(user)} variant="corner" />
        <div className="mx-auto flex h-12 max-w-6xl items-center gap-1 pl-14 pr-2 md:h-14 md:gap-2.5 md:px-4">
          <Link href="/" className="min-w-0 shrink pr-1">
            <img
              src={theme === "dark" ? "/brand/tysm-wordmark-on-dark.png" : "/brand/tysm-wordmark.png"}
              alt="TYSM"
              className="h-7 w-auto max-w-full bg-transparent md:h-8"
            />
          </Link>
          <div className="mx-auto hidden min-w-0 max-w-xl flex-1 md:block">
            <SearchBox locale={locale} />
          </div>
          <div className="ml-auto flex items-center md:hidden">
            <Link href="/cart" aria-label={nav.cart} className="relative grid h-10 w-10 place-items-center rounded-full active:bg-soft">
              <Icon name="bag" className="h-[18px] w-[18px]" />
              {cartCount ? <Count n={cartCount} /> : null}
            </Link>
            <Link href="/notifications" aria-label={nav.notifications} className="relative grid h-10 w-10 place-items-center rounded-full active:bg-soft">
              <Icon name="bell" className="h-[18px] w-[18px]" />
              {unread ? <Count n={unread} /> : null}
            </Link>
          </div>
          <nav className="ml-auto hidden items-center gap-x-4 text-sm font-medium text-muted md:flex">
            <Link className="hover:text-ink" href="/market">{nav.search}</Link>
            <Link className="hover:text-ink" href="/dex">{nav.dex}</Link>
            <CreatePicker locale={locale} loggedIn={Boolean(user)} variant="header" label={nav.sell} />
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
          <div className="hidden md:block">
            <PrefToggles locale={locale} theme={theme} />
          </div>
        </div>
      </div>
    </header>
  );
}

export function PrefToggles({ locale, theme }: { locale: Locale; theme: "light" | "dark" }) {
  return (
    <form action={setPrefs} className="flex items-center">
      <button className="grid h-10 min-w-10 place-items-center rounded-full px-2 text-xs font-semibold leading-none text-muted" name="locale" value={locale === "en" ? "zh-HK" : "en"}>
        {locale === "en" ? "中" : "EN"}
      </button>
      <button
        className="grid h-10 w-10 place-items-center rounded-full text-muted"
        name="theme"
        value={theme === "dark" ? "light" : "dark"}
        aria-label={theme === "dark" ? tx(locale, "淺色", "Light") : tx(locale, "深色", "Dark")}
      >
        <Icon name={theme === "dark" ? "sun" : "moon"} className="h-[18px] w-[18px]" />
      </button>
    </form>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="absolute right-0 top-0 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-accent px-0.5 text-[9px] font-bold leading-none text-white">
      {n > 9 ? "9+" : n}
    </span>
  );
}

export function Footer({ locale }: { locale: Locale }) {
  return (
    <footer className="mt-6 text-muted md:mt-12">
      <div className="mx-auto max-w-6xl px-4 py-4 text-center md:flex md:items-center md:justify-start md:gap-4 md:py-5 md:text-left">
        <p className="font-display text-sm tracking-wide">TYSM</p>
        <p className="mt-2 flex justify-center gap-4 text-xs md:mt-0">
          <Link className="inline-flex min-h-11 items-center md:min-h-0" href="/faq">FAQ</Link>
          <Link className="inline-flex min-h-11 items-center md:min-h-0" href="/terms">{tx(locale, "條款", "Terms")}</Link>
          <Link className="inline-flex min-h-11 items-center md:min-h-0" href="/privacy">{tx(locale, "私隱", "Privacy")}</Link>
        </p>
      </div>
    </footer>
  );
}

export function Flash({ locale, ok, err }: { locale: Locale; ok?: string; err?: string }) {
  const success: Record<string, [string, string]> = {
    saved: ["已儲存", "Saved"],
    published: ["已刊登，而家公開", "Published. It is live now"],
    story: ["限時動態已發佈，24 小時後消失", "Story posted. It disappears in 24 hours"],
    collected: ["已加入收藏", "Added to your collection"],
    posted: ["已發到動態", "Posted"],
    draft: ["已存草稿，未有公開", "Draft saved. Not live yet"],
    scheduled: ["已預約刊登，未有即時公開", "Scheduled. Not live yet"],
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
