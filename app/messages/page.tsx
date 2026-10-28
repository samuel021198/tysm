import Link from "next/link";
import { redirect } from "next/navigation";
import { shareIntoThread } from "@/actions/social";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { dealEventCopy, readDealEvent } from "@/lib/deal-phase";
import { formatHKT } from "@/lib/format";
import { tx } from "@/lib/i18n";
import { shareLabel, shareTarget } from "@/lib/share";
import { hiddenUserIds } from "@/lib/social";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ share?: string }> }) {
  const sp = await searchParams;
  const share = shareTarget(sp.share);
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) {
    const next = share ? `/messages?share=${encodeURIComponent(share)}` : "/messages";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  const hidden = new Set(await hiddenUserIds(viewer.id));
  const threads = await prisma.messageThread.findMany({
    where: { OR: [{ buyerId: viewer.id }, { sellerId: viewer.id }] },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      buyer: true,
      seller: true,
      listing: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  const visible = threads.filter((thread) => !hidden.has(thread.buyerId === viewer.id ? thread.sellerId : thread.buyerId));
  return (
    <div>
      <h1 className="page-title">{share ? tx(prefs.locale, "內部分享", "In TYSM") : tx(prefs.locale, "訊息", "Messages")}</h1>
      {visible.length === 0 ? <p className="empty">{tx(prefs.locale, "未有對話。", "No conversations.")}</p> : null}
      <ul className="grid gap-2.5">
        {visible.map((thread) => {
          const other = thread.buyerId === viewer.id ? thread.seller : thread.buyer;
          const last = thread.messages[0];
          const event = last ? readDealEvent(last.body) : null;
          const shared = last && !event ? shareTarget(last.body) : null;
          const preview = event
            ? dealEventCopy(prefs.locale, event).text
            : last
              ? (shared ? shareLabel(shared, prefs.locale) : last.body)
              : tx(prefs.locale, "未有訊息", "No messages yet");
          const row = (
            <>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-base font-bold text-white">
                {other.nickname.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{other.nickname}</span>
                  {last ? <span className="shrink-0 text-[11px] text-muted">{formatHKT(last.createdAt, prefs.locale, false)}</span> : null}
                </span>
                {thread.listing ? <span className="block truncate text-xs text-muted">{thread.listing.title}</span> : null}
                <span className="block truncate text-sm">{preview}</span>
              </span>
            </>
          );
          return (
            <li key={thread.id}>
              {share ? (
                <form action={shareIntoThread}>
                  <input type="hidden" name="threadId" value={thread.id} />
                  <input type="hidden" name="path" value={share} />
                  <button type="submit" className="surface flex min-h-[4.5rem] w-full items-center gap-3 px-3 py-3">
                    {row}
                  </button>
                </form>
              ) : (
                <Link href={`/messages/${thread.id}`} className="surface flex min-h-[4.5rem] items-center gap-3 px-3 py-3">
                  {row}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
