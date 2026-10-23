"use client";

import { useState } from "react";
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
  categories,
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
  categories: Cat[];
}) {
  const extraOn = Boolean(pmin || pmax || sale || setName || number);
  const [open, setOpen] = useState(extraOn);
  return (
    <form action="/search" className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-5">
      {q ? <input type="hidden" name="q" value={q} /> : null}
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
      {!open ? (
        <>
          <input type="hidden" name="pmin" value={pmin} />
          <input type="hidden" name="pmax" value={pmax} />
          <input type="hidden" name="sale" value={sale} />
          <input type="hidden" name="set" value={setName} />
          <input type="hidden" name="num" value={number} />
        </>
      ) : null}
      <div className="col-span-2 flex gap-2 md:col-span-1">
        <button type="button" className="btn btn-ghost flex-1" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? tx(locale, "收起", "Hide") : tx(locale, "篩選", "Filters")}
        </button>
        <button className="btn btn-primary flex-1">{tx(locale, "套用", "Apply")}</button>
      </div>
      {open ? (
        <div className="col-span-2 grid grid-cols-2 gap-2.5 md:col-span-5 md:grid-cols-5">
          <input className="field" name="pmin" inputMode="decimal" defaultValue={pmin} placeholder={tx(locale, "最低價 HKD", "Min HKD")} aria-label={tx(locale, "最低價", "Minimum price")} />
          <input className="field" name="pmax" inputMode="decimal" defaultValue={pmax} placeholder={tx(locale, "最高價 HKD", "Max HKD")} aria-label={tx(locale, "最高價", "Maximum price")} />
          <select className="field" name="sale" defaultValue={sale} aria-label={tx(locale, "售賣方式", "Sale type")}>
            <option value="">{tx(locale, "直購／拍賣", "Buy now / auction")}</option>
            <option value="BUY_NOW">{tx(locale, "直購", "Buy now")}</option>
            <option value="AUCTION">{tx(locale, "拍賣", "Auction")}</option>
            <option value="BOTH">{tx(locale, "直購 + 拍賣", "Buy now + auction")}</option>
          </select>
          <input className="field" name="set" defaultValue={setName} placeholder={tx(locale, "系列", "Set")} aria-label={tx(locale, "系列", "Set")} />
          <input className="field" name="num" defaultValue={number} placeholder={tx(locale, "卡號", "Card number")} aria-label={tx(locale, "卡號", "Card number")} />
        </div>
      ) : null}
    </form>
  );
}
