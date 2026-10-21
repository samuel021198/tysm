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
      <form
        action={sendMessage}
        className="sticky z-20 grid gap-2 rounded-[1.25rem] bg-card/95 p-3 shadow-card backdrop-blur md:static"
        style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
      >
        <input type="hidden" name="threadId" value={id} />
        <textarea className="field min-h-12" name="body" required placeholder={tx(prefs.locale, "訊息", "Message")} rows={2} />
        <input className="field" name="imageUrl" placeholder={tx(prefs.locale, "圖片網址（可選）", "Image URL (optional)")} />
        <button className="btn btn-primary w-full">{tx(prefs.locale, "送出", "Send")}</button>
      </form>
    </div>
  );
}
