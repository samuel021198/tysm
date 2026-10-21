import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { formatHkd, formatHKT } from "@/lib/format";
import { bpsToPercentLabel } from "@/lib/rules";
import { listingStatusLabel, orderStatusLabel, tx } from "@/lib/i18n";
import { Flash } from "@/components/shell";
import { addCategory, adminDecide, adminUnlist, liftBan, resolveReport, setCommission } from "@/actions/admin";
import { getCommissionBps } from "@/lib/auth";

const tabs = ["overview", "users", "listings", "orders", "disputes", "reports", "categories", "commission"] as const;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/admin");
  if (viewer.role !== "ADMIN") redirect("/?err=forbidden");
  const tab = tabs.includes(sp.tab as (typeof tabs)[number]) ? (sp.tab as (typeof tabs)[number]) : "overview";
  const locale = prefs.locale;
  const [users, listings, orders, disputes, reports, groups, bps] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.listing.findMany({ orderBy: { createdAt: "desc" }, take: 40, include: { seller: true } }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 40, include: { buyer: true, seller: true } }),
    prisma.dispute.findMany({ orderBy: { createdAt: "desc" }, include: { order: true }, take: 30 }),
    prisma.report.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.category.findMany({ where: { level: "GROUP" }, orderBy: { sort: "asc" } }),
    getCommissionBps(),
  ]);

  return (
    <div>
      <Flash locale={locale} ok={sp.ok} err={sp.err} />
      <h1 className="mb-3 text-2xl font-semibold">{tx(locale, "管理", "Admin")}</h1>
      <nav className="mb-4 flex flex-wrap gap-3 text-sm">
        {tabs.map((item) => (
          <Link key={item} href={`/admin?tab=${item}`} className={item === tab ? "font-semibold" : ""}>
            {item}
          </Link>
        ))}
      </nav>
      {tab === "overview" ? (
        <p className="text-sm">
          {tx(locale, "用戶", "Users")} {users.length} · {tx(locale, "刊登", "Listings")} {listings.length} · {tx(locale, "訂單", "Orders")} {orders.length} · {tx(locale, "未處理檢舉", "Open reports")} {reports.length} · {tx(locale, "佣金", "Commission")} {bpsToPercentLabel(bps)}%
        </p>
      ) : null}
      {tab === "users" ? (
        <ul className="grid gap-2 text-sm">
          {users.map((user) => (
            <li key={user.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
              <span>{user.nickname} · {user.email || user.phone} · {user.role} {user.bidBanned ? "· banned" : ""} · strikes {user.consecutiveUnpaid}</span>
              {user.bidBanned ? (
                <form action={liftBan}><input type="hidden" name="userId" value={user.id} /><button className="btn-ghost btn">{tx(locale, "解除禁拍", "Lift bid ban")}</button></form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {tab === "listings" ? (
        <ul className="grid gap-2 text-sm">
          {listings.map((listing) => (
            <li key={listing.id} className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/listing/${listing.id}`}>{listing.title}</Link>
              <span>{listingStatusLabel(locale, listing.status)} · {listing.seller.nickname}</span>
              {listing.status === "ACTIVE" ? (
                <form action={adminUnlist}><input type="hidden" name="listingId" value={listing.id} /><button>{tx(locale, "下架", "Unlist")}</button></form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {tab === "orders" ? (
        <ul className="grid gap-2 text-sm">
          {orders.map((order) => (
            <li key={order.id}>
              <Link href={`/orders/${order.id}`}>{orderStatusLabel(locale, order.status)}</Link> · {formatHkd(order.total, locale)} · {order.buyer.nickname} → {order.seller.nickname} · {formatHKT(order.createdAt, locale)}
            </li>
          ))}
        </ul>
      ) : null}
      {tab === "disputes" ? (
        <ul className="grid gap-4">
          {disputes.map((dispute) => (
            <li key={dispute.id} className="rounded-xl border border-line p-3 text-sm">
              <p>{dispute.status} · <Link href={`/orders/${dispute.orderId}`}>{dispute.orderId}</Link></p>
              <p>{dispute.reason}</p>
              {dispute.appealReason ? <p>{tx(locale, "上訴", "Appeal")}: {dispute.appealReason}</p> : null}
              {dispute.status === "OPEN" || dispute.status === "APPEALED" ? (
                <form action={adminDecide} className="mt-2 grid gap-2">
                  <input type="hidden" name="disputeId" value={dispute.id} />
                  <textarea className="field" name="note" placeholder={tx(locale, "裁定備註", "Decision note")} />
                  <div className="flex gap-2">
                    <button className="btn btn-primary" name="winner" value="buyer">{tx(locale, "買家勝（賣家付退運）", "Buyer wins")}</button>
                    <button className="btn-ghost btn" name="winner" value="seller">{tx(locale, "賣家勝（撥出託管）", "Seller wins")}</button>
                  </div>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {tab === "reports" ? (
        <ul className="grid gap-2 text-sm">
          {reports.length === 0 ? <li>{tx(locale, "沒有未處理檢舉。", "No open reports.")}</li> : null}
          {reports.map((report) => (
            <li key={report.id} className="rounded-xl border border-line p-3">
              <p>{report.targetType} {report.targetId}</p>
              <p>{report.reason}</p>
              <form action={resolveReport}><input type="hidden" name="id" value={report.id} /><button className="underline">{tx(locale, "標記已處理", "Resolve")}</button></form>
            </li>
          ))}
        </ul>
      ) : null}
      {tab === "categories" ? (
        <form action={addCategory} className="grid max-w-lg gap-2">
          <select className="field" name="parentId">
            {groups.map((group) => (
              <option key={group.id} value={group.id}>{locale === "en" ? group.nameEn : group.nameZh}</option>
            ))}
          </select>
          <input className="field" name="nameZh" placeholder={tx(locale, "中文名", "Chinese name")} required />
          <input className="field" name="nameEn" placeholder={tx(locale, "英文名", "English name")} required />
          <input className="field" name="slug" placeholder="slug" required />
          <button className="btn btn-primary w-fit">{tx(locale, "新增子分類", "Add leaf category")}</button>
        </form>
      ) : null}
      {tab === "commission" ? (
        <form action={setCommission} className="grid max-w-xs gap-2">
          <p className="text-sm">{tx(locale, "現時", "Current")} {bpsToPercentLabel(bps)}%</p>
          <input className="field" name="percent" defaultValue={bpsToPercentLabel(bps)} inputMode="decimal" />
          <p className="text-sm text-muted">{tx(locale, "0–30，最多一位小數。只影響新訂單。", "0–30, one decimal. Applies to new orders only.")}</p>
          <button className="btn btn-primary w-fit">{tx(locale, "更新佣金", "Update commission")}</button>
        </form>
      ) : null}
    </div>
  );
}
