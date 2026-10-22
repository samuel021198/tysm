"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveListingAction } from "@/actions/trade";
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

const DEMOS = ["/demo/charizard.svg", "/demo/pikachu.svg", "/demo/luffy.svg", "/demo/back.svg"];

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
  const group = categories.find((cat) => cat.id === categoryId)?.groupKey || "tcg";
  const locked = initial?.locked || false;
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
            <label>
              {tx(locale, "結束時間（香港時間）", "End time (Hong Kong)")}
              <input className="field" type="datetime-local" name="auctionEndsAt" defaultValue={initial?.auctionEndsAt} />
            </label>
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
          <option value="RAW">Raw</option>
          <option value="GRADED">{tx(locale, "評級", "Graded")}</option>
        </select>
        {track === "RAW" ? (
          <select className="field" name="rawGrade" defaultValue={initial?.rawGrade || "A"}>
            {["A", "B", "C", "D"].map((grade) => (
              <option key={grade}>{grade}</option>
            ))}
          </select>
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
          {DEMOS.map((url) => (
            <button
              key={url}
              type="button"
              className="btn-ghost btn"
              onClick={() => setPhotos((current) => current.length >= 12 ? current : [...current, { url, role: "GALLERY" }])}
            >
              {url.split("/").pop()}
            </button>
          ))}
        </div>
        {photos.map((photo, index) => (
          <div key={index} className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-center">
            <input
              className="field"
              value={photo.url}
              onChange={(e) => setPhotos((current) => current.map((item, i) => (i === index ? { ...item, url: e.target.value } : item)))}
              placeholder="https:// 或 /demo/..."
              disabled={locked && index < (initial?.photos.length || 0)}
            />
            <select
              className="field"
              value={photo.role}
              disabled={locked}
              onChange={(e) =>
                setPhotos((current) => current.map((item, i) => (i === index ? { ...item, role: e.target.value as Photo["role"] } : item)))
              }
            >
              <option value="FRONT">Front</option>
              <option value="BACK">Back</option>
              <option value="GALLERY">Gallery</option>
            </select>
            <button type="button" className="btn btn-ghost text-danger" onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}>
              {tx(locale, "移除", "Remove")}
            </button>
          </div>
        ))}
        <button type="button" className="btn-ghost btn w-fit" onClick={() => setPhotos((current) => (current.length >= 12 ? current : [...current, { url: "", role: "GALLERY" }]))}>
          {tx(locale, "加相片", "Add photo")}
        </button>
      </div>

      <label className="grid gap-1 text-sm">
        {tx(locale, "短片網址（可選，最多約 30 秒，系統不會核對時長）", "Video URL (optional, about 30s — duration is not checked)")}
        <input className="field" name="videoUrl" defaultValue={initial?.videoUrl} disabled={locked} placeholder="https://" />
      </label>
      <label className="grid gap-1 text-sm">
        {tx(locale, "預約刊登（香港時間，可選）", "Schedule publish (Hong Kong time, optional)")}
        <input className="field" type="datetime-local" name="publishAt" defaultValue={initial?.publishAt} disabled={locked} />
      </label>

      <IntentButtons locale={locale} locked={locked} />
    </form>
  );
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
