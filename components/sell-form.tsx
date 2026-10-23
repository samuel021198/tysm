"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveListingAction } from "@/actions/trade";
import { hkPartsToInput } from "@/lib/format";
import { tx, errText, type Locale } from "@/lib/i18n";

type Cat = { id: string; nameZh: string; nameEn: string; groupKey: string };
type Photo = { url: string; role: "FRONT" | "BACK" | "GALLERY" };

export type SellInitial = {
  listingId?: string;
  categoryId: string;
  title: string;
  description: string;
  saleType: string;
  price: string;
  startPrice: string;
  auctionEndsAt: string;
  offersEnabled: boolean;
  minOffer: string;
  shippingFee: string;
  shippingDays: number;
  quantity: number;
  game: string;
  setName: string;
  cardName: string;
  language: string;
  personName: string;
  seasonYear: string;
  brandSeries: string;
  conditionTrack: string;
  rawGrade: string;
  grader: string;
  gradeScore: string;
  certNumber: string;
  videoUrl: string;
  publishAt: string;
  photos: Photo[];
  locked: boolean;
};

const DEMOS = [
  { url: "/demo/cards/seed_charizard.svg", zh: "噴火龍", en: "Charizard" },
  { url: "/demo/cards/seed_pikachu.svg", zh: "皮卡丘", en: "Pikachu" },
  { url: "/demo/cards/seed_luffy.svg", zh: "路飛", en: "Luffy" },
  { url: "/demo/back.svg", zh: "卡背", en: "Back" },
];

const ROLES = [
  ["FRONT", "正面", "Front"],
  ["BACK", "背面", "Back"],
  ["GALLERY", "其他", "Other"],
] as const;

const RAW_OPTIONS = [
  ["A", "A · 近全新", "A · Near mint"],
  ["B", "B · 良好", "B · Good"],
  ["C", "C · 有使用痕跡", "C · Played"],
  ["D", "D · 明顯損傷", "D · Damaged"],
] as const;

function mergePhotos(current: Photo[], incoming: Photo[]) {
  const next = current.map((row) => ({ ...row }));
  for (const photo of incoming) {
    if (next.length >= 12) break;
    const empty = next.findIndex((row) => !row.url);
    if (empty >= 0) next[empty] = { ...next[empty], url: photo.url };
    else next.push(photo);
  }
  return next;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      const maxEdge = 960;
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(blobUrl);
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(blobUrl);
      let quality = 0.72;
      let url = canvas.toDataURL("image/jpeg", quality);
      while (url.length > 140_000 && quality > 0.42) {
        quality -= 0.08;
        url = canvas.toDataURL("image/jpeg", quality);
      }
      if (!url.startsWith("data:image/jpeg") || url.length > 180_000) reject(new Error("big"));
      else resolve(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error("read"));
    };
    img.src = blobUrl;
  });
}

export function SellForm({
  locale,
  categories,
  percent,
  initial,
}: {
  locale: Locale;
  categories: Cat[];
  percent: string;
  initial?: SellInitial;
}) {
  const [state, action] = useActionState(saveListingAction, null);
  const [categoryId, setCategoryId] = useState(initial?.categoryId || categories[0]?.id || "");
  const [saleType, setSaleType] = useState(initial?.saleType || "BUY_NOW");
  const [track, setTrack] = useState(initial?.conditionTrack || "RAW");
  const [offers, setOffers] = useState(initial?.offersEnabled || false);
  const [price, setPrice] = useState(initial?.price || "");
  const [photos, setPhotos] = useState<Photo[]>(initial?.photos?.length ? initial.photos : [
    { url: "", role: "FRONT" },
    { url: "", role: "BACK" },
  ]);
  const [photoNote, setPhotoNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const group = categories.find((cat) => cat.id === categoryId)?.groupKey || "tcg";
  const locked = initial?.locked || false;
  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    const urls: string[] = [];
    let failed = 0;
    for (const file of Array.from(list)) {
      if (!file.type.startsWith("image/")) {
        failed += 1;
        continue;
      }
      try {
        urls.push(await fileToDataUrl(file));
      } catch {
        failed += 1;
      }
    }
    if (urls.length) setPhotos((current) => mergePhotos(current, urls.map((url) => ({ url, role: "GALLERY" as const }))));
    setPhotoNote(failed ? tx(locale, "有相片讀唔到，請改用 JPG 或 PNG。", "Some photos could not be read. Use JPG or PNG.") : "");
    if (fileRef.current) fileRef.current.value = "";
  }

  const fee = useMemo(() => {
    const n = Number(price);
    return Number.isFinite(n) ? ((n * Number(percent)) / 100).toFixed(2) : "0.00";
  }, [price, percent]);

  return (
    <form action={action} className="grid min-w-0 gap-4">
      {initial?.listingId ? <input type="hidden" name="listingId" value={initial.listingId} /> : null}
      <input type="hidden" name="photos" value={JSON.stringify(photos)} />
      {locked && initial ? (
        <>
          <input type="hidden" name="categoryId" value={initial.categoryId} />
          <input type="hidden" name="saleType" value={initial.saleType} />
          <input type="hidden" name="title" value={initial.title} />
          <input type="hidden" name="price" value={initial.price} />
          <input type="hidden" name="startPrice" value={initial.startPrice} />
          <input type="hidden" name="auctionEndsAt" value={initial.auctionEndsAt} />
          <input type="hidden" name="minOffer" value={initial.minOffer} />
          {initial.offersEnabled ? <input type="hidden" name="offersEnabled" value="on" /> : null}
          <input type="hidden" name="shippingFee" value={initial.shippingFee} />
          <input type="hidden" name="shippingDays" value={initial.shippingDays} />
          <input type="hidden" name="quantity" value={initial.quantity} />
          <input type="hidden" name="game" value={initial.game} />
          <input type="hidden" name="setName" value={initial.setName} />
          <input type="hidden" name="cardName" value={initial.cardName} />
          <input type="hidden" name="language" value={initial.language} />
          <input type="hidden" name="personName" value={initial.personName} />
          <input type="hidden" name="seasonYear" value={initial.seasonYear} />
          <input type="hidden" name="brandSeries" value={initial.brandSeries} />
          <input type="hidden" name="conditionTrack" value={initial.conditionTrack} />
          <input type="hidden" name="rawGrade" value={initial.rawGrade} />
          <input type="hidden" name="grader" value={initial.grader} />
          <input type="hidden" name="gradeScore" value={initial.gradeScore} />
          <input type="hidden" name="certNumber" value={initial.certNumber} />
          <input type="hidden" name="videoUrl" value={initial.videoUrl} />
        </>
      ) : null}
      {state?.error ? <p className="rounded-xl bg-soft px-3 py-2 text-sm text-danger">{errText(locale, state.error)}</p> : null}
      {locked ? <p className="text-sm text-muted">{tx(locale, "已有出價：只可以改描述同加相片。", "This auction has bids. You can only edit the description and add photos.")}</p> : null}

      <label className="grid gap-1 text-sm">
        {tx(locale, "分類", "Category")}
        <select className="field" name="categoryId" value={categoryId} disabled={locked} onChange={(e) => setCategoryId(e.target.value)}>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {locale === "en" ? cat.nameEn : cat.nameZh}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        {tx(locale, "標題", "Title")}
        <input className="field" name="title" required minLength={2} maxLength={80} defaultValue={initial?.title} disabled={locked} />
      </label>
      <label className="grid gap-1 text-sm">
        {tx(locale, "描述（可用 **粗體**、換行、- 清單）", "Description (**bold**, new lines, - lists)")}
        <textarea className="field min-h-28" name="description" defaultValue={initial?.description} />
      </label>

      <fieldset className="grid gap-2 text-sm" disabled={locked}>
        <legend>{tx(locale, "售賣方式", "Sale format")}</legend>
        <select className="field" name="saleType" value={saleType} onChange={(e) => setSaleType(e.target.value)}>
          <option value="BUY_NOW">{tx(locale, "直購", "Buy Now")}</option>
          <option value="AUCTION">{tx(locale, "拍賣", "Auction")}</option>
          <option value="BOTH">{tx(locale, "拍賣 + 直購", "Auction + Buy It Now")}</option>
        </select>
        {saleType !== "AUCTION" ? (
          <label>
            {tx(locale, "直購價 HKD", "Buy Now HKD")}
            <input className="field" name="price" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
          </label>
        ) : null}
        {saleType !== "BUY_NOW" ? (
          <>
            <label>
              {tx(locale, "起標價 HKD", "Start price HKD")}
              <input className="field" name="startPrice" defaultValue={initial?.startPrice} inputMode="decimal" />
            </label>
            <div>
              <p className="mb-1">{tx(locale, "結束時間（香港時間）", "End time (Hong Kong)")}</p>
              <HkDateTime locale={locale} name="auctionEndsAt" defaultValue={initial?.auctionEndsAt} disabled={locked} />
            </div>
          </>
        ) : null}
        {saleType !== "AUCTION" ? (
          <label className="flex items-center gap-2">
            <input type="checkbox" name="offersEnabled" checked={offers} onChange={(e) => setOffers(e.target.checked)} />
            {tx(locale, "接受議價", "Allow offers")}
          </label>
        ) : null}
        {offers && saleType !== "AUCTION" ? (
          <label>
            {tx(locale, "最低接受價 HKD", "Minimum offer HKD")}
            <input className="field" name="minOffer" defaultValue={initial?.minOffer} inputMode="decimal" />
          </label>
        ) : null}
        <p className="text-muted">
          {tx(locale, `按目前佣金 ${percent}% 估計，直購價佣金約 HK$${fee}（由賣家貨款扣除，運費不計佣）。`, `At ${percent}% commission, about HK$${fee} would be deducted from the item price. Shipping is not commissioned.`)}
        </p>
      </fieldset>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm">
          {tx(locale, "運費 HKD", "Shipping HKD")}
          <input className="field" name="shippingFee" defaultValue={initial?.shippingFee || "0"} disabled={locked} />
        </label>
        <label className="text-sm">
          {tx(locale, "寄出日數", "Ship within days")}
          <input className="field" name="shippingDays" type="number" min={1} max={30} defaultValue={initial?.shippingDays || 3} disabled={locked} />
        </label>
        <label className="text-sm">
          {tx(locale, "數量", "Quantity")}
          <input className="field" name="quantity" type="number" min={1} max={99} defaultValue={initial?.quantity || 1} disabled={locked} />
        </label>
      </div>

      {group === "tcg" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">{tx(locale, "遊戲", "Game")}<input className="field" name="game" defaultValue={initial?.game} disabled={locked} /></label>
          <label className="text-sm">{tx(locale, "系列", "Set")}<input className="field" name="setName" defaultValue={initial?.setName} disabled={locked} /></label>
          <label className="text-sm">{tx(locale, "卡名", "Card name")}<input className="field" name="cardName" defaultValue={initial?.cardName} disabled={locked} /></label>
          <label className="text-sm">
            {tx(locale, "語言", "Language")}
            <input className="field" name="language" defaultValue={initial?.language} disabled={locked} list="langs" />
            <datalist id="langs">
              {["繁體中文", "簡體中文", "英文", "日文", "韓文"].map((lang) => (
                <option key={lang} value={lang} />
              ))}
            </datalist>
          </label>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">{tx(locale, "人物", "Person")}<input className="field" name="personName" defaultValue={initial?.personName} disabled={locked} /></label>
          <label className="text-sm">{tx(locale, "賽季／年份", "Season / year")}<input className="field" name="seasonYear" defaultValue={initial?.seasonYear} disabled={locked} /></label>
          <label className="text-sm">{tx(locale, "品牌／系列", "Brand / series")}<input className="field" name="brandSeries" defaultValue={initial?.brandSeries} disabled={locked} /></label>
        </div>
      )}

      <fieldset className="grid gap-2 text-sm" disabled={locked}>
        <legend>{tx(locale, "品相", "Condition")}</legend>
        <select className="field" name="conditionTrack" value={track} onChange={(e) => setTrack(e.target.value)}>
          <option value="RAW">{tx(locale, "未評級", "Raw")}</option>
          <option value="GRADED">{tx(locale, "評級", "Graded")}</option>
        </select>
        {track === "RAW" ? (
          <label className="grid gap-1">
            {tx(locale, "未評級品相", "Raw grade")}
            <select className="field" name="rawGrade" defaultValue={initial?.rawGrade || "A"} aria-label={tx(locale, "未評級品相", "Raw grade")}>
              {RAW_OPTIONS.map(([grade, zh, en]) => (
                <option key={grade} value={grade}>{tx(locale, zh, en)}</option>
              ))}
            </select>
          </label>
        ) : (
          <div className="grid gap-2 md:grid-cols-3">
            <select className="field" name="grader" defaultValue={initial?.grader || "PSA"}>
              {["PSA", "BGS", "CGC", "TAG"].map((grader) => (
                <option key={grader}>{grader}</option>
              ))}
            </select>
            <input className="field" name="gradeScore" placeholder={tx(locale, "分數", "Score")} defaultValue={initial?.gradeScore} />
            <input className="field" name="certNumber" placeholder={tx(locale, "證書編號（可選）", "Cert # (optional)")} defaultValue={initial?.certNumber} />
          </div>
        )}
      </fieldset>

      <div className="grid gap-2">
        <p className="text-sm">{tx(locale, "相片（最少 2 張，最多 12 張。評級卡要有正面同背面）", "Photos (2–12). Graded cards need front and back.")}</p>
        <div className="flex flex-wrap gap-2">
          <label className="btn btn-primary w-fit cursor-pointer">
            {tx(locale, "從相簿加入", "Add from camera roll")}
            <input
              ref={fileRef}
              className="sr-only"
              type="file"
              accept="image/*"
              multiple
              disabled={photos.filter((photo) => photo.url).length >= 12}
              onChange={(e) => void onFiles(e.target.files)}
            />
          </label>
          {DEMOS.map((demo) => (
            <button
              key={demo.url}
              type="button"
              className="btn-ghost btn gap-2 px-2"
              onClick={() => setPhotos((current) => mergePhotos(current, [{ url: demo.url, role: "GALLERY" }]))}
            >
              <img src={demo.url} alt="" className="h-10 w-8 rounded-md bg-[#f4efe6] object-contain" />
              {tx(locale, demo.zh, demo.en)}
            </button>
          ))}
        </div>
        {photoNote ? <p className="text-sm text-danger">{photoNote}</p> : null}
        {photos.map((photo, index) => (
          <div key={index} className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
            {photo.url ? (
              <img src={photo.url} alt="" className="h-20 w-16 rounded-xl bg-[#f4efe6] object-contain ring-1 ring-[#5c3a4a]/30" />
            ) : (
              <div className="grid h-20 w-16 place-items-center rounded-xl bg-[#f4efe6] text-xs text-muted ring-1 ring-[#5c3a4a]/30">{tx(locale, "未有", "Empty")}</div>
            )}
            <div className="grid min-w-0 gap-2">
              {photo.url.startsWith("data:") ? (
                <p className="field flex items-center text-sm">{tx(locale, "已從相簿上傳", "Uploaded from camera roll")}</p>
              ) : (
                <input
                  className="field"
                  value={photo.url}
                  onChange={(e) => setPhotos((current) => current.map((item, i) => (i === index ? { ...item, url: e.target.value } : item)))}
                  placeholder="https:// 或 /demo/..."
                  disabled={locked && index < (initial?.photos.length || 0)}
                />
              )}
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <select
                  className="field"
                  value={photo.role}
                  aria-label={tx(locale, "相片位置", "Photo role")}
                  disabled={locked}
                  onChange={(e) =>
                    setPhotos((current) => current.map((item, i) => (i === index ? { ...item, role: e.target.value as Photo["role"] } : item)))
                  }
                >
                  {ROLES.map(([role, zh, en]) => (
                    <option key={role} value={role}>{tx(locale, zh, en)}</option>
                  ))}
                </select>
                <button type="button" className="btn btn-ghost text-danger" onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}>
                  {tx(locale, "移除", "Remove")}
                </button>
              </div>
            </div>
          </div>
        ))}
        <button type="button" className="btn-ghost btn w-fit" onClick={() => setPhotos((current) => (current.length >= 12 ? current : [...current, { url: "", role: "GALLERY" }]))}>
          {tx(locale, "加網址", "Add URL")}
        </button>
      </div>

      <label className="grid gap-1 text-sm">
        {tx(locale, "短片網址（可選，最多約 30 秒，系統不會核對時長）", "Video URL (optional, about 30s — duration is not checked)")}
        <input className="field" name="videoUrl" defaultValue={initial?.videoUrl} disabled={locked} placeholder="https://" />
      </label>
      <label className="grid gap-1 text-sm">
        {tx(locale, "預約刊登（香港時間，可選）", "Schedule publish (Hong Kong time, optional)")}
        <HkDateTime locale={locale} name="publishAt" defaultValue={initial?.publishAt} disabled={locked} />
      </label>

      <IntentButtons locale={locale} locked={locked} />
    </form>
  );
}

function HkDateTime({
  locale,
  name,
  defaultValue,
  disabled,
}: {
  locale: Locale;
  name: string;
  defaultValue?: string;
  disabled?: boolean;
}) {
  const init = splitHk(defaultValue || "");
  const [day, setDay] = useState(init.day);
  const [month, setMonth] = useState(init.month);
  const [year, setYear] = useState(init.year);
  const [hour, setHour] = useState(init.hour);
  const [minute, setMinute] = useState(init.minute);
  const value = hkPartsToInput(day, month, year, hour, minute);
  const fields = [
    ["day", tx(locale, "日", "Day"), day, setDay, "23", 2],
    ["month", tx(locale, "月", "Month"), month, setMonth, "10", 2],
    ["year", tx(locale, "年", "Year"), year, setYear, "2026", 4],
    ["hour", tx(locale, "時", "Hour"), hour, setHour, "18", 2],
    ["minute", tx(locale, "分", "Min"), minute, setMinute, "00", 2],
  ] as const;
  return (
    <div className="grid gap-2">
      <input type="hidden" name={disabled ? undefined : name} value={value} />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {fields.map(([key, label, current, set, placeholder, max]) => (
          <label key={key} className="grid gap-1 text-xs text-muted">
            {label}
            <input
              className="field px-2 text-center"
              inputMode="numeric"
              autoComplete="off"
              disabled={disabled}
              maxLength={max}
              placeholder={placeholder}
              value={current}
              onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, max))}
            />
          </label>
        ))}
      </div>
      <p className="text-xs text-muted">{tx(locale, "日/月/年 · 24 小時 · 香港時間", "Day/month/year · 24-hour · Hong Kong time")}</p>
    </div>
  );
}

function splitHk(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return { year: "", month: "", day: "", hour: "", minute: "" };
  return {
    year: match[1],
    month: String(Number(match[2])),
    day: String(Number(match[3])),
    hour: String(Number(match[4])),
    minute: String(Number(match[5])),
  };
}

function IntentButtons({ locale, locked }: { locale: Locale; locked: boolean }) {
  const { pending } = useFormStatus();
  return (
    <div className="grid gap-2 sm:flex sm:flex-wrap">
      <button className="sell-cta btn w-full sm:w-auto" name="intent" value="publish" disabled={pending}>
        {pending ? tx(locale, "處理中", "Working") : tx(locale, "刊登", "Publish")}
      </button>
      <button className="btn-ghost btn" name="intent" value="draft" disabled={locked || pending}>
        {tx(locale, "存草稿", "Save draft")}
      </button>
      <button className="btn-ghost btn" name="intent" value="schedule" disabled={locked || pending}>
        {tx(locale, "預約", "Schedule")}
      </button>
    </div>
  );
}
