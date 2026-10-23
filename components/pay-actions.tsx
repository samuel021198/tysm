import { tx, type Locale } from "@/lib/i18n";
import { payAction } from "@/actions/trade";

export function PayActions({ locale, orderId }: { locale: Locale; orderId: string }) {
  return (
    <form action={payAction} className="grid gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <button className="btn btn-primary w-full" name="outcome" value="success">
        {tx(locale, "確認付款", "Confirm payment")}
      </button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button className="btn-ghost btn" name="outcome" value="fail">
          {tx(locale, "付款未完成", "Payment incomplete")}
        </button>
        <button className="text-sm text-muted underline" name="outcome" value="dispute">
          {tx(locale, "這筆交易有問題", "Report a problem")}
        </button>
      </div>
      <p className="text-xs leading-5 text-muted">
        {tx(locale, "示範結帳不會經 FPS、PayMe 或銀行扣款。確認後訂單會進入託管。", "This demo checkout does not charge FPS, PayMe, or a card. Confirming moves the order into escrow.")}
      </p>
    </form>
  );
}
