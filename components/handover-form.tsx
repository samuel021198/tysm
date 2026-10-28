import { startHandover } from "@/actions/social";
import { DEAL_ACK } from "@/lib/deal-phase";
import { tx, type Locale } from "@/lib/i18n";
import { Icon } from "./icons";

export function HandoverForm({
  locale,
  listingId,
  postId,
  layout,
}: {
  locale: Locale;
  listingId: string;
  postId?: string | null;
  layout: "row" | "stack";
}) {
  const row = layout === "row";
  const label = tx(locale, "傾交收", "Arrange handover");
  return (
    <form id={row ? undefined : "handover-form"} action={startHandover} className={row ? "grid justify-items-end gap-1.5" : "grid gap-2"}>
      <input type="hidden" name="listingId" value={listingId} />
      {postId ? <input type="hidden" name="postId" value={postId} /> : null}
      <button className="btn btn-primary shrink-0" aria-label={label}>
        <Icon name="check" className="h-4 w-4" strokeWidth={2.5} />
      </button>
      <label className={`flex items-start gap-2 text-left text-[11px] leading-4 text-muted ${row ? "max-w-xs" : ""}`}>
        <input className="mt-0.5" type="checkbox" name="ack" value="1" required />
        <span>{DEAL_ACK}</span>
      </label>
    </form>
  );
}
