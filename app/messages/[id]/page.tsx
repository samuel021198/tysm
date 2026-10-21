import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { formatHKT } from "@/lib/format";
import { tx } from "@/lib/i18n";
import { isBlocked } from "@/lib/social";
import { ReadPing } from "@/components/pings";
import { Flash } from "@/components/shell";
import { sendMessage } from "@/actions/social";

export default async function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [prefs, viewer] = await Promise.all([getPrefs(), getViewer()]);
  if (!viewer) redirect(`/login?next=/messages/${id}`);
  const thread = await prisma.messageThread.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" }, include: { sender: true } }, buyer: true, seller: true, listing: true },
  });
  if (!thread || (thread.buyerId !== viewer.id && thread.sellerId !== viewer.id)) notFound();
  const otherId = thread.buyerId === viewer.id ? thread.sellerId : thread.buyerId;
  if (await isBlocked(viewer.id, otherId)) notFound();
  const other = thread.buyerId === viewer.id ? thread.seller : thread.buyer;
  return (
    <div className="grid gap-4">
      <ReadPing id={id} />
      <Flash locale={prefs.locale} err={sp.err} />
      <h1 className="text-2xl font-semibold">{other.nickname}</h1>
      {thread.listing ? <p className="text-sm text-muted">{thread.listing.title}</p> : null}
      <ol className="grid gap-3">
        {thread.messages.map((message) => (
          <li key={message.id} className={message.senderId === viewer.id ? "ml-8 rounded-2xl bg-soft p-3" : "mr-8 rounded-2xl border border-line p-3"}>
            <p className="text-sm">{message.body}</p>
            {message.imageUrl ? <img src={message.imageUrl} alt="" className="mt-2 max-h-48 rounded-lg" /> : null}
            <p className="mt-1 text-xs text-muted">
              {formatHKT(message.createdAt, prefs.locale)} · {message.senderId === viewer.id ? (message.readAt ? tx(prefs.locale, "已讀", "Read") : tx(prefs.locale, "已送出", "Sent")) : message.sender.nickname}
            </p>
          </li>
        ))}
      </ol>
      <form action={sendMessage} className="grid gap-2">
        <input type="hidden" name="threadId" value={id} />
        <textarea className="field" name="body" required placeholder={tx(prefs.locale, "訊息", "Message")} />
        <input className="field" name="imageUrl" placeholder={tx(prefs.locale, "圖片網址（可選）", "Image URL (optional)")} />
        <button className="btn btn-primary w-fit">{tx(prefs.locale, "送出", "Send")}</button>
      </form>
    </div>
  );
}
