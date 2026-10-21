"use client";

import { useActionState } from "react";
import { importCsvAction } from "@/actions/trade";
import { Submit } from "@/components/submit";
import { errText, tx, type Locale } from "@/lib/i18n";

export function CsvForm({
  locale,
  categories,
}: {
  locale: Locale;
  categories: { id: string; name: string; kind: string }[];
}) {
  const [state, action] = useActionState(importCsvAction, null);
  return (
    <form action={action} className="grid gap-3">
      <label className="text-sm">
        {tx(locale, "分類", "Category")}
        <select className="field" name="categoryId">
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        CSV
        <input className="field" type="file" name="file" accept=".csv,text/csv" required />
      </label>
      <Submit label={tx(locale, "匯入", "Import")} pendingLabel="…" />
      {state?.error ? <p className="text-sm text-danger">{errText(locale, state.error)}</p> : null}
      {state?.rows?.length ? (
        <ul className="text-sm text-danger">
          {state.rows.map((row) => (
            <li key={`${row.row}-${row.code}`}>
              {tx(locale, "第", "Row")} {row.row}: {errText(locale, row.code)}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-sm text-muted">
        {tx(locale, "TCG 用", "TCG template")} <a className="text-link" href="/templates/tcg.csv">tcg.csv</a>
        {" · "}
        {tx(locale, "運動員", "Athletes")} <a className="text-link" href="/templates/athlete.csv">athlete.csv</a>
        {" · "}
        {tx(locale, "明星", "Celebrities")} <a className="text-link" href="/templates/celebrity.csv">celebrity.csv</a>
      </p>
      <p className="text-sm text-muted">{tx(locale, "任何一列錯誤，整批都不會匯入。photo_front 同 photo_back 必填，photo_extra 用 | 分隔。", "Any invalid row rejects the whole file. photo_front and photo_back are required. Separate photo_extra with |.")}</p>
    </form>
  );
}
