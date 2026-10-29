import Link from "next/link";
import { redirect } from "next/navigation";
import { VerificationPill } from "@/components/profile-header";
import { Flash } from "@/components/shell";
import { VerifyForm } from "@/components/verify-form";
import { getPrefs, getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tx } from "@/lib/i18n";

function statusCopy(status: "PENDING" | "APPROVED" | "REJECTED"): [string, string] {
  if (status === "PENDING") return ["審核中", "In review"];
  if (status === "APPROVED") return ["已通過", "Approved"];
  return ["唔過", "Not approved"];
}

export default async function VerifySettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/me/settings/verify");
  const locale = prefs.locale;
  const latest = await prisma.verificationApplication.findFirst({
    where: { userId: viewer.id },
    orderBy: { createdAt: "desc" },
    select: { status: true },
  });
  const pending = latest?.status === "PENDING";
  const status = latest ? statusCopy(latest.status) : null;
  return (
    <div className="mx-auto grid max-w-lg gap-3">
      <Link href="/me/settings/account" className="text-xs font-semibold text-link">{tx(locale, "返回帳號", "Back to account")}</Link>
      <h1 className="text-lg font-semibold">{tx(locale, "申請認證", "Apply for verification")}</h1>
      <Flash locale={locale} ok={sp.ok} err={sp.err} />
      <p className="inline-flex items-center gap-1 text-sm font-semibold">
        {viewer.nickname}
        <VerificationPill tier={viewer.verificationTier} />
      </p>
      {status ? <p className="text-sm">{tx(locale, "狀態", "Status")}：{tx(locale, status[0], status[1])}</p> : null}
      {pending ? <p className="text-sm text-muted">{tx(locale, "暫時唔使再交。", "Nothing to send while this is in review.")}</p> : null}
      {latest?.status === "APPROVED" ? <p className="text-sm text-muted">{tx(locale, "想轉另一種先再交。", "Submit again only to switch.")}</p> : null}
      {latest?.status === "REJECTED" ? <p className="text-sm text-muted">{tx(locale, "可以再交。", "You can submit again.")}</p> : null}
      {pending ? null : (
        <>
          {latest?.status === "APPROVED" ? null : <p className="text-sm text-muted">{tx(locale, "上傳文件，寫低原因。", "Upload a document and a short reason.")}</p>}
          <VerifyForm locale={locale} />
        </>
      )}
    </div>
  );
}
