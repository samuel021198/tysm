export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cur);
      cur = "";
    } else if (char === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else if (char !== "\r") cur += char;
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

export const TCG_HEADERS = [
  "title",
  "description",
  "price_hkd",
  "shipping_fee_hkd",
  "shipping_days",
  "quantity",
  "game",
  "set_name",
  "card_name",
  "language",
  "condition_track",
  "raw_grade",
  "grader",
  "grade_score",
  "cert_number",
  "photo_front",
  "photo_back",
  "photo_extra",
  "offers_enabled",
  "min_offer_hkd",
  "sale_type",
  "start_price_hkd",
  "auction_hours",
] as const;

export const PERSON_HEADERS = [
  "title",
  "description",
  "price_hkd",
  "shipping_fee_hkd",
  "shipping_days",
  "quantity",
  "person_name",
  "season_year",
  "brand_series",
  "condition_track",
  "raw_grade",
  "grader",
  "grade_score",
  "cert_number",
  "photo_front",
  "photo_back",
  "photo_extra",
  "offers_enabled",
  "min_offer_hkd",
  "sale_type",
  "start_price_hkd",
  "auction_hours",
] as const;

export function headerIndex(headers: string[], expected: readonly string[]) {
  const map = new Map(headers.map((header, index) => [header.trim(), index]));
  if (expected.some((header) => !map.has(header))) return null;
  return (name: string) => map.get(name) ?? 0;
}
