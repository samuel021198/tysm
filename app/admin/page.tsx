import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { formatHkd, formatHKT } from "@/lib/format";
import { listingStatusLabel, tx, type Locale } from "@/lib/i18n";
import { Flash } from "@/components/shell";
import { AdminShell } from "@/components/admin-shell";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { adminTab, openFirst, reportHref } from "@/lib/admin-desk";
import { r2Config } from "@/lib/r2";
import { classifyVerificationDoc } from "@/lib/verification";
import {
  addCategory,
  adminDecide,
  adminUnlist,
  banBids,
  liftBan,
  resolveReport,
  reviewApplication,
  setAccountDisabled,
  setUserTier,
} from "@/actions/admin";

const table = "w-full min-w-[720px] border-collapse text-sm";
const cell = "whitespace-nowrap border-b border-line px-2 py-1.5 text-left align-top";

function phoneLabel(phone: string | null) {
  if (!phone) return "—";
  return phone.startsWith("+852") ? phone.slice(4) : phone;
}

function Level({ tier }: { tier: string }) {
  if (tier === "TRUSTED") return <span className="inline-flex rounded-full bg-[#E8F5E9] px-1.5 py-0.5 text-[11px] font-semibold text-[#1B5E20]">誠信用戶</span>;
  if (tier === "MERCHANT") return <span className="inline-flex rounded-full bg-[#FFF3E0] px-1.5 py-0.5 text-[11px] font-semibold text-[#E65100]">專業商戶</span>;
  return <span>普通</span>;
}

function trackLabel(locale: Locale, track: string) {
  if (track === "TRUSTED") return tx(locale, "誠信用戶", "Trusted");
  if (track === "MERCHANT") return tx(locale, "專業商戶", "Merchant");
  return track;
}

function appStatus(locale: Locale, status: string) {
  if (status === "PENDING") return tx(locale, "審核中", "In review");
  if (status === "APPROVED") return tx(locale, "已通過", "Approved");
  if (status === "REJECTED") return tx(locale, "已拒絕", "Rejected");
  return status;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; ok?: string; err?: string; q?: string; status?: string; track?: string; id?: string }>;
}) {
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/admin");
  if (viewer.role !== "ADMIN") redirect("/?err=forbidden");
  const tab = adminTab(sp.tab);
  const locale = prefs.locale;
  const [applications, reports, disputes] = await Promise.all([
    prisma.verificationApplication.count({ where: { status: "PENDING" } }),
    prisma.report.count({ where: { status: "OPEN" } }),
    prisma.dispute.count({ where: { status: { in: ["OPEN", "APPEALED"] } } }),
  ]);

  return (
    <AdminShell locale={locale} name={viewer.nickname} tab={tab} counts={{ applications, reports, disputes }}>
      <Flash locale={locale} ok={sp.ok} err={sp.err} />
      {tab === "users" ? <Users locale={locale} q={sp.q || ""} /> : null}
      {tab === "applications" ? <Applications locale={locale} status={sp.status || ""} track={sp.track || ""} id={sp.id || ""} /> : null}
      {tab === "listings" ? <Listings locale={locale} /> : null}
      {tab === "reports" ? <Reports locale={locale} /> : null}
      {tab === "disputes" ? <Disputes locale={locale} /> : null}
      {tab === "categories" ? <Categories locale={locale} /> : null}
    </AdminShell>
  );
}

async function Users({ locale, q }: { locale: Locale; q: string }) {
  const query = q.trim().slice(0, 40);
  const phoneQ = query.replace(/[\s-]/g, "");
  const users = await prisma.user.findMany({
    where: query
      ? {
          OR: [
            { nickname: { contains: query, mode: "insensitive" } },
            { phone: { contains: phoneQ } },
            ...(phoneQ && !phoneQ.startsWith("+") ? [{ phone: { contains: `+852${phoneQ}` } }] : []),
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  return (
    <div className="grid gap-3">
      <form action="/admin" className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="tab" value="users" />
        <input className="field max-w-xs" name="q" defaultValue={query} placeholder={tx(locale, "電話或暱稱", "Phone or nickname")} />
        <button className="text-sm text-link underline">{tx(locale, "搜尋", "Search")}</button>
      </form>
      <div className="overflow-x-auto">
        <table className={table}>
          <thead>
            <tr>
              {[tx(locale, "暱稱", "Nickname"), tx(locale, "電話", "Phone"), tx(locale, "等級", "Level"), tx(locale, "狀態", "Status"), tx(locale, "註冊", "Joined"), tx(locale, "操作", "Actions")].map((label) => (
                <th key={label} className={cell}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? <tr><td className={cell} colSpan={6}>{tx(locale, "未有用戶。", "No users.")}</td></tr> : null}
            {users.map((user) => (
              <tr key={user.id}>
                <td className={cell}>{user.nickname}</td>
                <td className={cell}>{phoneLabel(user.phone)}</td>
                <td className={cell}><Level tier={user.verificationTier} /></td>
                <td className={cell}>{user.disabled ? tx(locale, "已禁用", "Disabled") : tx(locale, "正常", "Active")}</td>
                <td className={cell}>{formatHKT(user.createdAt, locale, false)}</td>
                <td className={cell}>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {user.role === "ADMIN" ? null : (
                      <form action={setAccountDisabled}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="q" value={query} />
                        <input type="hidden" name="disabled" value={user.disabled ? "0" : "1"} />
                        <ConfirmSubmit
                          label={user.disabled ? tx(locale, "解除禁用", "Enable") : tx(locale, "禁用", "Disable")}
                          message={user.disabled ? tx(locale, "確定解除禁用？", "Enable this account?") : tx(locale, "確定禁用此帳戶？", "Disable this account?")}
                        />
                      </form>
                    )}
                    <form action={user.bidBanned ? liftBan : banBids}>
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="q" value={query} />
                      <button className="text-sm text-link underline">{user.bidBanned ? tx(locale, "解除禁拍", "Lift bid ban") : tx(locale, "禁拍", "Ban bids")}</button>
                    </form>
                    {user.verificationTier === "TRUSTED" ? null : (
                      <form action={setUserTier}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="q" value={query} />
                        <input type="hidden" name="tier" value="TRUSTED" />
                        <button className="text-sm text-link underline">{tx(locale, "標記誠信", "Mark trusted")}</button>
                      </form>
                    )}
                    {user.verificationTier === "MERCHANT" ? null : (
                      <form action={setUserTier}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="q" value={query} />
                        <input type="hidden" name="tier" value="MERCHANT" />
                        <button className="text-sm text-link underline">{tx(locale, "標記專業商戶", "Mark merchant")}</button>
                      </form>
                    )}
                    <Link className="text-sm text-link underline" href={`/u/${user.id}`}>{tx(locale, "主頁", "Profile")}</Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterLink({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return <Link href={href} className={on ? "font-semibold text-ink underline" : "text-muted"}>{children}</Link>;
}

async function Applications({ locale, status, track, id }: { locale: Locale; status: string; track: string; id: string }) {
  const statusOk = status === "PENDING" || status === "APPROVED" || status === "REJECTED" ? status : "";
  const trackOk = track === "TRUSTED" || track === "MERCHANT" ? track : "";
  const rows = await prisma.verificationApplication.findMany({
    where: {
      ...(statusOk ? { status: statusOk } : {}),
      ...(trackOk ? { track: trackOk } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 80,
    include: { user: { select: { id: true, nickname: true } } },
  });
  const base = (next: { status?: string; track?: string; id?: string }) => {
    const params = new URLSearchParams({ tab: "applications" });
    const s = next.status ?? statusOk;
    const t = next.track ?? trackOk;
    if (s) params.set("status", s);
    if (t) params.set("track", t);
    if (next.id) params.set("id", next.id);
    return `/admin?${params}`;
  };
  const open = rows.find((row) => row.id === id) ?? null;
  const previewBase = r2Config()?.publicBase ?? null;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        <span className="text-muted">{tx(locale, "狀態", "Status")}</span>
        <FilterLink href={base({ status: "" })} on={!statusOk}>{tx(locale, "全部", "All")}</FilterLink>
        <FilterLink href={base({ status: "PENDING" })} on={statusOk === "PENDING"}>{tx(locale, "審核中", "In review")}</FilterLink>
        <FilterLink href={base({ status: "APPROVED" })} on={statusOk === "APPROVED"}>{tx(locale, "已通過", "Approved")}</FilterLink>
        <FilterLink href={base({ status: "REJECTED" })} on={statusOk === "REJECTED"}>{tx(locale, "已拒絕", "Rejected")}</FilterLink>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        <span className="text-muted">{tx(locale, "類型", "Type")}</span>
        <FilterLink href={base({ track: "" })} on={!trackOk}>{tx(locale, "全部", "All")}</FilterLink>
        <FilterLink href={base({ track: "TRUSTED" })} on={trackOk === "TRUSTED"}>{tx(locale, "誠信用戶", "Trusted")}</FilterLink>
        <FilterLink href={base({ track: "MERCHANT" })} on={trackOk === "MERCHANT"}>{tx(locale, "專業商戶", "Merchant")}</FilterLink>
      </div>
      <div className="overflow-x-auto">
        <table className={table}>
          <thead>
            <tr>
              {[tx(locale, "申請人", "Applicant"), tx(locale, "類型", "Type"), tx(locale, "狀態", "Status"), tx(locale, "提交", "Submitted"), tx(locale, "操作", "Actions")].map((label) => (
                <th key={label} className={cell}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? <tr><td className={cell} colSpan={5}>{tx(locale, "未有申請。", "No applications.")}</td></tr> : null}
            {rows.map((row) => (
              <tr key={row.id}>
                <td className={cell}><Link className="text-link underline" href={`/u/${row.user.id}`}>{row.user.nickname}</Link></td>
                <td className={cell}>{trackLabel(locale, row.track)}</td>
                <td className={cell}>{appStatus(locale, row.status)}</td>
                <td className={cell}>{formatHKT(row.createdAt, locale, false)}</td>
                <td className={cell}>
                  {open?.id === row.id ? (
                    <Link className="text-sm text-link underline" href={base({})}>{tx(locale, "收起", "Close")}</Link>
                  ) : (
                    <Link className="text-sm text-link underline" href={base({ id: row.id })}>{tx(locale, "查看", "Open")}</Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open ? (
        <section className="grid max-w-xl gap-3 border border-line p-3 text-sm">
          <p>{trackLabel(locale, open.track)} · {appStatus(locale, open.status)}</p>
          <p>{open.reason}</p>
          <p><Link className="text-link underline" href={`/u/${open.user.id}`}>{open.user.nickname}</Link></p>
          {classifyVerificationDoc(open.documentUrl, previewBase).kind === "blocked" ? (
            <p className="text-muted">{tx(locale, "未能顯示文件", "The document cannot be shown")}</p>
          ) : (
            <img src={`/admin/doc/${open.id}`} alt={tx(locale, "申請文件", "Application document")} className="max-h-64 max-w-full border border-line" />
          )}
          {open.reviewNote ? <p>{open.reviewNote}</p> : null}
          {open.status === "PENDING" ? (
            <form className="grid gap-2">
              <input type="hidden" name="id" value={open.id} />
              <label className="grid gap-1">
                {tx(locale, "備註", "Note")}
                <textarea className="field" name="note" rows={2} maxLength={500} />
              </label>
              <div className="flex flex-wrap gap-3">
                <button className="text-sm font-semibold text-link underline" formAction={reviewApplication.bind(null, "APPROVED")}>{tx(locale, "批核", "Approve")}</button>
                <button className="text-sm text-link underline" formAction={reviewApplication.bind(null, "REJECTED")}>{tx(locale, "拒絕", "Reject")}</button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

async function Listings({ locale }: { locale: Locale }) {
  const rows = await prisma.listing.findMany({
    orderBy: { createdAt: "desc" },
    take: 80,
    include: { seller: { select: { nickname: true } } },
  });
  return (
    <div className="overflow-x-auto">
      <table className={table}>
        <thead>
          <tr>
            {[tx(locale, "標題", "Title"), tx(locale, "賣家", "Seller"), tx(locale, "狀態", "Status"), tx(locale, "價", "Price"), tx(locale, "下架", "Unlist"), tx(locale, "連結", "Link")].map((label) => (
              <th key={label} className={cell}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <tr><td className={cell} colSpan={6}>{tx(locale, "未有貨品。", "No listings.")}</td></tr> : null}
          {rows.map((row) => {
            const cents = row.price ?? row.startPrice;
            return (
              <tr key={row.id}>
                <td className={cell}>{row.title}</td>
                <td className={cell}>{row.seller.nickname}</td>
                <td className={cell}>{listingStatusLabel(locale, row.status)}</td>
                <td className={cell}>{cents == null ? "—" : formatHkd(cents, locale)}</td>
                <td className={cell}>
                  {row.status === "ACTIVE" ? (
                    <form action={adminUnlist}>
                      <input type="hidden" name="listingId" value={row.id} />
                      <ConfirmSubmit label={tx(locale, "下架", "Unlist")} message={tx(locale, "確定下架此貨品？", "Unlist this item?")} />
                    </form>
                  ) : "—"}
                </td>
                <td className={cell}><Link className="text-link underline" href={`/listing/${row.id}`}>{tx(locale, "查看", "Open")}</Link></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

async function Reports({ locale }: { locale: Locale }) {
  const rows = openFirst(await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    take: 80,
    include: { reporter: { select: { id: true, nickname: true } } },
  }));
  return (
    <div className="overflow-x-auto">
      <table className={table}>
        <thead>
          <tr>
            {[tx(locale, "類型", "Type"), tx(locale, "目標", "Target"), tx(locale, "原因", "Reason"), tx(locale, "舉報人", "Reporter"), tx(locale, "時間", "Time"), tx(locale, "操作", "Actions")].map((label) => (
              <th key={label} className={cell}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <tr><td className={cell} colSpan={6}>{tx(locale, "未有舉報。", "No reports.")}</td></tr> : null}
          {rows.map((row) => {
            const href = reportHref(row.targetType, row.targetId);
            return (
              <tr key={row.id}>
                <td className={cell}>{row.targetType}</td>
                <td className={cell}>{href ? <Link className="text-link underline" href={href}>{row.targetId}</Link> : row.targetId}</td>
                <td className={cell}>{row.reason}</td>
                <td className={cell}><Link className="text-link underline" href={`/u/${row.reporter.id}`}>{row.reporter.nickname}</Link></td>
                <td className={cell}>{formatHKT(row.createdAt, locale)}</td>
                <td className={cell}>
                  {row.status === "OPEN" ? (
                    <form action={resolveReport}>
                      <input type="hidden" name="id" value={row.id} />
                      <button className="text-sm text-link underline">{tx(locale, "標記已處理", "Resolve")}</button>
                    </form>
                  ) : tx(locale, "已處理", "Resolved")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

async function Disputes({ locale }: { locale: Locale }) {
  const rows = openFirst(await prisma.dispute.findMany({ orderBy: { createdAt: "desc" }, take: 40 }));
  return (
    <ul className="grid gap-4">
      {rows.length === 0 ? <li className="text-sm">{tx(locale, "未有爭議。", "No disputes.")}</li> : null}
      {rows.map((row) => (
        <li key={row.id} className="border-b border-line pb-3 text-sm">
          <p>
            {row.status} · <Link className="text-link underline" href={`/orders/${row.orderId}`}>{row.orderId}</Link>
          </p>
          <p className="mt-1">{row.reason}</p>
          {row.appealReason ? <p className="mt-1">{tx(locale, "上訴", "Appeal")}: {row.appealReason}</p> : null}
          {row.status === "OPEN" || row.status === "APPEALED" ? (
            <form className="mt-2 grid max-w-xl gap-2">
              <input type="hidden" name="disputeId" value={row.id} />
              <textarea className="field" name="note" rows={2} placeholder={tx(locale, "裁定備註", "Decision note")} />
              <div className="flex flex-wrap gap-3">
                <button className="text-sm font-semibold text-link underline" formAction={adminDecide.bind(null, "buyer")}>{tx(locale, "買家勝（賣家付退運）", "Buyer wins (seller pays return shipping)")}</button>
                <button className="text-sm text-link underline" formAction={adminDecide.bind(null, "seller")}>{tx(locale, "賣家勝", "Seller wins")}</button>
              </div>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

async function Categories({ locale }: { locale: Locale }) {
  const groups = await prisma.category.findMany({
    where: { level: "GROUP" },
    orderBy: { sort: "asc" },
    include: { children: { orderBy: { sort: "asc" } } },
  });
  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto">
        <table className={table}>
          <thead>
            <tr>
              {[tx(locale, "父分類", "Parent"), tx(locale, "中文名", "Chinese name"), tx(locale, "英文名", "English name"), "slug"].map((label) => (
                <th key={label} className={cell}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? <tr><td className={cell} colSpan={4}>{tx(locale, "未有品類。", "No categories.")}</td></tr> : null}
            {groups.map((group) => (
              <Fragment key={group.id}>
                <tr>
                  <td className={cell}>{tx(locale, "組", "Group")}</td>
                  <td className={cell}>{group.nameZh}</td>
                  <td className={cell}>{group.nameEn}</td>
                  <td className={cell}>{group.slug}</td>
                </tr>
                {group.children.map((child) => (
                  <tr key={child.id}>
                    <td className={cell}>{locale === "en" ? group.nameEn : group.nameZh}</td>
                    <td className={cell}>{child.nameZh}</td>
                    <td className={cell}>{child.nameEn}</td>
                    <td className={cell}>{child.slug}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <form action={addCategory} className="grid max-w-lg gap-2">
        <label className="grid gap-1 text-sm">
          {tx(locale, "父分類", "Parent")}
          <select className="field" name="parentId">
            {groups.map((group) => (
              <option key={group.id} value={group.id}>{locale === "en" ? group.nameEn : group.nameZh}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          {tx(locale, "中文名", "Chinese name")}
          <input className="field" name="nameZh" required />
        </label>
        <label className="grid gap-1 text-sm">
          {tx(locale, "英文名", "English name")}
          <input className="field" name="nameEn" required />
        </label>
        <label className="grid gap-1 text-sm">
          slug
          <input className="field" name="slug" required />
        </label>
        <button className="w-fit text-sm font-semibold text-link underline">{tx(locale, "新增子分類", "Add child category")}</button>
      </form>
    </div>
  );
}
