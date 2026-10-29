import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { clearHistory, logout, saveNotifications, saveShop, setPrefs } from "@/actions/auth";
import { unblockUser } from "@/actions/social";
import { PushToggle } from "@/components/push-toggle";
import { PhoneForm } from "@/components/phone-form";
import { Flash } from "@/components/shell";
import { getPrefs, getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DEAL_RISK } from "@/lib/deal-phase";
import { DISTRICTS } from "@/lib/format";
import { tx } from "@/lib/i18n";

const SECTIONS = ["notifications", "account", "privacy", "language", "theme", "about", "delete"] as const;
type Section = (typeof SECTIONS)[number];

export default async function SettingsSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { section } = await params;
  if (!SECTIONS.includes(section as Section)) notFound();
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect(`/login?next=/me/settings/${section}`);
  const locale = prefs.locale;
  const titles: Record<Section, [string, string]> = {
    notifications: ["通知", "Notifications"],
    account: ["帳號與安全", "Account and security"],
    privacy: ["隱私", "Privacy"],
    language: ["語言", "Language"],
    theme: ["深淺色", "Appearance"],
    about: ["關於／條款／免責", "About, terms, disclaimer"],
    delete: ["刪除帳號", "Delete account"],
  };
  const key = section as Section;
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || "";
  const pushOn =
    key === "notifications" && vapidPublic
      ? (await prisma.pushSubscription.count({ where: { userId: viewer.id } })) > 0
      : false;
  const blocked =
    key === "privacy"
      ? await prisma.block.findMany({
          where: { blockerId: viewer.id },
          orderBy: { createdAt: "desc" },
          select: { id: true, blocked: { select: { id: true, nickname: true } } },
        })
      : [];
  return (
    <div className="mx-auto grid max-w-lg gap-3">
      <Link href="/me/settings" className="text-xs font-semibold text-link">{tx(locale, "返回設定", "Back to settings")}</Link>
      <h1 className="text-lg font-semibold">{tx(locale, titles[key][0], titles[key][1])}</h1>
      <Flash locale={locale} ok={sp.ok} err={sp.err} />
      {key === "notifications" ? <Notifications locale={locale} viewer={viewer} vapidPublic={vapidPublic} pushOn={pushOn} /> : null}
      {key === "account" ? <Account locale={locale} viewer={viewer} /> : null}
      {key === "privacy" ? <Privacy locale={locale} blocked={blocked} /> : null}
      {key === "language" ? <Language locale={locale} /> : null}
      {key === "theme" ? <Theme locale={locale} theme={prefs.theme} /> : null}
      {key === "about" ? <About locale={locale} /> : null}
      {key === "delete" ? <Delete locale={locale} /> : null}
    </div>
  );
}

function Notifications({
  locale,
  viewer,
  vapidPublic,
  pushOn,
}: {
  locale: "zh-HK" | "en";
  viewer: { notifyBids: boolean; notifyOffers: boolean; notifyOrders: boolean; notifyMessages: boolean; notifyEmail: boolean };
  vapidPublic: string;
  pushOn: boolean;
}) {
  return (
    <div className="surface grid gap-2 p-3 text-sm">
      <form action={saveNotifications} className="grid gap-2">
        <Link href="/notifications" className="text-sm font-semibold text-link">{tx(locale, "開啟通知清單", "Open notifications")}</Link>
        <label className="text-xs"><input type="checkbox" name="notifyBids" defaultChecked={viewer.notifyBids} /> {tx(locale, "出價通知", "Bid alerts")}</label>
        <label className="text-xs"><input type="checkbox" name="notifyOffers" defaultChecked={viewer.notifyOffers} /> {tx(locale, "傾交收通知", "Offer alerts")}</label>
        <label className="text-xs"><input type="checkbox" name="notifyOrders" defaultChecked={viewer.notifyOrders} /> {tx(locale, "交收通知", "Handover alerts")}</label>
        <label className="text-xs"><input type="checkbox" name="notifyMessages" defaultChecked={viewer.notifyMessages} /> {tx(locale, "訊息通知", "Message alerts")}</label>
        <label className="text-xs"><input type="checkbox" name="notifyEmail" defaultChecked={viewer.notifyEmail} /> {tx(locale, "電郵通知", "Email alerts")}</label>
        <button className="btn btn-primary w-fit">{tx(locale, "儲存", "Save")}</button>
      </form>
      {vapidPublic ? <PushToggle locale={locale} vapidPublic={vapidPublic} on={pushOn} /> : null}
    </div>
  );
}

function Account({
  locale,
  viewer,
}: {
  locale: "zh-HK" | "en";
  viewer: {
    id: string;
    email: string | null;
    phone: string | null;
    phoneVerified: boolean;
    role: string;
    storeName: string | null;
    storeDistrict: string | null;
    storeLine1: string | null;
    storeHours: string | null;
  };
}) {
  return (
    <div className="grid gap-3">
      <Link href="/me/settings/verify" className="surface flex h-11 items-center justify-between px-3 text-[13px] font-medium">
        {tx(locale, "申請認證", "Apply for verification")}
        <span className="text-sm leading-none text-muted" aria-hidden>›</span>
      </Link>
      <section className="surface grid gap-1 p-3 text-sm">
        <p>{viewer.email || tx(locale, "未有電郵", "No email")}</p>
        <p>{viewer.phoneVerified && viewer.phone ? viewer.phone : tx(locale, "電話未驗證", "Phone not verified")}</p>
        {viewer.role === "ADMIN" ? <Link href="/admin" className="font-semibold text-link">{tx(locale, "管理", "Admin")}</Link> : null}
      </section>
      {viewer.phoneVerified ? null : <PhoneForm locale={locale} next="/me/settings/account" />}
      <form action={logout}>
        <button className="btn btn-ghost w-full">{tx(locale, "登出", "Log out")}</button>
      </form>
      <form action={saveShop} id="store" className="surface grid gap-2 p-3">
        <h2 className="text-sm font-semibold">{tx(locale, "店舖自取", "Shop pickup")}</h2>
        <p className="text-xs text-muted">{tx(locale, "呢個地址只會喺交收時俾買家睇，唔會出喺公開個人檔案。公開頁只顯示交收地區。", "Buyers see this during handover. It is not on your public profile. The public page shows the handover area only.")}</p>
        <input className="field" name="storeName" defaultValue={viewer.storeName || ""} placeholder={tx(locale, "店名（可選）", "Shop name (optional)")} maxLength={40} />
        <select className="field" name="storeDistrict" defaultValue={viewer.storeDistrict || ""}>
          <option value="">{tx(locale, "店舖地區", "Shop district")}</option>
          {DISTRICTS.map(([zh, en]) => (
            <option key={zh} value={zh}>{locale === "en" ? en : zh}</option>
          ))}
        </select>
        <input className="field" name="storeLine1" defaultValue={viewer.storeLine1 || ""} placeholder={tx(locale, "店舖地址", "Shop address")} maxLength={120} />
        <input className="field" name="storeHours" defaultValue={viewer.storeHours || ""} placeholder={tx(locale, "營業時間（可選）", "Hours (optional)")} maxLength={80} />
        <button className="btn btn-primary w-fit">{tx(locale, "儲存", "Save")}</button>
      </form>
    </div>
  );
}

function Privacy({
  locale,
  blocked,
}: {
  locale: "zh-HK" | "en";
  blocked: { id: string; blocked: { id: string; nickname: string } }[];
}) {
  return (
    <div className="grid gap-3">
      <p className="text-sm leading-6 text-muted">{tx(locale, "公開個人檔案只顯示地區或商場。街號同門牌唔會放上個人頁。", "Your public profile shows a district or mall. Street and door numbers stay off the profile.")}</p>
      <section className="surface overflow-hidden">
        <h2 className="px-3 pt-3 text-sm font-semibold">{tx(locale, "已封鎖", "Blocked")}</h2>
        {blocked.length === 0 ? <p className="px-3 py-3 text-sm text-muted">{tx(locale, "未有封鎖。", "No blocked members.")}</p> : null}
        <ul className="divide-y divide-line">
          {blocked.map((row) => (
            <li key={row.id} className="flex h-11 items-center justify-between gap-3 px-3">
              <span className="truncate text-sm">{row.blocked.nickname}</span>
              <form action={unblockUser}>
                <input type="hidden" name="userId" value={row.blocked.id} />
                <button className="text-sm font-semibold text-link">{tx(locale, "解除封鎖", "Unblock")}</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
      <form action={clearHistory}>
        <button className="text-sm font-semibold text-link">{tx(locale, "清除瀏覽紀錄", "Clear browse history")}</button>
      </form>
    </div>
  );
}

function Language({ locale }: { locale: "zh-HK" | "en" }) {
  return (
    <form action={setPrefs} className="grid grid-cols-2 gap-2">
      <button className={`btn ${locale === "zh-HK" ? "btn-primary" : "btn-ghost"}`} name="locale" value="zh-HK">繁體中文</button>
      <button className={`btn ${locale === "en" ? "btn-primary" : "btn-ghost"}`} name="locale" value="en">English</button>
    </form>
  );
}

function Theme({ locale, theme }: { locale: "zh-HK" | "en"; theme: "light" | "dark" }) {
  return (
    <form action={setPrefs} className="grid grid-cols-2 gap-2">
      <button className={`btn ${theme === "light" ? "btn-primary" : "btn-ghost"}`} name="theme" value="light">{tx(locale, "淺色", "Light")}</button>
      <button className={`btn ${theme === "dark" ? "btn-primary" : "btn-ghost"}`} name="theme" value="dark">{tx(locale, "深色", "Dark")}</button>
    </form>
  );
}

function About({ locale }: { locale: "zh-HK" | "en" }) {
  const links = [
    ["/faq", "FAQ", "FAQ"],
    ["/terms", "條款", "Terms"],
    ["/privacy", "私隱", "Privacy"],
  ] as const;
  return (
    <div className="grid gap-3">
      <nav className="surface divide-y divide-line overflow-hidden">
        {links.map(([href, zh, en]) => (
          <Link key={href} href={href} className="flex h-11 items-center px-3 text-sm font-medium">{tx(locale, zh, en)}</Link>
        ))}
      </nav>
      <p className="text-sm leading-6">{DEAL_RISK}</p>
    </div>
  );
}

function Delete({ locale }: { locale: "zh-HK" | "en" }) {
  return (
    <p className="text-sm leading-6 text-danger">
      {tx(locale, "刪除帳戶或匯出資料請聯絡管理員：", "To delete your account or export data, contact the admin: ")}
      {process.env.ADMIN_EMAIL || "admin@tysm.hk"}
    </p>
  );
}
