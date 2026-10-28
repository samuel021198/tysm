import { startHandover } from "@/actions/social";
import { DEAL_ACK } from "@/lib/deal-phase";
import { tx, type Locale } from "@/lib/i18n";

export function HandoverForm({
  locale,
  listingId,
  postId,
  bargain,
  layout,
}: {
  locale: Locale;
  listingId: string;
  postId?: string | null;
  bargain: boolean;
  layout: "row" | "stack";
}) {
  const row = layout === "row";
  return (
    <form id={row ? undefined : "handover-form"} action={startHandover} className={row ? "grid justify-items-end gap-1.5" : "grid gap-2"}>
      <input type="hidden" name="listingId" value={listingId} />
      {postId ? <input type="hidden" name="postId" value={postId} /> : null}
      <div className={row ? "flex gap-1" : "grid gap-2"}>
        {bargain ? (
          <button className={`btn btn-ghost shrink-0 ${row ? "px-3" : "w-full"}`} name="intent" value="bargain">
            {tx(locale, "議價", "Offer")}
          </button>
        ) : null}
        <button className={`btn btn-primary shrink-0 ${row ? "px-3" : "w-full"}`} name="intent" value="deal">
          {tx(locale, "傾交收", "Arrange handover")}
        </button>
      </div>
      <label className={`flex items-start gap-2 text-left text-[11px] leading-4 text-muted ${row ? "max-w-xs" : ""}`}>
        <input className="mt-0.5" type="checkbox" name="ack" value="1" required />
        <span>{DEAL_ACK}</span>
      </label>
    </form>
  );
}
