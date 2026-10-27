"use client";

import { useState, type ReactNode } from "react";
import { tx, type Locale } from "@/lib/i18n";

type Cat = { slug: string; nameZh: string; nameEn: string };

export function SearchFilters({
  locale,
  q,
  cat,
  cond,
  min,
  sort,
  pmin,
  pmax,
  sale,
  setName,
  number,
  show = "all",
  categories,
  children,
}: {
  locale: Locale;
  q: string;
  cat: string;
  cond: string;
  min: string;
  sort: string;
  pmin: string;
  pmax: string;
  sale: string;
  setName: string;
  number: string;
  show?: string;
  categories: Cat[];
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const active = [cat, cond, min, pmin, pmax, sale, setName, number, sort !== "relevance" ? sort : ""].filter(Boolean).length;
  return (
    <div className="mb-3 mt-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">{children}</div>
        <button
          type="button"
          className="inline-flex h-11 shrink-0 items-center gap-1 text-sm font-semibold text-link"
          aria-expanded={open}
          aria-controls={open ? "search-filter-panel" : undefined}
          aria-label={!open && active ? tx(locale, `篩選，已用 ${active} 項`, `Filters, ${active} on`) : undefined}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? tx(locale, "收起", "Hide") : tx(locale, "篩選", "Filters")}
          {!open && active ? <span className="tabular-nums text-ink">{active}</span> : null}
        </button>
      </div>
      {open ? (
        <form id="search-filter-panel" action="/search" className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
          {q ? <input type="hidden" name="q" value={q} /> : null}
          {show === "listing" || show === "post" ? <input type="hidden" name="show" value={show} /> : null}
          <select className="field col-span-2 md:col-span-1" name="cat" defaultValue={cat} aria-label={tx(locale, "分類", "Category")}>
            <option value="">{tx(locale, "全部分類", "All categories")}</option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {locale === "en" ? category.nameEn : category.nameZh}
              </option>
            ))}
          </select>
          <select className="field" name="cond" defaultValue={cond} aria-label={tx(locale, "品相", "Condition")}>
            <option value="">{tx(locale, "全部品相", "Any condition")}</option>
            <option value="raw">{tx(locale, "全部 Raw", "All raw")}</option>
            {["PSA", "BGS", "CGC", "TAG"].map((grader) => (
              <option key={grader}>{grader}</option>
            ))}
          </select>
          <input className="field" name="min" type="number" min={1} max={10.5} step={0.5} defaultValue={min} placeholder={tx(locale, "最低分數", "Min grade")} aria-label={tx(locale, "最低分數", "Min grade")} />
          <select className="field col-span-2 md:col-span-1" name="sort" defaultValue={sort} aria-label={tx(locale, "排序", "Sort")}>
            <option value="relevance">{tx(locale, "相關", "Relevance")}</option>
            <option value="new">{tx(locale, "最新", "Newest")}</option>
            <option value="price_asc">{tx(locale, "價格由低至高", "Price ascending")}</option>
            <option value="price_desc">{tx(locale, "價格由高至低", "Price descending")}</option>
            <option value="ending">{tx(locale, "即將結束", "Ending soon")}</option>
          </select>
          <input className="field" name="pmin" inputMode="decimal" defaultValue={pmin} placeholder={tx(locale, "最低價 HKD", "Min HKD")} aria-label={tx(locale, "最低價", "Minimum price")} />
          <input className="field" name="pmax" inputMode="decimal" defaultValue={pmax} placeholder={tx(locale, "最高價 HKD", "Max HKD")} aria-label={tx(locale, "最高價", "Maximum price")} />
          <select className="field col-span-2 md:col-span-1" name="sale" defaultValue={sale} aria-label={tx(locale, "售賣方式", "Sale type")}>
            <option value="">{tx(locale, "直購／拍賣", "Buy now / auction")}</option>
            <option value="BUY_NOW">{tx(locale, "直購", "Buy now")}</option>
            <option value="AUCTION">{tx(locale, "拍賣", "Auction")}</option>
            <option value="BOTH">{tx(locale, "直購 + 拍賣", "Buy now + auction")}</option>
          </select>
          <input className="field" name="set" defaultValue={setName} placeholder={tx(locale, "系列", "Set")} aria-label={tx(locale, "系列", "Set")} />
          <input className="field" name="num" defaultValue={number} placeholder={tx(locale, "卡號", "Card number")} aria-label={tx(locale, "卡號", "Card number")} />
          <button className="btn btn-primary col-span-2 md:col-span-1">{tx(locale, "套用", "Apply")}</button>
        </form>
      ) : null}
    </div>
  );
}
