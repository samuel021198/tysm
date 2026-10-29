"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { markShopSold, unlistShopListing, updateShopPrice } from "@/actions/trade";
import { centsToInput, formatHkd } from "@/lib/format";
import { tx, type Locale } from "@/lib/i18n";
import { shopDisplayCents, shopMenu, shopPill, shopPillLabel, shopPriceEditable } from "@/lib/shop-inventory";

export type ShopInventoryRow = {
  id: string;
  title: string;
  saleType: "BUY_NOW" | "AUCTION" | "BOTH";
  price: number | null;
  startPrice: number | null;
  currentBid: number | null;
  auctionSettled: boolean;
  status: string;
  reserved: boolean;
  photo: string | null;
  itemCount: number;
};

export function ShopInventory({ locale, rows, next }: { locale: Locale; rows: ShopInventoryRow[]; next: string }) {
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!openId) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenId(null);
    }
    function onPointer(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-shop-menu]")) return;
      setOpenId(null);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [openId]);

  return (
    <section>
      <h2 className="px-3 pt-3 text-xs font-semibold text-muted sm:px-0">{tx(locale, "我的上架", "My listings")}</h2>
      <ul>
        {rows.map((row) => {
          const pill = shopPill(row);
          const editable = shopPriceEditable(pill, row);
          const amount = shopDisplayCents(row);
          const menu = shopMenu(pill);
          return (
            <li key={row.id} className="flex items-center gap-2 border-b border-line px-3 py-2 sm:px-0">
              <Link href={`/listing/${row.id}`} aria-label={row.title} className="shrink-0">
                <img src={row.photo || "/demo/back.svg"} alt="" loading="lazy" decoding="async" className="h-14 w-11 bg-soft object-contain" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/listing/${row.id}`} className="block truncate text-sm font-semibold">
                  {row.title}
                </Link>
                {editable ? (
                  <form action={updateShopPrice} data-gesture="" className="mt-0.5 flex items-center gap-1">
                    <input type="hidden" name="listingId" value={row.id} />
                    <input type="hidden" name="next" value={next} />
                    <span className="text-xs text-muted">HK$</span>
                    <input
                      name="price"
                      aria-label={tx(locale, "價錢", "Price")}
                      inputMode="decimal"
                      defaultValue={centsToInput(row.price)}
                      className="h-8 w-[5.5rem] rounded-[10px] border border-line bg-card px-2 text-sm"
                      onBlur={(event) => {
                        const input = event.currentTarget;
                        if (input.value.trim() === input.defaultValue) return;
                        input.form?.requestSubmit();
                      }}
                    />
                    <button type="submit" className="sr-only">
                      {tx(locale, "儲存價錢", "Save price")}
                    </button>
                  </form>
                ) : (
                  <p className="mt-0.5 text-sm font-semibold leading-none">{amount != null ? formatHkd(amount, locale) : "—"}</p>
                )}
              </div>
              {pill ? (
                <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-soft px-2 text-[11px] font-medium">
                  {shopPillLabel(locale, pill)}
                </span>
              ) : null}
              <div className="relative shrink-0" data-gesture="" data-shop-menu="">
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center text-base leading-none"
                  aria-label={tx(locale, "更多", "More")}
                  aria-haspopup="menu"
                  aria-expanded={openId === row.id}
                  onClick={() => setOpenId((current) => (current === row.id ? null : row.id))}
                >
                  ⋯
                </button>
                {openId === row.id ? (
                  <div role="menu" aria-label={tx(locale, "更多", "More")} className="absolute right-0 top-8 z-20 w-36 border border-line bg-card py-1">
                    {menu.edit ? (
                      <Link href={`/sell/${row.id}`} role="menuitem" className="flex h-11 items-center px-3 text-sm">
                        {tx(locale, "編輯", "Edit")}
                      </Link>
                    ) : null}
                    {menu.sold ? (
                      <form
                        action={markShopSold}
                        onSubmit={(event) => {
                          if (!window.confirm(tx(locale, "標記為已售？", "Mark this as sold?"))) event.preventDefault();
                        }}
                      >
                        <input type="hidden" name="listingId" value={row.id} />
                        <input type="hidden" name="next" value={next} />
                        <button type="submit" role="menuitem" className="flex h-11 w-full items-center px-3 text-left text-sm">
                          {tx(locale, "已售", "Sold")}
                        </button>
                      </form>
                    ) : null}
                    {menu.unlist ? (
                      <form
                        action={unlistShopListing}
                        onSubmit={(event) => {
                          if (!window.confirm(tx(locale, "下架這件貨？", "Unlist this item?"))) event.preventDefault();
                        }}
                      >
                        <input type="hidden" name="listingId" value={row.id} />
                        <input type="hidden" name="next" value={next} />
                        <button type="submit" role="menuitem" className="flex h-11 w-full items-center px-3 text-left text-sm">
                          {tx(locale, "下架", "Unlist")}
                        </button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
