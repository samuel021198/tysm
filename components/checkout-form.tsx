"use client";

import { useMemo, useState } from "react";
import { checkoutAction } from "@/actions/trade";
import { formatHkd } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";
import { hasStoreAddress, intersectOffered, methodHint, shipMethodLabel, type ShipMethod } from "@/lib/shipping";
import { Submit } from "./submit";

type Line = {
  sellerId: string;
  title: string;
  seller: string;
  quantity: number;
  price: number;
  image: string | null;
  shipSfCod: boolean;
  shipMeetup: boolean;
  shipPickup: boolean;
  meetupDistrict: string | null;
  meetupWindow: string | null;
  meetupNotes: string | null;
  storeName: string | null;
  storeDistrict: string | null;
  storeLine1: string | null;
  storeHours: string | null;
};

type Address = { id: string; recipient: string; phone: string; district: string; line1: string; isDefault: boolean };

const PAYS = [
  ["FPS", "轉數快 FPS", "FPS"],
  ["PAYME", "PayMe", "PayMe"],
  ["CARD", "信用卡 / 扣帳卡", "Card"],
] as const;

function groupsOf(lines: Line[]) {
  const map = new Map<string, Line[]>();
  for (const line of lines) {
    const bucket = map.get(line.sellerId) ?? [];
    bucket.push(line);
    map.set(line.sellerId, bucket);
  }
  return [...map.entries()].map(([sellerId, rows]) => {
    const storeReady = hasStoreAddress(rows[0]);
    const methods = intersectOffered(rows.map((row) => ({ choice: row, storeReady })));
    return { sellerId, seller: rows[0].seller, rows, methods, storeReady };
  });
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
  const groups = useMemo(() => groupsOf(lines), [lines]);
  const [chosen, setChosen] = useState<Record<string, ShipMethod>>(() => {
    const initial: Record<string, ShipMethod> = {};
    for (const group of groupsOf(lines)) {
      if (group.methods[0]) initial[group.sellerId] = group.methods[0];
    }
    return initial;
  });
  const [pay, setPay] = useState<(typeof PAYS)[number][0]>("FPS");
  const blocked = groups.some((group) => group.methods.length === 0);
  const needsAddress = groups.some((group) => chosen[group.sellerId] === "SF_COD");
  const goods = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

  return (
    <form action={checkoutAction} className="grid gap-4">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="shipMethods" value={JSON.stringify(chosen)} />
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
            </div>
          </div>
        ))}
      </section>

      {groups.map((group) => (
        <section key={group.sellerId} className="grid gap-2">
          <h2 className="font-semibold">{tx(locale, "運送方式", "Shipping")} · {group.seller}</h2>
          {group.methods.length === 0 ? (
            <p className="text-sm text-danger">{tx(locale, "呢幾件貨沒有共同運送方式，請先在購物車移除部分貨品再結帳。", "These items have no shipping method in common. Remove some from the cart and check out separately.")}</p>
          ) : (
            group.methods.map((id) => (
              <label key={id} className={`grid gap-1 rounded-2xl p-4 text-sm ring-1 ${chosen[group.sellerId] === id ? "bg-soft ring-teal" : "bg-card ring-[#5c3a4a]/20"}`}>
                <span className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-3">
                    <input type="radio" name={`shipChoice-${group.sellerId}`} checked={chosen[group.sellerId] === id} onChange={() => setChosen((current) => ({ ...current, [group.sellerId]: id }))} />
                    <span className="font-medium">{shipMethodLabel(id, locale)}</span>
                  </span>
                  <span className="font-semibold">{formatHkd(0, locale)}</span>
                </span>
                <span className="pl-7 text-xs text-muted">{methodHint(id, locale)}</span>
                {id === "MEET" && chosen[group.sellerId] === id ? (
                  <span className="pl-7 text-xs text-muted">
                    {group.rows.map((row) => [row.meetupDistrict, row.meetupWindow, row.meetupNotes].filter(Boolean).join(" · ")).filter((value, index, all) => value && all.indexOf(value) === index).join(" / ")}
                  </span>
                ) : null}
                {id === "PICKUP" && chosen[group.sellerId] === id ? (
                  <span className="pl-7 text-xs text-muted">
                    {[group.rows[0].storeName, group.rows[0].storeDistrict, group.rows[0].storeLine1, group.rows[0].storeHours].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
              </label>
            ))
          )}
        </section>
      ))}
      <p className="text-xs text-muted">{tx(locale, "平台不收取運費，亦不會把每件貨的運費相加。順豐到付由買家收貨時向順豐支付。", "The platform does not charge shipping and does not add a fee per item. SF cash on delivery is paid to SF Express on arrival.")}</p>

      {needsAddress ? (
        <section className="grid gap-2">
          <h2 className="font-semibold">{tx(locale, "收貨地址", "Address")}</h2>
          <p className="text-xs text-muted">{tx(locale, "順豐到付需要送貨地址。面交同店舖自取唔使填。", "SF cash on delivery needs a delivery address. Meet-up and store pickup do not.")}</p>
          {addresses.length === 0 ? (
            <p><a className="text-link" href="/me">{tx(locale, "請先在帳戶新增香港地址。", "Add a Hong Kong address in your account first.")}</a></p>
          ) : (
            addresses.map((address) => (
              <label key={address.id} className="flex min-h-14 items-start gap-3 rounded-2xl bg-soft p-4 text-sm">
                <input type="radio" name="addressId" value={address.id} defaultChecked={address.isDefault || addresses.length === 1} required />
                <span>{address.recipient} · {address.phone}<br />{address.district} {address.line1}</span>
              </label>
            ))
          )}
        </section>
      ) : (
        <p className="text-sm text-muted">{tx(locale, "你揀咗面交或店舖自取，唔使填收貨地址。", "Meet-up or store pickup does not need a delivery address.")}</p>
      )}

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
        <div className="flex justify-between"><span>{tx(locale, "平台運費", "Platform shipping")}</span><span>{formatHkd(0, locale)}</span></div>
        <div className="mt-1 flex justify-between text-base font-semibold"><span>{tx(locale, "應付總額", "Total")}</span><span className="price">{formatHkd(goods, locale)}</span></div>
      </section>
      {blocked || (needsAddress && addresses.length === 0) ? (
        <p className="text-sm text-danger">{tx(locale, "而家未能確認訂單。", "This order cannot be confirmed yet.")}</p>
      ) : (
        <Submit label={tx(locale, "確認訂單", "Confirm order")} pendingLabel={tx(locale, "處理中", "Working")} />
      )}
    </form>
  );
}
