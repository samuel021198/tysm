import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs, getViewer } from "@/lib/auth";
import { formatHKT } from "@/lib/format";
import { tx } from "@/lib/i18n";
import { isBlocked } from "@/lib/social";
import { ReadPing } from "@/components/pings";
import { Flash } from "@/components/shell";
import { MessageComposer } from "@/components/message-composer";

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
      <h1 className="text-[1.65rem] font-bold">{other.nickname}</h1>
      {thread.listing ? <p className="text-sm text-muted">{thread.listing.title}</p> : null}
      <ol className="grid gap-2.5">
        {thread.messages.map((message) => {
          const mine = message.senderId === viewer.id;
          return (
            <li key={message.id} className={mine ? "ml-10 rounded-[1.25rem] rounded-br-md bg-gradient-to-br from-rose/40 to-teal/30 px-3.5 py-3" : "surface mr-10 rounded-[1.25rem] rounded-bl-md px-3.5 py-3"}>
              <p className="text-[15px] leading-6">{message.body}</p>
              {message.imageUrl ? <img src={message.imageUrl} alt="" className="mt-2 max-h-48 rounded-xl" /> : null}
              <p className="mt-1 text-[11px] text-muted">
                {formatHKT(message.createdAt, prefs.locale)} · {mine ? (message.readAt ? tx(prefs.locale, "已讀", "Read") : tx(prefs.locale, "已送出", "Sent")) : message.sender.nickname}
              </p>
            </li>
          );
        })}
      </ol>
      <MessageComposer locale={prefs.locale} threadId={id} />
    </div>
  );
}
