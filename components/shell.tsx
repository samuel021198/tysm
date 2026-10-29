import Link from "next/link";
import { logout, setPrefs } from "@/actions/auth";
import type { User } from "@prisma/client";
import { bidFloorText } from "@/lib/format";
import { errText, navLabels, tx, type Locale } from "@/lib/i18n";
import { CreatePicker } from "./create-picker";
import { HeaderMenu } from "./header-menu";
import { Icon } from "./icons";
import { SearchBox } from "./search-box";
import { TopBar } from "./top-bar";

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
  const item = "flex h-10 items-center justify-between gap-2 rounded-lg px-2.5 text-sm font-medium text-ink hover:bg-soft";
  return (
    <header className="site-header sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
      <TopBar locale={locale} loggedIn={Boolean(user)} unread={unread} />
      <div className="mx-auto hidden h-14 w-full max-w-6xl px-4 md:flex">
        <div className="mx-auto flex h-full w-full max-w-lg items-center">
          <div className="min-w-0 flex-1 pr-3">
            <SearchBox locale={locale} />
          </div>
          <Link href="/" className="relative z-10 shrink-0">
            <img src="/brand/tsm-monogram.png" alt="TSM" className="block h-10 w-auto bg-transparent" />
          </Link>
          <nav className="flex flex-1 items-center justify-end gap-2 pl-2 text-sm font-medium text-ink">
            <Link className="inline-flex h-10 shrink-0 items-center whitespace-nowrap hover:text-link" href="/shop">{tx(locale, "商店", "Shop")}</Link>
            <Link className="inline-flex h-10 shrink-0 items-center whitespace-nowrap hover:text-link" href="/news">{nav.news}</Link>
            <Link className="inline-flex h-10 shrink-0 items-center whitespace-nowrap hover:text-link" href="/rank">{nav.rank}</Link>
            <CreatePicker locale={locale} loggedIn={Boolean(user)} variant="header" label={nav.sell} />
            <Link href="/notifications" aria-label={unread ? `${nav.notifications} ${unread}` : nav.notifications} className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center hover:text-link">
              <Icon name="bell" className="h-[18px] w-[18px]" />
              {unread ? <Count n={unread} /> : null}
            </Link>
            <HeaderMenu label={user ? user.nickname : nav.profile} badge={cartCount}>
              {user ? (
                <Link className={item} href="/me">{user.nickname}</Link>
              ) : (
                <Link className={item} href="/login">{nav.login}</Link>
              )}
              <Link className={item} href="/cart">
                <span>{nav.cart}</span>
                {cartCount ? <Pill n={cartCount} /> : null}
              </Link>
              <Link className={item} href="/orders">{nav.orders}</Link>
              <Link className={item} href="/messages">{nav.messages}</Link>
              {user?.role === "ADMIN" ? <Link className={item} href="/admin">{nav.admin}</Link> : null}
              {user ? (
                <form action={logout}>
                  <button className="flex h-10 w-full items-center rounded-lg px-2.5 text-left text-sm font-medium text-muted hover:bg-soft hover:text-ink">{nav.logout}</button>
                </form>
              ) : null}
              <div className="mt-1 border-t border-line pt-1">
                <PrefToggles locale={locale} theme={theme} />
              </div>
            </HeaderMenu>
          </nav>
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
    <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-white">
      {n > 9 ? "9+" : n}
    </span>
  );
}

function Pill({ n }: { n: number }) {
  return (
    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent/15 px-1 text-[10px] font-semibold leading-none text-accent">
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function Footer({ locale }: { locale: Locale }) {
  return (
    <footer className="mt-6 text-muted md:mt-12">
      <div className="mx-auto max-w-6xl px-4 py-4 text-center md:flex md:items-center md:justify-start md:gap-4 md:py-5 md:text-left">
        <p className="font-display text-sm tracking-wide">TSM</p>
        <p className="mt-2 flex justify-center gap-4 text-xs md:mt-0">
          <Link className="inline-flex min-h-11 items-center md:min-h-0" href="/faq">FAQ</Link>
          <Link className="inline-flex min-h-11 items-center md:min-h-0" href="/terms">{tx(locale, "條款", "Terms")}</Link>
          <Link className="inline-flex min-h-11 items-center md:min-h-0" href="/privacy">{tx(locale, "私隱", "Privacy")}</Link>
        </p>
      </div>
    </footer>
  );
}

export function Flash({ locale, ok, err, minCents = null }: { locale: Locale; ok?: string; err?: string; minCents?: number | null }) {
  const success: Record<string, [string, string]> = {
    saved: ["已儲存", "Saved"],
    accepted: ["已接受。", "Accepted."],
    locked: ["已保留。", "Reserved."],
    reserved: ["已保留。", "Reserved."],
    released: ["已取消保留。", "Reservation cancelled."],
    offered: ["已提出議價", "Offer sent"],
    withdrawn: ["已撤回", "Withdrawn"],
    declined: ["已拒絕", "Declined"],
    handover: ["已確認交收。", "Handover confirmed."],
    published: ["已刊登，而家公開", "Published. It is live now"],
    story: ["限時動態已發佈，24 小時後消失", "Story posted. It disappears in 24 hours"],
    collected: ["已加入 My Binder", "Added to My Binder"],
    posted: ["已發到動態", "Posted"],
    deleted: ["已刪除貼文", "Post deleted"],
    draft: ["已存草稿，未有公開", "Draft saved. Not live yet"],
    scheduled: ["已預約刊登，未有即時公開", "Scheduled. Not live yet"],
    bid: ["出價已記錄", "Bid placed"],
    offer: ["傾交收已更新", "Handover updated"],
    paid: ["付款狀態已更新", "Payment updated"],
    done: ["交易已完成，可以評分。", "The handover is complete. You can rate."],
    dispute: ["爭議已提交", "Dispute submitted"],
    cart: ["已加入購物車", "Added to cart"],
    phone: ["電話已驗證", "Phone verified"],
    report: ["已收到", "Received"],
    review: ["評價已送出", "Review posted"],
    imported: ["CSV 已全部匯入", "CSV imported"],
    verify: ["已提交，審核中", "Submitted. In review"],
  };
  if (ok && success[ok]) {
    return <p role="status" className="mb-4 rounded-2xl bg-soft px-4 py-3 text-sm text-ok">{tx(locale, success[ok][0], success[ok][1])}</p>;
  }
  if (err) {
    return <p className="mb-4 rounded-2xl bg-soft px-4 py-3 text-sm text-danger">{bidFloorText(locale, err, minCents) ?? errText(locale, err)}</p>;
  }
  return null;
}
