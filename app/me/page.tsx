import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { DISTRICTS } from "@/lib/format";
import { tx } from "@/lib/i18n";
import { Flash, PrefToggles } from "@/components/shell";
import { PhoneForm } from "@/components/phone-form";
import { clearHistory, deleteAddress, logout, saveAddress, updateProfile } from "@/actions/auth";

export default async function MePage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/me");
  const addresses = await prisma.address.findMany({ where: { userId: viewer.id }, orderBy: { isDefault: "desc" } });
  const following = await prisma.follow.count({ where: { followerId: viewer.id } });
  const locale = prefs.locale;
  return (
    <div className="grid max-w-3xl gap-8">
      <Flash locale={locale} ok={sp.ok} err={sp.err} />
      <div className="surface flex items-center gap-4 p-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-rose to-teal text-2xl font-bold text-[#1b1418]">
          {viewer.nickname.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{viewer.nickname}</h1>
          <p className="truncate text-sm text-muted">{viewer.email || tx(locale, "未有電郵", "No email")} · {viewer.phone || tx(locale, "未有電話", "No phone")} {viewer.phoneVerified ? "✓" : ""}</p>
          <p className="mt-1 text-sm text-muted">{tx(locale, "關注", "Following")} {following}</p>
        </div>
      </div>
      <PrefToggles locale={locale} theme={prefs.theme} />
      <nav className="grid gap-2">
        {[
          ["/me/favorites", tx(locale, "收藏", "Favorites")],
          ["/me/bids", tx(locale, "出價", "Bids")],
          ["/orders", tx(locale, "訂單", "Orders")],
          ["/notifications", tx(locale, "通知", "Notifications")],
          ["/cart", tx(locale, "購物車", "Cart")],
          ...(viewer.role === "ADMIN" ? [["/admin", tx(locale, "管理", "Admin")] as const] : []),
        ].map(([href, label]) => (
          <Link key={href} href={href} className="surface menu-row flex h-14 items-center justify-between px-4 font-medium">
            {label}
            <span className="text-muted" aria-hidden>›</span>
          </Link>
        ))}
      </nav>
      {!viewer.phoneVerified ? <PhoneForm locale={locale} /> : null}
      <form action={updateProfile} className="grid gap-3">
        <h2 className="font-semibold">{tx(locale, "個人資料同收款", "Profile and payout")}</h2>
        <input className="field" name="nickname" defaultValue={viewer.nickname} required />
        <textarea className="field" name="bio" defaultValue={viewer.bio || ""} placeholder={tx(locale, "簡介", "Bio")} />
        <input className="field" name="avatarUrl" defaultValue={viewer.avatarUrl || ""} placeholder="https:// avatar" />
        <div className="grid gap-2 md:grid-cols-3">
          <input className="field" name="payoutMethod" defaultValue={viewer.payoutMethod || ""} placeholder="FPS / PayMe / Bank" />
          <input className="field" name="payoutHolder" defaultValue={viewer.payoutHolder || ""} placeholder={tx(locale, "戶名", "Account name")} />
          <input className="field" name="payoutAccount" defaultValue={viewer.payoutAccount || ""} placeholder={tx(locale, "帳戶", "Account")} />
        </div>
        <label className="text-sm"><input type="checkbox" name="notifyBids" defaultChecked={viewer.notifyBids} /> {tx(locale, "出價通知", "Bid alerts")}</label>
        <label className="text-sm"><input type="checkbox" name="notifyOffers" defaultChecked={viewer.notifyOffers} /> {tx(locale, "議價通知", "Offer alerts")}</label>
        <label className="text-sm"><input type="checkbox" name="notifyOrders" defaultChecked={viewer.notifyOrders} /> {tx(locale, "訂單通知", "Order alerts")}</label>
        <label className="text-sm"><input type="checkbox" name="notifyMessages" defaultChecked={viewer.notifyMessages} /> {tx(locale, "訊息通知", "Message alerts")}</label>
        <button className="btn btn-primary w-fit">{tx(locale, "儲存", "Save")}</button>
      </form>
      <section id="addresses">
        <h2 className="mb-2 font-semibold">{tx(locale, "香港地址", "Hong Kong addresses")}</h2>
        <ul className="mb-3 grid gap-2 text-sm">
          {addresses.map((address) => (
            <li key={address.id} className="flex items-center justify-between gap-3 rounded-2xl bg-soft px-3 py-2">
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
          <label className="text-sm"><input type="checkbox" name="isDefault" /> {tx(locale, "預設地址", "Default")}</label>
          <button className="btn-ghost btn w-fit">{tx(locale, "新增地址", "Add address")}</button>
        </form>
      </section>
      <form action={clearHistory}>
        <button className="text-sm text-muted underline">{tx(locale, "清除瀏覽紀錄", "Clear browse history")}</button>
      </form>
      <form action={logout}>
        <button className="btn btn-ghost w-full">{tx(locale, "登出", "Log out")}</button>
      </form>
      <p className="text-sm text-muted">
        {tx(locale, "刪除帳戶或匯出資料請聯絡管理員：", "To delete your account or export data, contact the admin: ")}
        {process.env.ADMIN_EMAIL || "admin@tysm.hk"}
      </p>
    </div>
  );
}
