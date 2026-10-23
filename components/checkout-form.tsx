"use client";

import { useMemo, useState } from "react";
import { checkoutAction } from "@/actions/trade";
import { formatHkd } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";
import { shipMethodLabel, type ShipMethod } from "@/lib/shipping";
import { Submit } from "./submit";

type Line = {
  title: string;
  seller: string;
  quantity: number;
  price: number;
  image: string | null;
  sf: number;
  locker: number;
  meet: number;
};

type Address = { id: string; recipient: string; phone: string; district: string; line1: string; isDefault: boolean };

const METHODS: ShipMethod[] = ["SF", "LOCKER", "MEET"];
const PAYS = [
  ["FPS", "轉數快 FPS", "FPS"],
  ["PAYME", "PayMe", "PayMe"],
  ["CARD", "信用卡 / 扣帳卡", "Card"],
] as const;

function feeOf(line: Line, method: ShipMethod) {
  if (method === "LOCKER") return line.locker;
  if (method === "MEET") return line.meet;
  return line.sf;
}

export function CheckoutForm({
  locale,
  mode,
  listingId,
  quantity,
  lines,
  addresses,
}: {
  locale: Locale;
  mode: "buy" | "cart";
  listingId?: string;
  quantity?: number;
  lines: Line[];
  addresses: Address[];
}) {
  const [method, setMethod] = useState<ShipMethod>("SF");
  const [pay, setPay] = useState<(typeof PAYS)[number][0]>("FPS");
  const goods = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const shipping = lines.reduce((sum, line) => sum + feeOf(line, method), 0);
  const total = goods + shipping;
  const note = useMemo(() => {
    if (method === "MEET") return tx(locale, "面交請喺訊息同賣家約時間同地點。", "Message the seller to arrange a meet-up.");
    if (method === "LOCKER") return tx(locale, "順豐智能櫃，賣家寄出後會提供取件碼。", "SF locker. The seller adds the pickup code after dispatch.");
    return tx(locale, "順豐速運到住址，賣家寄出後會有運單號碼。", "SF Express to your address. A tracking number appears after dispatch.");
  }, [locale, method]);

  return (
    <form action={checkoutAction} className="grid gap-4">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="shipMethod" value={method} />
      <input type="hidden" name="paymentBrand" value={pay} />
      {listingId ? <input type="hidden" name="listingId" value={listingId} /> : null}
      {listingId ? <input type="hidden" name="quantity" value={String(quantity || 1)} /> : null}

      <section className="surface grid gap-3 p-4">
        <h2 className="font-semibold">{tx(locale, "貨品", "Items")}</h2>
        {lines.map((line, index) => (
          <div key={`${line.title}-${index}`} className="flex gap-3">
            <img src={line.image || "/demo/back.svg"} alt="" className="h-20 w-16 shrink-0 rounded-xl bg-[#f4efe6] object-contain" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium leading-snug">{line.title}</p>
              <p className="text-muted">{line.seller} · × {line.quantity}</p>
              <p className="mt-1">{tx(locale, "貨價", "Item")} {formatHkd(line.price * line.quantity, locale)}</p>
              <p className="text-muted">{tx(locale, "運費", "Shipping")} {formatHkd(feeOf(line, method), locale)}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-2">
        <h2 className="font-semibold">{tx(locale, "運送方式", "Shipping")}</h2>
        {METHODS.map((id) => {
          const cost = lines.reduce((sum, line) => sum + feeOf(line, id), 0);
          return (
            <label key={id} className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl p-4 text-sm ring-1 ${method === id ? "bg-soft ring-teal" : "bg-card ring-[#5c3a4a]/20"}`}>
              <span className="flex items-center gap-3">
                <input type="radio" name="shipChoice" checked={method === id} onChange={() => setMethod(id)} />
                <span>
                  <span className="block font-medium">{shipMethodLabel(id, locale)}</span>
                  <span className="text-xs text-muted">{id === "MEET" ? tx(locale, "約時間交收", "Arrange a handover") : id === "LOCKER" ? tx(locale, "櫃機自取", "Locker pickup") : tx(locale, "送到收貨地址", "Deliver to your address")}</span>
                </span>
              </span>
              <span className="font-semibold">{formatHkd(cost, locale)}</span>
            </label>
          );
        })}
        <p className="text-xs leading-5 text-muted">{note}</p>
        <p className="text-xs text-muted">{tx(locale, "同一賣家多件貨品的運費會逐件相加，唔會合併。", "Shipping for the same seller is the sum of each item, not a combined rate.")}</p>
      </section>

      <section className="grid gap-2">
        <h2 className="font-semibold">{tx(locale, "收貨地址", "Address")}</h2>
        {addresses.map((address) => (
          <label key={address.id} className="flex min-h-14 items-start gap-3 rounded-2xl bg-soft p-4 text-sm">
            <input type="radio" name="addressId" value={address.id} defaultChecked={address.isDefault || addresses.length === 1} required />
            <span>{address.recipient} · {address.phone}<br />{address.district} {address.line1}</span>
          </label>
        ))}
      </section>

      <section className="grid gap-2">
        <h2 className="font-semibold">{tx(locale, "付款方式", "Payment")}</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {PAYS.map(([id, zh, en]) => (
            <label key={id} className={`flex min-h-14 items-center gap-2 rounded-2xl p-3 text-sm ring-1 ${pay === id ? "bg-soft ring-teal" : "bg-card ring-[#5c3a4a]/20"}`}>
              <input type="radio" name="payChoice" checked={pay === id} onChange={() => setPay(id)} />
              <span className="font-medium">{tx(locale, zh, en)}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="surface grid gap-1 p-4 text-sm">
        <div className="flex justify-between"><span>{tx(locale, "貨品", "Items")}</span><span>{formatHkd(goods, locale)}</span></div>
        <div className="flex justify-between"><span>{tx(locale, "運費", "Shipping")}</span><span>{formatHkd(shipping, locale)}</span></div>
        <div className="mt-1 flex justify-between text-base font-semibold"><span>{tx(locale, "應付總額", "Total")}</span><span className="price">{formatHkd(total, locale)}</span></div>
      </section>
      <Submit label={tx(locale, "確認訂單", "Confirm order")} pendingLabel={tx(locale, "處理中", "Working")} />
    </form>
  );
}
