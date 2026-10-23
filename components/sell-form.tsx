"use client";

import { useActionState, useMemo, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { useFormStatus } from "react-dom";
import { saveListingAction } from "@/actions/trade";
import { hkPartsToInput } from "@/lib/format";
import { tx, errText, type Locale } from "@/lib/i18n";
import { fileToDataUrl } from "./photo-file";

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
  shipLockerFee: string;
  shipMeetFee: string;
  shippingDays: number;
  quantity: number;
  game: string;
  setName: string;
  cardName: string;
  cardNumber: string;
  rarity: string;
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
  { url: "/demo/cards/seed_charizard-back.svg", zh: "卡背", en: "Back" },
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

const GROUPS = [
  ["tcg", "TCG", "TCG"],
  ["athlete", "運動員", "Athletes"],
  ["celebrity", "明星", "Celebrities"],
] as const;

const STEPS = [
  ["相片", "Photos"],
  ["資料", "Details"],
  ["售價", "Price"],
  ["運送", "Shipping"],
  ["預覽", "Review"],
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

export function SellForm({
  locale,
  categories,
  percent,
  initial,
  hints = [],
}: {
  locale: Locale;
  categories: Cat[];
  percent: string;
  initial?: SellInitial;
  hints?: { title: string; price: string }[];
}) {
  const [state, action] = useActionState(saveListingAction, null);
  const [step, setStep] = useState(0);
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
  const [preview, setPreview] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
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

  const feeCopy =
    saleType === "AUCTION"
      ? tx(locale, `拍賣成交後按佣金 ${percent}% 從成交價扣除，運費不計佣。`, `Auction commission is ${percent}% of the hammer price. Shipping is excluded.`)
      : saleType === "BOTH"
        ? tx(locale, `直購或拍賣成交後按 ${percent}% 計佣。以直購價估算約 HK$${fee}，運費不計佣。`, `Commission is ${percent}% of the sale price. About HK$${fee} on this Buy It Now price. Shipping is excluded.`)
        : tx(locale, `按目前佣金 ${percent}% 估計，直購價佣金約 HK$${fee}（由賣家貨款扣除，運費不計佣）。`, `At ${percent}% commission, about HK$${fee} would be deducted from the item price. Shipping is not commissioned.`);

  function go(next: number) {
    if (next === 4 && formRef.current) {
      const data = new FormData(formRef.current);
      const snap: Record<string, string> = {};
      data.forEach((value, key) => {
        if (typeof value === "string") snap[key] = value;
      });
      setPreview(snap);
    }
    setStep(Math.max(0, Math.min(4, next)));
  }

  return (
    <form ref={formRef} action={action} className="grid min-w-0 gap-4">
      {initial?.listingId ? <input type="hidden" name="listingId" value={initial.listingId} /> : null}
      <input type="hidden" name="photos" value={JSON.stringify(photos)} />
      {locked && initial ? <LockedFields initial={initial} /> : null}
      {state?.error ? <p className="rounded-xl bg-soft px-3 py-2 text-sm text-danger">{errText(locale, state.error)}</p> : null}
      {locked ? <p className="text-sm text-muted">{tx(locale, "已有出價：只可以改描述同加相片。", "This auction has bids. You can only edit the description and add photos.")}</p> : null}

      {!locked ? (
        <ol className="flex gap-2 overflow-x-auto text-xs">
          {STEPS.map(([zh, en], index) => (
            <li key={zh}>
              <button type="button" className={`whitespace-nowrap rounded-full px-3 py-2 ${index === step ? "bg-[#1b1418] text-[#fff8f4]" : "bg-soft"}`} onClick={() => go(index)}>
                {index + 1}. {tx(locale, zh, en)}
              </button>
            </li>
          ))}
        </ol>
      ) : null}

      <div hidden={!locked && step !== 0} className="grid gap-3">
        <p className="text-sm">{tx(locale, "相片（最少 2 張，最多 12 張。評級卡要有正面同背面）", "Photos (2–12). Graded cards need front and back.")}</p>
        <PhotoFields locale={locale} photos={photos} setPhotos={setPhotos} locked={locked} initialCount={initial?.photos.length || 0} fileRef={fileRef} onFiles={onFiles} note={photoNote} />
      </div>

      <div hidden={locked || step !== 1} className="grid gap-3">
        <label className="grid gap-1 text-sm">
          {tx(locale, "分類", "Category")}
          <select className="field" name="categoryId" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {GROUPS.map(([key, zh, en]) => (
              <optgroup key={key} label={tx(locale, zh, en)}>
                {categories.filter((cat) => cat.groupKey === key).map((cat) => (
                  <option key={cat.id} value={cat.id}>{locale === "en" ? cat.nameEn : cat.nameZh}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          {tx(locale, "標題", "Title")}
          <input className="field" name="title" minLength={2} maxLength={80} defaultValue={initial?.title} />
        </label>
        <label className="grid gap-1 text-sm">
          {tx(locale, "描述（可用 **粗體**、換行、- 清單）", "Description (**bold**, new lines, - lists)")}
          <textarea className="field min-h-28" name="description" defaultValue={initial?.description} />
        </label>
        {group === "tcg" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">{tx(locale, "遊戲", "Game")}<input className="field" name="game" defaultValue={initial?.game} /></label>
            <label className="text-sm">{tx(locale, "系列", "Set")}<input className="field" name="setName" defaultValue={initial?.setName} /></label>
            <label className="text-sm">{tx(locale, "卡名", "Card name")}<input className="field" name="cardName" defaultValue={initial?.cardName} /></label>
            <label className="text-sm">{tx(locale, "卡號", "Card number")}<input className="field" name="cardNumber" defaultValue={initial?.cardNumber} placeholder="020/189" /></label>
            <label className="text-sm">{tx(locale, "稀有度", "Rarity")}<input className="field" name="rarity" defaultValue={initial?.rarity} placeholder="SR / RR / SEC" /></label>
            <label className="text-sm">
              {tx(locale, "語言", "Language")}
              <input className="field" name="language" defaultValue={initial?.language} list="langs" />
              <datalist id="langs">
                {["繁體中文", "簡體中文", "英文", "日文", "韓文"].map((lang) => (
                  <option key={lang} value={lang} />
                ))}
              </datalist>
            </label>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">{tx(locale, "人物", "Person")}<input className="field" name="personName" defaultValue={initial?.personName} /></label>
            <label className="text-sm">{tx(locale, "賽季／年份", "Season / year")}<input className="field" name="seasonYear" defaultValue={initial?.seasonYear} /></label>
            <label className="text-sm">{tx(locale, "品牌／系列", "Brand / series")}<input className="field" name="brandSeries" defaultValue={initial?.brandSeries} /></label>
            <label className="text-sm">{tx(locale, "卡號", "Card number")}<input className="field" name="cardNumber" defaultValue={initial?.cardNumber} placeholder="No.23" /></label>
            <label className="text-sm">{tx(locale, "稀有度", "Rarity")}<input className="field" name="rarity" defaultValue={initial?.rarity} placeholder="BASE / AUTO" /></label>
          </div>
        )}
        <fieldset className="grid gap-2 text-sm">
          <legend>{tx(locale, "品相", "Condition")}</legend>
          <select className="field" name="conditionTrack" value={track} onChange={(e) => setTrack(e.target.value)}>
            <option value="RAW">{tx(locale, "未評級", "Raw")}</option>
            <option value="GRADED">{tx(locale, "評級", "Graded")}</option>
          </select>
          {track === "RAW" ? (
            <select className="field" name="rawGrade" defaultValue={initial?.rawGrade || "A"} aria-label={tx(locale, "未評級品相", "Raw grade")}>
              {RAW_OPTIONS.map(([grade, zh, en]) => (
                <option key={grade} value={grade}>{tx(locale, zh, en)}</option>
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
        <label className="grid gap-1 text-sm">
          {tx(locale, "短片網址（可選）", "Video URL (optional)")}
          <input className="field" name="videoUrl" defaultValue={initial?.videoUrl} placeholder="https://" />
        </label>
      </div>

      <div hidden={locked || step !== 2} className="grid gap-3 text-sm">
        <label className="grid gap-1">
          {tx(locale, "售賣方式", "Sale format")}
          <select className="field" name="saleType" value={saleType} onChange={(e) => setSaleType(e.target.value)}>
            <option value="BUY_NOW">{tx(locale, "直購", "Buy Now")}</option>
            <option value="AUCTION">{tx(locale, "拍賣", "Auction")}</option>
            <option value="BOTH">{tx(locale, "拍賣 + 直購", "Auction + Buy It Now")}</option>
          </select>
        </label>
        {saleType !== "AUCTION" ? (
          <label className="grid gap-1">
            {tx(locale, "直購價 HKD", "Buy Now HKD")}
            <input className="field" name="price" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
          </label>
        ) : null}
        {saleType !== "BUY_NOW" ? (
          <>
            <label className="grid gap-1">
              {tx(locale, "起標價 HKD", "Start price HKD")}
              <input className="field" name="startPrice" defaultValue={initial?.startPrice} inputMode="decimal" />
            </label>
            <div>
              <p className="mb-1">{tx(locale, "結束時間（香港時間）", "End time (Hong Kong)")}</p>
              <HkDateTime locale={locale} name="auctionEndsAt" defaultValue={initial?.auctionEndsAt} />
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
          <label className="grid gap-1">
            {tx(locale, "最低接受價 HKD", "Minimum offer HKD")}
            <input className="field" name="minOffer" defaultValue={initial?.minOffer} inputMode="decimal" />
          </label>
        ) : null}
        <p className="text-muted">{feeCopy}</p>
        {hints.length ? (
          <div className="rounded-2xl bg-soft p-3">
            <p className="font-medium">{tx(locale, "近期站內成交", "Recent sold prices")}</p>
            <ul className="mt-1 text-muted">
              {hints.map((hint) => (
                <li key={hint.title}>{hint.title} · {hint.price}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-muted">{tx(locale, "刊登後，商品頁會顯示同一品相的站內成交價。", "After publishing, the listing shows sold prices for the same grade.")}</p>
        )}
        <label className="grid gap-1">
          {tx(locale, "數量", "Quantity")}
          <input className="field" name="quantity" type="number" min={1} max={99} defaultValue={initial?.quantity || 1} />
        </label>
      </div>

      <div hidden={locked || step !== 3} className="grid gap-3 text-sm">
        <label className="grid gap-1">
          {tx(locale, "順豐速運 HKD", "SF Express HKD")}
          <input className="field" name="shippingFee" defaultValue={initial?.shippingFee || "20"} />
        </label>
        <label className="grid gap-1">
          {tx(locale, "順豐智能櫃 HKD", "SF locker HKD")}
          <input className="field" name="shipLockerFee" defaultValue={initial?.shipLockerFee || "12"} />
        </label>
        <label className="grid gap-1">
          {tx(locale, "面交 HKD", "Meet-up HKD")}
          <input className="field" name="shipMeetFee" defaultValue={initial?.shipMeetFee || "0"} />
        </label>
        <label className="grid gap-1">
          {tx(locale, "順豐寄出日數", "SF handling days")}
          <input className="field" name="shippingDays" type="number" min={1} max={30} defaultValue={initial?.shippingDays || 2} />
        </label>
        <p className="text-muted">{tx(locale, "買家可以喺結帳揀其中一種。同一賣家多件貨會逐件計運費。", "Buyers pick one method at checkout. Items from the same seller add their own fees.")}</p>
      </div>

      {!locked && step === 4 ? (
        <section className="surface grid gap-2 p-4 text-sm">
          <h2 className="font-semibold">{tx(locale, "刊登預覽", "Preview")}</h2>
          <div className="flex gap-2 overflow-x-auto">
            {photos.filter((photo) => photo.url).map((photo, index) => (
              <img key={index} src={photo.url} alt="" className="h-28 w-20 shrink-0 rounded-xl bg-[#f4efe6] object-contain" />
            ))}
          </div>
          <p className="font-medium">{preview.title || initial?.title || tx(locale, "未填標題", "No title yet")}</p>
          <p className="text-muted">{preview.description || initial?.description}</p>
          <p>{saleType === "AUCTION" ? tx(locale, "拍賣", "Auction") : saleType === "BOTH" ? tx(locale, "直購 + 拍賣", "Buy now + auction") : tx(locale, "直購", "Buy now")}{price ? ` · HK$${price}` : ""}</p>
          <p className="text-muted">{feeCopy}</p>
          <div>
            <p className="mb-1">{tx(locale, "預約刊登（香港時間，可選）", "Schedule publish (Hong Kong time, optional)")}</p>
            <HkDateTime locale={locale} name="publishAt" defaultValue={initial?.publishAt} />
          </div>
        </section>
      ) : null}

      {locked ? (
        <label className="grid gap-1 text-sm">
          {tx(locale, "描述（可用 **粗體**、換行、- 清單）", "Description (**bold**, new lines, - lists)")}
          <textarea className="field min-h-28" name="description" defaultValue={initial?.description} />
        </label>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!locked && step > 0 ? (
          <button type="button" className="btn btn-ghost" onClick={() => go(step - 1)}>{tx(locale, "上一步", "Back")}</button>
        ) : null}
        {!locked && step < 4 ? (
          <button type="button" className="btn btn-primary" onClick={() => go(step + 1)}>{tx(locale, "下一步", "Next")}</button>
        ) : null}
        {locked || step === 4 ? <IntentButtons locale={locale} locked={locked} /> : (
          <DraftButton locale={locale} />
        )}
      </div>
    </form>
  );
}

function LockedFields({ initial }: { initial: SellInitial }) {
  return (
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
      <input type="hidden" name="shipLockerFee" value={initial.shipLockerFee} />
      <input type="hidden" name="shipMeetFee" value={initial.shipMeetFee} />
      <input type="hidden" name="shippingDays" value={initial.shippingDays} />
      <input type="hidden" name="quantity" value={initial.quantity} />
      <input type="hidden" name="game" value={initial.game} />
      <input type="hidden" name="setName" value={initial.setName} />
      <input type="hidden" name="cardName" value={initial.cardName} />
      <input type="hidden" name="cardNumber" value={initial.cardNumber} />
      <input type="hidden" name="rarity" value={initial.rarity} />
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
  );
}

function PhotoFields({
  locale,
  photos,
  setPhotos,
  locked,
  initialCount,
  fileRef,
  onFiles,
  note,
}: {
  locale: Locale;
  photos: Photo[];
  setPhotos: Dispatch<SetStateAction<Photo[]>>;
  locked: boolean;
  initialCount: number;
  fileRef: RefObject<HTMLInputElement | null>;
  onFiles: (list: FileList | null) => void;
  note: string;
}) {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <label className="btn btn-primary w-fit cursor-pointer">
          {tx(locale, "從相簿加入", "Add from camera roll")}
          <input ref={fileRef} className="sr-only" type="file" accept="image/*" multiple disabled={photos.filter((photo) => photo.url).length >= 12} onChange={(e) => void onFiles(e.target.files)} />
        </label>
        {DEMOS.map((demo) => (
          <button key={demo.url} type="button" className="btn-ghost btn gap-2 px-2" onClick={() => setPhotos((current) => mergePhotos(current, [{ url: demo.url, role: demo.url.includes("-back") ? "BACK" : "GALLERY" }]))}>
            <img src={demo.url} alt="" className="h-10 w-8 rounded-md bg-[#f4efe6] object-contain" />
            {tx(locale, demo.zh, demo.en)}
          </button>
        ))}
      </div>
      {note ? <p className="text-sm text-danger">{note}</p> : null}
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
              <input className="field" value={photo.url} onChange={(e) => setPhotos((current) => current.map((item, i) => (i === index ? { ...item, url: e.target.value } : item)))} placeholder="https:// 或 /demo/..." disabled={locked && index < initialCount} />
            )}
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <select className="field" value={photo.role} aria-label={tx(locale, "相片位置", "Photo role")} disabled={locked} onChange={(e) => setPhotos((current) => current.map((item, i) => (i === index ? { ...item, role: e.target.value as Photo["role"] } : item)))}>
                {ROLES.map(([role, zh, en]) => (
                  <option key={role} value={role}>{tx(locale, zh, en)}</option>
                ))}
              </select>
              <button type="button" className="btn btn-ghost text-danger" onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}>{tx(locale, "移除", "Remove")}</button>
            </div>
          </div>
        </div>
      ))}
      <button type="button" className="btn-ghost btn w-fit" onClick={() => setPhotos((current) => (current.length >= 12 ? current : [...current, { url: "", role: "GALLERY" }]))}>{tx(locale, "加網址", "Add URL")}</button>
    </>
  );
}

function hkStamp(daysAhead: number, hour: number, minute: number) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const base = new Date(`${today}T12:00:00+08:00`);
  const next = new Date(base.getTime() + daysAhead * 86400000);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit" }).format(next);
  const [year, month, day] = date.split("-");
  return { year, month: String(Number(month)), day: String(Number(day)), hour: String(hour), minute: String(minute) };
}

function HkDateTime({ locale, name, defaultValue, disabled }: { locale: Locale; name: string; defaultValue?: string; disabled?: boolean }) {
  const init = splitHk(defaultValue || "");
  const [day, setDay] = useState(init.day);
  const [month, setMonth] = useState(init.month);
  const [year, setYear] = useState(init.year);
  const [hour, setHour] = useState(init.hour);
  const [minute, setMinute] = useState(init.minute);
  const value = hkPartsToInput(day, month, year, hour, minute);
  const nowYear = new Date().getFullYear();
  const presets = [
    [tx(locale, "今晚 21:00", "Tonight 21:00"), hkStamp(Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Hong_Kong", hour: "2-digit", hourCycle: "h23" }).format(new Date())) >= 21 ? 1 : 0, 21, 0)],
    [tx(locale, "明日 21:00", "Tomorrow 21:00"), hkStamp(1, 21, 0)],
    [tx(locale, "3 日後 21:00", "In 3 days"), hkStamp(3, 21, 0)],
    [tx(locale, "7 日後 21:00", "In 7 days"), hkStamp(7, 21, 0)],
  ] as const;
  function apply(parts: { year: string; month: string; day: string; hour: string; minute: string }) {
    setYear(parts.year);
    setMonth(parts.month);
    setDay(parts.day);
    setHour(parts.hour);
    setMinute(parts.minute);
  }
  return (
    <div className="grid gap-2">
      <input type="hidden" name={disabled ? undefined : name} value={value} />
      {!disabled ? (
        <div className="flex flex-wrap gap-2">
          {presets.map(([label, parts]) => (
            <button key={label} type="button" className="btn btn-ghost" onClick={() => apply(parts)}>{label}</button>
          ))}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <SelectBox label={tx(locale, "日", "Day")} value={day} disabled={disabled} onChange={setDay} options={range(1, 31)} />
        <SelectBox label={tx(locale, "月", "Month")} value={month} disabled={disabled} onChange={setMonth} options={range(1, 12)} />
        <SelectBox label={tx(locale, "年", "Year")} value={year} disabled={disabled} onChange={setYear} options={[nowYear, nowYear + 1].map(String)} />
        <SelectBox label={tx(locale, "時", "Hour")} value={hour} disabled={disabled} onChange={setHour} options={range(0, 23)} />
        <SelectBox label={tx(locale, "分", "Min")} value={minute} disabled={disabled} onChange={setMinute} options={["0", "15", "30", "45"]} />
      </div>
      <p className="text-xs text-muted">{value ? `${tx(locale, "香港時間", "Hong Kong time")} ${value.replace("T", " ")}` : tx(locale, "請選擇結束時間", "Choose an end time")}</p>
    </div>
  );
}

function SelectBox({ label, value, options, disabled, onChange }: { label: string; value: string; options: string[]; disabled?: boolean; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-xs text-muted">
      {label}
      <select className="field" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option} value={option}>{option.padStart(2, "0")}</option>
        ))}
      </select>
    </label>
  );
}

function range(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, index) => String(from + index));
}

function splitHk(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return { year: "", month: "", day: "", hour: "", minute: "" };
  return {
    year: match[1],
    month: String(Number(match[2])),
    day: String(Number(match[3])),
    hour: String(Number(match[4])),
    minute: String(Math.floor(Number(match[5]) / 15) * 15),
  };
}

function IntentButtons({ locale, locked }: { locale: Locale; locked: boolean }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button className="sell-cta btn w-full sm:w-auto" name="intent" value="publish" disabled={pending}>
        {pending ? tx(locale, "處理中", "Working") : tx(locale, "刊登", "Publish")}
      </button>
      <button className="btn-ghost btn" name="intent" value="draft" disabled={locked || pending}>{tx(locale, "存草稿", "Save draft")}</button>
      <button className="btn-ghost btn" name="intent" value="schedule" disabled={locked || pending}>{tx(locale, "預約", "Schedule")}</button>
    </>
  );
}

function DraftButton({ locale }: { locale: Locale }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-ghost btn" name="intent" value="draft" disabled={pending}>{tx(locale, "存草稿", "Save draft")}</button>
  );
}
