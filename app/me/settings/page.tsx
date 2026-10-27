import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { DISTRICTS } from "@/lib/format";
import { tx } from "@/lib/i18n";
import { Flash, PrefToggles } from "@/components/shell";
import { clearHistory, deleteAddress, logout, saveAddress, updateProfile } from "@/actions/auth";

export default async function MeSettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/me/settings");
  const [addresses, draftCount] = await Promise.all([
    prisma.address.findMany({ where: { userId: viewer.id }, orderBy: { isDefault: "desc" } }),
    prisma.listing.count({ where: { sellerId: viewer.id, status: { in: ["DRAFT", "SCHEDULED"] } } }),
  ]);
  const locale = prefs.locale;
  const lists: [string, string][] = [
    ["/me/favorites", tx(locale, "收藏", "Favorites")],
    ["/me/bids", tx(locale, "出價", "Bids")],
    ["/notifications", tx(locale, "通知", "Notifications")],
    ["/cart", tx(locale, "購物車", "Cart")],
    ...(viewer.role === "ADMIN" ? [["/admin", tx(locale, "管理", "Admin")] as [string, string]] : []),
  ];
  const commerce: [string, string][] = [
    ["/orders", tx(locale, "訂單", "Orders")],
    ["/me?tab=drafts", `${tx(locale, "草稿", "Drafts")}${draftCount ? ` (${draftCount})` : ""}`],
    ["#store", tx(locale, "店舖地址", "Shop address")],
  ];
  return (
    <div className="mx-auto grid max-w-lg gap-3">
      <div className="flex items-center justify-between gap-2">
        <Link href="/me" className="text-xs font-semibold text-link">{tx(locale, "返回個人頁", "Back to profile")}</Link>
        <PrefToggles locale={locale} theme={prefs.theme} />
      </div>
      <Flash locale={locale} ok={sp.ok} err={sp.err} />
      <section>
        <h2 className="mb-1 text-xs font-semibold text-muted">{tx(locale, "清單", "Lists")}</h2>
        <Menu rows={lists} />
      </section>
      <section>
        <h2 className="mb-1 text-xs font-semibold text-muted">{tx(locale, "買賣", "Buying and selling")}</h2>
        <Menu rows={commerce} />
      </section>
      <form action={updateProfile} className="surface grid gap-2 p-3">
        <h2 className="text-sm font-semibold">{tx(locale, "個人資料同收款", "Profile and payout")}</h2>
        <input className="field" name="nickname" defaultValue={viewer.nickname} required />
        <textarea className="field" name="bio" defaultValue={viewer.bio || ""} placeholder={tx(locale, "簡介", "Bio")} />
        <input className="field" name="avatarUrl" defaultValue={viewer.avatarUrl || ""} placeholder="https:// avatar" />
        <div className="grid gap-2 md:grid-cols-3">
          <input className="field" name="payoutMethod" defaultValue={viewer.payoutMethod || ""} placeholder="FPS / PayMe / Bank" />
          <input className="field" name="payoutHolder" defaultValue={viewer.payoutHolder || ""} placeholder={tx(locale, "戶名", "Account name")} />
          <input className="field" name="payoutAccount" defaultValue={viewer.payoutAccount || ""} placeholder={tx(locale, "帳戶", "Account")} />
        </div>
        <label className="text-xs"><input type="checkbox" name="notifyBids" defaultChecked={viewer.notifyBids} /> {tx(locale, "出價通知", "Bid alerts")}</label>
        <label className="text-xs"><input type="checkbox" name="notifyOffers" defaultChecked={viewer.notifyOffers} /> {tx(locale, "議價通知", "Offer alerts")}</label>
        <label className="text-xs"><input type="checkbox" name="notifyOrders" defaultChecked={viewer.notifyOrders} /> {tx(locale, "訂單通知", "Order alerts")}</label>
        <label className="text-xs"><input type="checkbox" name="notifyMessages" defaultChecked={viewer.notifyMessages} /> {tx(locale, "訊息通知", "Message alerts")}</label>
        <div id="store" className="grid gap-2 rounded-xl border border-line p-2.5">
          <h3 className="text-sm font-medium">{tx(locale, "店舖地址", "Shop address")}</h3>
          <p className="text-xs text-muted">{tx(locale, "店舖自取會用這個固定地址，買家結帳時見到。留空就代表未有店舖自取。", "Store pickup uses this fixed address. Buyers see it at checkout. Leave it blank if you do not offer pickup.")}</p>
          <input className="field" name="storeName" defaultValue={viewer.storeName || ""} placeholder={tx(locale, "店名（可選）", "Shop name (optional)")} maxLength={40} />
          <select className="field" name="storeDistrict" defaultValue={viewer.storeDistrict || ""}>
            <option value="">{tx(locale, "店舖地區", "Shop district")}</option>
            {DISTRICTS.map(([zh, en]) => (
              <option key={zh} value={zh}>{locale === "en" ? en : zh}</option>
            ))}
          </select>
          <input className="field" name="storeLine1" defaultValue={viewer.storeLine1 || ""} placeholder={tx(locale, "店舖地址", "Shop address")} maxLength={120} />
          <input className="field" name="storeHours" defaultValue={viewer.storeHours || ""} placeholder={tx(locale, "營業時間（可選）", "Hours (optional)")} maxLength={80} />
        </div>
        <button className="btn btn-primary w-fit">{tx(locale, "儲存", "Save")}</button>
      </form>
      <section id="addresses" className="surface grid gap-2 p-3">
        <h2 className="text-sm font-semibold">{tx(locale, "香港地址", "Hong Kong addresses")}</h2>
        <ul className="grid gap-1.5 text-xs">
          {addresses.map((address) => (
            <li key={address.id} className="flex items-center justify-between gap-2 rounded-xl border border-line px-2.5 py-1.5">
              <span className="min-w-0 break-words">{address.isDefault ? "★ " : ""}{address.recipient} · {address.district} {address.line1}</span>
              <form action={deleteAddress}><input type="hidden" name="id" value={address.id} /><button className="btn btn-ghost shrink-0">{tx(locale, "刪除", "Delete")}</button></form>
            </li>
          ))}
        </ul>
        <form action={saveAddress} className="grid gap-2">
          <input className="field" name="recipient" placeholder={tx(locale, "收件人", "Recipient")} required />
          <input className="field" name="phone" placeholder={tx(locale, "電話", "Phone")} required />
          <input className="field" name="line1" placeholder={tx(locale, "地址", "Address")} required />
          <select className="field" name="district" required defaultValue="">
            <option value="" disabled>{tx(locale, "地區", "District")}</option>
            {DISTRICTS.map(([zh, en]) => (
              <option key={zh} value={zh}>{locale === "en" ? en : zh}</option>
            ))}
          </select>
          <label className="text-xs"><input type="checkbox" name="isDefault" /> {tx(locale, "預設地址", "Default")}</label>
          <button className="btn-ghost btn w-fit">{tx(locale, "新增地址", "Add address")}</button>
        </form>
      </section>
      <form action={clearHistory}>
        <button className="text-xs text-muted underline">{tx(locale, "清除瀏覽紀錄", "Clear browse history")}</button>
      </form>
      <form action={logout}>
        <button className="btn btn-ghost w-full">{tx(locale, "登出", "Log out")}</button>
      </form>
      <p className="text-xs text-muted">
        {tx(locale, "刪除帳戶或匯出資料請聯絡管理員：", "To delete your account or export data, contact the admin: ")}
        {process.env.ADMIN_EMAIL || "admin@tysm.hk"}
      </p>
    </div>
  );
}

function Menu({ rows }: { rows: [string, string][] }) {
  return (
    <nav className="surface divide-y divide-line overflow-hidden">
      {rows.map(([href, label]) => {
        const className = "flex h-10 items-center justify-between px-3 text-[13px] font-medium";
        const inner = (
          <>
            {label}
            <span className="text-sm leading-none text-muted" aria-hidden>›</span>
          </>
        );
        return href.startsWith("#") ? (
          <a key={href} href={href} className={className}>{inner}</a>
        ) : (
          <Link key={href} href={href} className={className}>{inner}</Link>
        );
      })}
    </nav>
  );
}
