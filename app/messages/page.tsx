import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { formatHKT } from "@/lib/format";
import { tx } from "@/lib/i18n";
import { hiddenUserIds } from "@/lib/social";

export default async function MessagesPage() {
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect("/login?next=/messages");
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
      <h1 className="mb-4 text-2xl font-semibold">{tx(prefs.locale, "訊息", "Messages")}</h1>
      {visible.length === 0 ? <p>{tx(prefs.locale, "未有對話。", "No conversations.")}</p> : null}
      <ul className="grid gap-2">
        {visible.map((thread) => {
          const other = thread.buyerId === viewer.id ? thread.seller : thread.buyer;
          const last = thread.messages[0];
          return (
            <li key={thread.id}>
              <Link href={`/messages/${thread.id}`} className="block rounded-2xl border border-line p-3">
                <span className="font-medium">{other.nickname}</span>
                {thread.listing ? <span className="ml-2 text-sm text-muted">{thread.listing.title}</span> : null}
                <p className="text-sm">{last ? last.body : tx(prefs.locale, "未有訊息", "No messages yet")}</p>
                {last ? <p className="text-xs text-muted">{formatHKT(last.createdAt, prefs.locale)}</p> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
