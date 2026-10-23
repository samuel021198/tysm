"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type ReactNode, type RefObject, type SetStateAction } from "react";
import { useFormStatus } from "react-dom";
import { saveListingAction } from "@/actions/trade";
import { DISTRICTS, hkPartsToInput } from "@/lib/format";
import { tx, errText, type Locale } from "@/lib/i18n";
import { parseListingForm, wizardPanels, wizardPublishIssues, wizardStepForIssue, wizardStepIssues, type ListingInput } from "@/lib/sell-wizard";
import { fileToDataUrl } from "./photo-file";

type Cat = { id: string; nameZh: string; nameEn: string; groupKey: string };
type Photo = { url: string; role: "FRONT" | "BACK" | "GALLERY" };
type BlockKind = "next" | "draft" | "publish";

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
  shippingDays: number;
  shipSfCod: boolean;
  shipMeetup: boolean;
  shipPickup: boolean;
  meetupDistrict: string;
  meetupWindow: string;
  meetupNotes: string;
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

function filledCount(photos: Photo[]) {
  return photos.filter((photo) => photo.url).length;
}

export function SellForm({
  locale,
  categories,
  percent,
  initial,
  hints = [],
  storeReady = false,
  storeLabel = "",
}: {
  locale: Locale;
  categories: Cat[];
  percent: string;
  initial?: SellInitial;
  hints?: { title: string; price: string }[];
  storeReady?: boolean;
  storeLabel?: string;
}) {
  const [state, action] = useActionState(saveListingAction, null);
  const editing = Boolean(initial?.listingId);
  const [step, setStep] = useState(editing ? 4 : 0);
  const [maxReached, setMaxReached] = useState(editing ? 4 : 0);
  const [categoryId, setCategoryId] = useState(initial?.categoryId || categories[0]?.id || "");
  const [saleType, setSaleType] = useState(initial?.saleType || "BUY_NOW");
  const [track, setTrack] = useState(initial?.conditionTrack || "RAW");
  const [rawGrade, setRawGrade] = useState(initial?.rawGrade || "A");
  const [grader, setGrader] = useState(initial?.grader || "PSA");
  const [gradeScore, setGradeScore] = useState(initial?.gradeScore || "");
  const [offers, setOffers] = useState(initial?.offersEnabled || false);
  const [price, setPrice] = useState(initial?.price || "");
  const [startPrice, setStartPrice] = useState(initial?.startPrice || "");
  const [minOffer, setMinOffer] = useState(initial?.minOffer || "");
  const [quantity, setQuantity] = useState(String(initial?.quantity || 1));
  const [sfCod, setSfCod] = useState(initial?.shipSfCod ?? true);
  const [meetup, setMeetup] = useState(initial?.shipMeetup ?? false);
  const [pickup, setPickup] = useState(initial?.shipPickup ?? false);
  const [meetupDistrict, setMeetupDistrict] = useState(initial?.meetupDistrict ?? "");
  const [meetupWindow, setMeetupWindow] = useState(initial?.meetupWindow ?? "");
  const [meetupNotes, setMeetupNotes] = useState(initial?.meetupNotes ?? "");
  const [publishAt, setPublishAt] = useState(initial?.publishAt || "");
  const [photos, setPhotos] = useState<Photo[]>(initial?.photos?.length ? initial.photos : [
    { url: "", role: "FRONT" },
    { url: "", role: "BACK" },
  ]);
  const [photoNote, setPhotoNote] = useState("");
  const [preview, setPreview] = useState<Record<string, string>>({});
  const [block, setBlock] = useState<string[]>([]);
  const [blockKind, setBlockKind] = useState<BlockKind>("next");
  const [note, setNote] = useState("");
  const [openToken, setOpenToken] = useState({ photo: 0, more: 0, price: 0, ship: 0, schedule: 0 });
  const moreOpen = Boolean(initial?.cardNumber || initial?.rarity || initial?.videoUrl || initial?.certNumber);
  const priceOpen = Boolean(initial?.offersEnabled || (initial && initial.quantity > 1));
  const scheduleOpen = Boolean(initial?.publishAt);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const group = categories.find((cat) => cat.id === categoryId)?.groupKey || "tcg";
  const locked = initial?.locked || false;
  const scheduling = Boolean(publishAt.trim());
  const onPublishAt = useCallback((value: string) => setPublishAt(value), []);

  const shown = block;
  const shownKind: BlockKind = blockKind;

  useEffect(() => {
    if (!block.length) return;
    alertRef.current?.focus();
  }, [block]);

  useEffect(() => {
    if (!state?.error) return;
    const code = state.error;
    bumpOpen(wizardPanels([code]));
    const at = earliestStep([code]);
    if (at != null) {
      setStep(at);
      setMaxReached((reached) => Math.max(reached, at));
    }
    setNote("");
    setBlockKind("publish");
    setBlock([code]);
  }, [state]);

  useEffect(() => {
    if (step !== 4 || !formRef.current) return;
    setPreview(snapshot(formRef.current));
  }, [step]);

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

  function readInput(intent: ListingInput["intent"]) {
    const form = formRef.current;
    if (!form) return null;
    const data = new FormData(form);
    data.set("intent", intent);
    data.set("photos", JSON.stringify(photos));
    const input = parseListingForm(data);
    if (!input) return null;
    const selected = String(data.get("categoryId") || "");
    const groupKey = categories.find((cat) => cat.id === selected)?.groupKey || "tcg";
    return { input, groupKey };
  }

  function bumpOpen(panels: ReturnType<typeof wizardPanels>) {
    setOpenToken((current) => ({
      photo: current.photo + Number(panels.photoExtra),
      more: current.more + Number(panels.more),
      price: current.price + Number(panels.priceExtra),
      ship: current.ship + Number(panels.ship),
      schedule: current.schedule + Number(panels.schedule),
    }));
  }

  function reveal(issues: string[], kind: BlockKind) {
    bumpOpen(wizardPanels(issues));
    const at = earliestStep(issues);
    if (at != null) {
      setStep(at);
      setMaxReached((reached) => Math.max(reached, at));
    }
    setNote("");
    setBlockKind(kind);
    setBlock(issues);
  }

  function go(next: number) {
    const dest = Math.max(0, Math.min(4, next));
    if (dest === step) return;
    if (dest > step) {
      const read = readInput("publish");
      if (!read) {
        reveal(["category"], "next");
        return;
      }
      const issues = [...new Set(Array.from({ length: dest - step }, (_, offset) => wizardStepIssues(step + offset, read.input, read.groupKey, new Date(), storeReady)).flat())];
      if (issues.length) {
        reveal(issues, "next");
        return;
      }
    }
    const [zh, en] = STEPS[dest];
    setNote(tx(locale, `已去到第 ${dest + 1} 步「${zh}」。未刊登。`, `Now on step ${dest + 1}, ${en}. Not published.`));
    setBlock([]);
    setStep(dest);
    setMaxReached((reached) => Math.max(reached, dest));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (locked) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const value = submitter instanceof HTMLButtonElement ? submitter.value : "publish";
    const intent: ListingInput["intent"] = value === "draft" || value === "schedule" ? value : "publish";
    const read = readInput(intent);
    if (!read) {
      event.preventDefault();
      reveal(["category"], intent === "draft" ? "draft" : "publish");
      return;
    }
    const issues = wizardPublishIssues(read.input, read.groupKey, new Date(), storeReady);
    if (issues.length) {
      event.preventDefault();
      reveal(issues, intent === "draft" ? "draft" : "publish");
    }
  }

  function onSale(value: string) {
    setSaleType(value);
    if (value !== "BUY_NOW") setQuantity("1");
  }

  const stepLabel = tx(locale, STEPS[step][0], STEPS[step][1]);
  const remaining = STEPS.slice(step + 1).map(([zh, en]) => tx(locale, zh, en));
  const blockHeading =
    shownKind === "draft"
      ? tx(locale, "未可以存草稿，仲未齊：", "Can't save the draft yet. Still missing:")
      : shownKind === "publish"
        ? tx(locale, "未可以刊登，仲未齊：", "Can't publish yet. Still missing:")
        : tx(locale, "未可以去下一步，仲未齊：", "Can't continue yet. Still missing:");

  return (
    <form ref={formRef} action={action} noValidate onSubmit={onSubmit} className="grid min-w-0 gap-4">
      {initial?.listingId ? <input type="hidden" name="listingId" value={initial.listingId} /> : null}
      <input type="hidden" name="photos" value={JSON.stringify(photos)} />
      {locked && initial ? <LockedFields initial={initial} /> : null}
      {locked ? <p className="text-sm text-muted">{tx(locale, "已有出價：只可以改描述同加相片。", "This auction has bids. You can only edit the description and add photos.")}</p> : null}

      {!locked ? (
        <div className="grid gap-2">
          <p className="text-sm font-medium">{tx(locale, `第 ${step + 1} 步，共 ${STEPS.length} 步 · ${stepLabel}`, `Step ${step + 1} of ${STEPS.length} · ${stepLabel}`)}</p>
          <ol className="flex gap-2 overflow-x-auto text-xs" aria-label={tx(locale, "上架步驟", "Listing steps")}>
            {STEPS.map(([zh, en], index) => (
              <li key={zh}>
                <button
                  type="button"
                  aria-current={index === step ? "step" : undefined}
                  disabled={index > maxReached}
                  className={`whitespace-nowrap rounded-full px-3 py-2 disabled:opacity-40 ${index === step ? "bg-[#1b1418] text-[#fff8f4]" : "bg-soft"}`}
                  onClick={() => go(index)}
                >
                  {index + 1}. {tx(locale, zh, en)}
                </button>
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted">
            {step < 4
              ? tx(locale, `尚餘：${remaining.join("、")}。下一步只會去下一步，未會刊登。`, `Still to go: ${remaining.join(", ")}. Next only moves ahead. It does not publish.`)
              : scheduling
                ? tx(locale, "最後一步。按「預約刊登」先會排程；而家未會公開。存草稿唔會上架。", "Last step. Schedule sets a time. Nothing is live yet. Save draft does not publish.")
                : tx(locale, "最後一步。只有「刊登」先會公開。存草稿唔會上架。", "Last step. Only Publish makes this live. Save draft does not publish.")}
          </p>
          {note ? <p aria-live="polite" className="text-sm text-ok">{note}</p> : null}
        </div>
      ) : null}

      {shown.length ? (
        <div ref={alertRef} role="alert" tabIndex={-1} className="rounded-xl bg-soft px-3 py-2 text-sm text-danger outline-none">
          <p className="font-medium">{blockHeading}</p>
          <ul className="mt-1 list-disc pl-5">
            {shown.map((code) => (
              <li key={code}>{errText(locale, code)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div hidden={!locked && step !== 0} className="grid gap-3">
        <p className="text-sm">{tx(locale, "先放相。最少 2 張，最多 12 張。評級卡要標明正面同背面。", "Add photos first. 2–12. Graded cards need a front and a back.")}</p>
        <PhotoFields
          locale={locale}
          photos={photos}
          setPhotos={setPhotos}
          locked={locked}
          initialCount={initial?.photos.length || 0}
          fileRef={fileRef}
          onFiles={onFiles}
          note={photoNote}
          issues={shown}
          extraSignal={openToken.photo}
        />
      </div>

      {!locked ? <div hidden={step !== 1} className="grid gap-3">
        <p className="text-sm text-muted">
          {group === "tcg"
            ? tx(locale, "要有標題、描述同品相，再加遊戲、系列、卡名、語言。", "Title, description, condition, plus game, set, card name, and language.")
            : tx(locale, "要有標題、描述同品相，再加人物、賽季／年份、品牌系列。", "Title, description, condition, plus person, season/year, and brand/series.")}
        </p>
        <label className="grid gap-1 text-sm">
          {tx(locale, "分類", "Category")}
          <select className="field" name="categoryId" value={categoryId} aria-invalid={shown.includes("category")} onChange={(e) => setCategoryId(e.target.value)}>
            {GROUPS.map(([key, zh, en]) => (
              <optgroup key={key} label={tx(locale, zh, en)}>
                {categories.filter((cat) => cat.groupKey === key).map((cat) => (
                  <option key={cat.id} value={cat.id}>{locale === "en" ? cat.nameEn : cat.nameZh}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <FieldError locale={locale} codes={shown} code="category" />
        </label>
        <label className="grid gap-1 text-sm">
          {tx(locale, "標題", "Title")}
          <input className="field" name="title" minLength={2} maxLength={80} defaultValue={initial?.title} aria-invalid={shown.includes("title")} />
          <FieldError locale={locale} codes={shown} code="title" />
        </label>
        <label className="grid gap-1 text-sm">
          {tx(locale, "描述（可用 **粗體**、換行、- 清單）", "Description (**bold**, new lines, - lists)")}
          <textarea className="field min-h-28" name="description" defaultValue={initial?.description} aria-invalid={shown.includes("description")} />
          <FieldError locale={locale} codes={shown} code="description" />
        </label>
        {group === "tcg" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">{tx(locale, "遊戲", "Game")}<input className="field" name="game" defaultValue={initial?.game} aria-invalid={shown.includes("tcg")} /></label>
            <label className="text-sm">{tx(locale, "系列", "Set")}<input className="field" name="setName" defaultValue={initial?.setName} aria-invalid={shown.includes("tcg")} /></label>
            <label className="text-sm">{tx(locale, "卡名", "Card name")}<input className="field" name="cardName" defaultValue={initial?.cardName} aria-invalid={shown.includes("tcg")} /></label>
            <label className="text-sm">
              {tx(locale, "語言", "Language")}
              <input className="field" name="language" defaultValue={initial?.language} list="langs" aria-invalid={shown.includes("tcg")} />
              <datalist id="langs">
                {["繁體中文", "簡體中文", "英文", "日文", "韓文"].map((lang) => (
                  <option key={lang} value={lang} />
                ))}
              </datalist>
            </label>
            <div className="md:col-span-2"><FieldError locale={locale} codes={shown} code="tcg" /></div>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">{tx(locale, "人物", "Person")}<input className="field" name="personName" defaultValue={initial?.personName} aria-invalid={shown.includes("person")} /></label>
            <label className="text-sm">{tx(locale, "賽季／年份", "Season / year")}<input className="field" name="seasonYear" defaultValue={initial?.seasonYear} aria-invalid={shown.includes("person")} /></label>
            <label className="text-sm">{tx(locale, "品牌／系列", "Brand / series")}<input className="field" name="brandSeries" defaultValue={initial?.brandSeries} aria-invalid={shown.includes("person")} /></label>
            <div className="md:col-span-2"><FieldError locale={locale} codes={shown} code="person" /></div>
          </div>
        )}
        <fieldset className="grid gap-2 text-sm">
          <legend>{tx(locale, "品相", "Condition")}</legend>
          <select className="field" name="conditionTrack" value={track} aria-invalid={shown.includes("grade") || shown.includes("front_back")} onChange={(e) => setTrack(e.target.value)}>
            <option value="RAW">{tx(locale, "未評級", "Raw")}</option>
            <option value="GRADED">{tx(locale, "評級", "Graded")}</option>
          </select>
          {track === "RAW" ? (
            <select className="field" name="rawGrade" value={rawGrade} aria-label={tx(locale, "未評級品相", "Raw grade")} onChange={(e) => setRawGrade(e.target.value)}>
              {RAW_OPTIONS.map(([grade, zh, en]) => (
                <option key={grade} value={grade}>{tx(locale, zh, en)}</option>
              ))}
            </select>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              <select className="field" name="grader" value={grader} aria-label={tx(locale, "評級公司", "Grader")} onChange={(e) => setGrader(e.target.value)}>
                {["PSA", "BGS", "CGC", "TAG"].map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
              <input className="field" name="gradeScore" inputMode="decimal" placeholder={tx(locale, "分數", "Score")} value={gradeScore} aria-invalid={shown.includes("grade")} onChange={(e) => setGradeScore(e.target.value)} />
            </div>
          )}
          <p className="text-muted">{track === "GRADED" ? tx(locale, "只接受 PSA、BGS、CGC、TAG。相片要有正面同背面。", "PSA, BGS, CGC, or TAG only. Photos need a front and a back.") : tx(locale, "未評級用 A、B、C、D。", "Raw grades are A, B, C, or D.")}</p>
          <FieldError locale={locale} codes={shown} code="grade" />
          <FieldError locale={locale} codes={shown} code="front_back" />
        </fieldset>
        <Disclosure signal={openToken.more} initiallyOpen={moreOpen} title={tx(locale, "更多資料（可選）", "More details (optional)")}>
          <label className="text-sm">{tx(locale, "卡號", "Card number")}<input className="field" name="cardNumber" defaultValue={initial?.cardNumber} placeholder={group === "tcg" ? "020/189" : "No.23"} /></label>
          <label className="text-sm">{tx(locale, "稀有度", "Rarity")}<input className="field" name="rarity" defaultValue={initial?.rarity} placeholder={group === "tcg" ? "SR / RR / SEC" : "BASE / AUTO"} /></label>
          <label className="text-sm">{tx(locale, "證書編號", "Cert #")}<input className="field" name="certNumber" defaultValue={initial?.certNumber} /></label>
          <label className="grid gap-1 text-sm">
            {tx(locale, "短片網址", "Video URL")}
            <input className="field" name="videoUrl" defaultValue={initial?.videoUrl} placeholder="https://" aria-invalid={shown.includes("video")} />
            <FieldError locale={locale} codes={shown} code="video" />
          </label>
        </Disclosure>
      </div> : null}

      {!locked ? <div hidden={step !== 2} className="grid gap-3 text-sm">
        <p className="text-muted">{tx(locale, "預設係直購。拍賣沒有底價，起標價就係底價。", "Buy Now is the default. Auctions have no reserve; the start price is the floor.")}</p>
        <label className="grid gap-1">
          {tx(locale, "售賣方式", "Sale format")}
          <select className="field" name="saleType" value={saleType} onChange={(e) => onSale(e.target.value)}>
            <option value="BUY_NOW">{tx(locale, "直購", "Buy Now")}</option>
            <option value="AUCTION">{tx(locale, "拍賣", "Auction")}</option>
            <option value="BOTH">{tx(locale, "拍賣 + 直購", "Auction + Buy It Now")}</option>
          </select>
        </label>
        <p className="text-muted">
          {saleType === "AUCTION"
            ? tx(locale, "沒有底價。起標價就係底價，只可以賣 1 件。", "No reserve. The start price is the floor. Quantity stays 1.")
            : saleType === "BOTH"
              ? tx(locale, "直購價要高於起標價。拍賣沒有底價，只可以賣 1 件。", "Buy It Now must be above the start price. No reserve, quantity 1.")
              : tx(locale, "買家可以即時用直購價買。", "Buyers can purchase now at this price.")}
        </p>
        {saleType !== "AUCTION" ? (
          <label className="grid gap-1">
            {tx(locale, "直購價 HKD", "Buy Now HKD")}
            <input className="field" name="price" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" aria-invalid={shown.includes("price") || shown.includes("both_price")} />
            <FieldError locale={locale} codes={shown} code="price" />
            <FieldError locale={locale} codes={shown} code="both_price" />
          </label>
        ) : null}
        {saleType !== "BUY_NOW" ? (
          <>
            <label className="grid gap-1">
              {tx(locale, "起標價 HKD", "Start price HKD")}
              <input className="field" name="startPrice" value={startPrice} inputMode="decimal" aria-invalid={shown.includes("start")} onChange={(e) => setStartPrice(e.target.value)} />
              <FieldError locale={locale} codes={shown} code="start" />
            </label>
            <div>
              <p className="mb-1">{tx(locale, "結束時間（香港時間）", "End time (Hong Kong)")}</p>
              <HkDateTime locale={locale} name="auctionEndsAt" defaultValue={initial?.auctionEndsAt} />
              <FieldError locale={locale} codes={shown} code="auction_end" />
            </div>
          </>
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
        {saleType === "BUY_NOW" ? (
          <Disclosure signal={openToken.price} initiallyOpen={priceOpen} title={tx(locale, "議價同數量（可選）", "Offers and quantity (optional)")}>
            <OfferFields locale={locale} offers={offers} setOffers={setOffers} minOffer={minOffer} setMinOffer={setMinOffer} issues={shown} />
            <label className="grid gap-1">
              {tx(locale, "數量", "Quantity")}
              <input className="field" name="quantity" type="number" min={1} max={99} value={quantity} aria-invalid={shown.includes("qty")} onChange={(e) => setQuantity(e.target.value)} />
              <FieldError locale={locale} codes={shown} code="qty" />
            </label>
          </Disclosure>
        ) : (
          <>
            <input type="hidden" name="quantity" value="1" />
            {saleType === "BOTH" ? (
              <Disclosure signal={openToken.price} initiallyOpen={priceOpen} title={tx(locale, "議價（可選）", "Offers (optional)")}>
                <OfferFields locale={locale} offers={offers} setOffers={setOffers} minOffer={minOffer} setMinOffer={setMinOffer} issues={shown} />
              </Disclosure>
            ) : null}
            <FieldError locale={locale} codes={shown} code="qty" />
          </>
        )}
      </div> : null}

      {!locked ? <div hidden={step !== 3} className="grid gap-3 text-sm">
        <p className="text-muted">{tx(locale, "至少選一種。平台唔會收運費，買家結帳時只會見到你開咗的方式。", "Pick at least one. The platform does not charge shipping. Buyers only see the methods you turn on.")}</p>
        <input type="hidden" name="shippingDays" value={String(initial?.shippingDays || 3)} />
        <fieldset className="grid gap-3" aria-invalid={shown.includes("shipping") || shown.includes("meetup") || shown.includes("store")}>
          <label className="grid gap-1 rounded-2xl bg-soft p-3">
            <span className="flex min-h-12 items-center gap-2 font-medium">
              <input type="checkbox" name="shipSfCod" checked={sfCod} aria-invalid={shown.includes("shipping")} onChange={(e) => setSfCod(e.target.checked)} />
              {tx(locale, "順豐到付", "SF cash on delivery")}
            </span>
            <span className="text-muted">{tx(locale, "平台運費 HK$0。買家收貨時先向順豐付款，平台不會代收。", "Platform fee HK$0. The buyer pays SF Express on delivery. TYSM does not collect it.")}</span>
          </label>
          <div className="grid gap-2 rounded-2xl bg-soft p-3">
            <label className="flex min-h-12 items-center gap-2 font-medium">
              <input type="checkbox" name="shipMeetup" checked={meetup} aria-invalid={shown.includes("meetup") || shown.includes("shipping")} onChange={(e) => setMeetup(e.target.checked)} />
              {tx(locale, "面交", "Meet-up")}
            </label>
            {meetup ? (
              <>
                <label className="grid gap-1">
                  {tx(locale, "面交地區", "Meet-up district")}
                  <select className="field" name="meetupDistrict" value={meetupDistrict} aria-invalid={shown.includes("meetup")} onChange={(e) => setMeetupDistrict(e.target.value)}>
                    <option value="">{tx(locale, "選擇地區", "Choose a district")}</option>
                    {DISTRICTS.map(([zh, en]) => (
                      <option key={zh} value={zh}>{locale === "en" ? en : zh}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  {tx(locale, "常用時段（可選）", "Usual time (optional)")}
                  <input className="field" name="meetupWindow" value={meetupWindow} maxLength={80} placeholder={tx(locale, "例如週末下午", "e.g. weekend afternoons")} onChange={(e) => setMeetupWindow(e.target.value)} />
                </label>
                <label className="grid gap-1">
                  {tx(locale, "備註（可選）", "Note (optional)")}
                  <input className="field" name="meetupNotes" value={meetupNotes} maxLength={200} placeholder={tx(locale, "例如港鐵站附近，請先傳訊息", "e.g. near the MTR, message first")} onChange={(e) => setMeetupNotes(e.target.value)} />
                </label>
              </>
            ) : null}
          </div>
          <div className="grid gap-2 rounded-2xl bg-soft p-3">
            <label className={`flex min-h-12 items-center gap-2 font-medium ${storeReady ? "" : "opacity-60"}`}>
              <input
                type="checkbox"
                name="shipPickup"
                checked={pickup && storeReady}
                disabled={!storeReady}
                aria-invalid={shown.includes("store")}
                onChange={(e) => setPickup(e.target.checked)}
              />
              {tx(locale, "店舖自取", "Store pickup")}
            </label>
            {storeReady ? (
              <p className="text-muted">{tx(locale, "用帳戶入面的固定店舖地址，唔使每張刊登再填。", "Uses the shop address on your profile. You do not re-enter it on each listing.")} {storeLabel}</p>
            ) : (
              <p className="text-muted">
                {tx(locale, "未設定店舖地址，所以未可以揀店舖自取。", "Add a shop address before you can offer store pickup.")}{" "}
                <a className="text-link" href="/me#store">{tx(locale, "去帳戶設定店舖地址", "Set the shop address")}</a>
              </p>
            )}
            {initial?.shipPickup && !storeReady ? (
              <p className="text-danger">{tx(locale, "這張刊登原本有店舖自取，但帳戶未有店舖地址，所以而家未可以再開。", "This listing had store pickup, but the shop address is missing, so it cannot be turned on.")}</p>
            ) : null}
          </div>
          <FieldError locale={locale} codes={shown} code="shipping" />
          <FieldError locale={locale} codes={shown} code="meetup" />
          <FieldError locale={locale} codes={shown} code="store" />
          {shown.includes("store") ? <a className="text-link" href="/me#store">{tx(locale, "去帳戶設定店舖地址", "Set the shop address")}</a> : null}
        </fieldset>
      </div> : null}

      {!locked && step === 4 ? (
        <section className="surface grid gap-2 p-4 text-sm">
          <h2 className="font-semibold">{tx(locale, "刊登預覽", "Preview")}</h2>
          <p>{tx(locale, "呢個係預覽。未按下面個掣就未會公開。", "This is a preview. Nothing goes live until you use the button below.")}</p>
          <div className="flex gap-2 overflow-x-auto">
            {photos.filter((photo) => photo.url).map((photo, index) => (
              <img key={index} src={photo.url} alt="" className="h-28 w-20 shrink-0 rounded-xl bg-[#f4efe6] object-contain" />
            ))}
          </div>
          <p className="font-medium">{preview.title || initial?.title || tx(locale, "未填標題", "No title yet")}</p>
          <p className="text-muted">{preview.description || initial?.description}</p>
          <p>{saleType === "AUCTION" ? tx(locale, "拍賣", "Auction") : saleType === "BOTH" ? tx(locale, "直購 + 拍賣", "Buy now + auction") : tx(locale, "直購", "Buy now")}{price ? ` · HK$${price}` : ""}</p>
          <p className="text-muted">{[
            sfCod ? tx(locale, "順豐到付（平台 HK$0，買家到付順豐）", "SF cash on delivery (platform HK$0)") : "",
            meetup ? tx(locale, `面交 ${meetupDistrict || "未選地區"}`, `Meet-up ${meetupDistrict || "no district"}`) : "",
            pickup && storeReady ? tx(locale, "店舖自取", "Store pickup") : "",
          ].filter(Boolean).join(" · ") || tx(locale, "未選運送方式", "No shipping method")}</p>
          <p className="text-muted">{feeCopy}</p>
          <Disclosure signal={openToken.schedule} initiallyOpen={scheduleOpen} title={tx(locale, "預約刊登（可選）", "Schedule publish (optional)")}>
            <p className="text-muted">{tx(locale, "留空就即時刊登。有時間就會改為預約，而家未會公開。", "Leave this blank to publish now. A time schedules it instead, and it stays offline until then.")}</p>
            <HkDateTime locale={locale} name="publishAt" defaultValue={initial?.publishAt} onChange={onPublishAt} emptyLabel={tx(locale, "留空就即時刊登", "Leave blank to publish now")} />
            <FieldError locale={locale} codes={shown} code="schedule" />
          </Disclosure>
        </section>
      ) : null}

      {locked ? (
        <label className="grid gap-1 text-sm">
          {tx(locale, "描述（可用 **粗體**、換行、- 清單）", "Description (**bold**, new lines, - lists)")}
          <textarea className="field min-h-28" name="description" defaultValue={initial?.description} />
        </label>
      ) : null}

      <div className="grid gap-2">
        {!locked && step < 4 ? (
          <button type="button" className="btn btn-primary w-full" onClick={() => go(step + 1)}>{tx(locale, "下一步", "Next")}</button>
        ) : null}
        {locked || step === 4 ? <IntentButtons locale={locale} locked={locked} scheduling={scheduling} /> : null}
        {!locked && step < 4 ? (
          <div className="flex flex-wrap gap-2">
            {step > 0 ? <button type="button" className="btn btn-ghost" onClick={() => go(step - 1)}>{tx(locale, "上一步", "Back")}</button> : null}
            <DraftButton locale={locale} />
          </div>
        ) : null}
        {!locked && step === 4 && step > 0 ? (
          <button type="button" className="btn btn-ghost w-fit" onClick={() => go(step - 1)}>{tx(locale, "上一步", "Back")}</button>
        ) : null}
      </div>
    </form>
  );
}

function earliestStep(issues: string[]) {
  return issues.reduce<number | null>((earliest, code) => {
    const at = wizardStepForIssue(code);
    if (at == null) return earliest;
    return earliest == null || at < earliest ? at : earliest;
  }, null);
}

function snapshot(form: HTMLFormElement) {
  const data = new FormData(form);
  const snap: Record<string, string> = {};
  data.forEach((value, key) => {
    if (typeof value === "string") snap[key] = value;
  });
  return snap;
}

function FieldError({ locale, codes, code }: { locale: Locale; codes: string[]; code: string }) {
  if (!codes.includes(code)) return null;
  return <p className="text-sm text-danger">{errText(locale, code)}</p>;
}

function Disclosure({ signal, initiallyOpen, title, children }: { signal: number; initiallyOpen?: boolean; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (initiallyOpen && ref.current) ref.current.open = true;
  }, [initiallyOpen]);
  useEffect(() => {
    if (signal && ref.current) ref.current.open = true;
  }, [signal]);
  return (
    <details ref={ref} className="rounded-2xl bg-soft px-3 text-sm">
      <summary className="min-h-12 cursor-pointer py-3 font-medium">{title}</summary>
      <div className="grid gap-3 pb-3">{children}</div>
    </details>
  );
}

function OfferFields({
  locale,
  offers,
  setOffers,
  minOffer,
  setMinOffer,
  issues,
}: {
  locale: Locale;
  offers: boolean;
  setOffers: (value: boolean) => void;
  minOffer: string;
  setMinOffer: (value: string) => void;
  issues: string[];
}) {
  return (
    <>
      <label className="flex min-h-12 items-center gap-2">
        <input type="checkbox" name="offersEnabled" checked={offers} onChange={(e) => setOffers(e.target.checked)} />
        {tx(locale, "接受議價", "Allow offers")}
      </label>
      {offers ? (
        <label className="grid gap-1">
          {tx(locale, "最低接受價 HKD", "Minimum offer HKD")}
          <input className="field" name="minOffer" value={minOffer} inputMode="decimal" aria-invalid={issues.includes("offer")} onChange={(e) => setMinOffer(e.target.value)} />
          <FieldError locale={locale} codes={issues} code="offer" />
        </label>
      ) : null}
    </>
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
      <input type="hidden" name="shippingDays" value={initial.shippingDays} />
      {initial.shipSfCod ? <input type="hidden" name="shipSfCod" value="on" /> : null}
      {initial.shipMeetup ? <input type="hidden" name="shipMeetup" value="on" /> : null}
      {initial.shipPickup ? <input type="hidden" name="shipPickup" value="on" /> : null}
      <input type="hidden" name="meetupDistrict" value={initial.meetupDistrict} />
      <input type="hidden" name="meetupWindow" value={initial.meetupWindow} />
      <input type="hidden" name="meetupNotes" value={initial.meetupNotes} />
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
  issues,
  extraSignal,
}: {
  locale: Locale;
  photos: Photo[];
  setPhotos: Dispatch<SetStateAction<Photo[]>>;
  locked: boolean;
  initialCount: number;
  fileRef: RefObject<HTMLInputElement | null>;
  onFiles: (list: FileList | null) => void;
  note: string;
  issues: string[];
  extraSignal: number;
}) {
  const [paste, setPaste] = useState("");
  const filled = filledCount(photos);
  function addPasted() {
    const url = paste.trim();
    if (!url || filled >= 12) return;
    setPhotos((current) => mergePhotos(current, [{ url, role: "GALLERY" }]));
    setPaste("");
  }
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <label className="btn btn-primary w-fit cursor-pointer">
          {tx(locale, "從相簿加入", "Add from camera roll")}
          <input ref={fileRef} className="sr-only" type="file" accept="image/*" multiple disabled={filled >= 12} onChange={(e) => void onFiles(e.target.files)} />
        </label>
        <p className="text-sm text-muted">{tx(locale, `已有 ${filled} 張`, `${filled} added`)}</p>
      </div>
      {note ? <p className="text-sm text-danger">{note}</p> : null}
      <FieldError locale={locale} codes={issues} code="photos" />
      <FieldError locale={locale} codes={issues} code="photo_url" />
      {photos.map((photo, index) => photo.url ? (
        <div key={index} className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
          <img src={photo.url} alt="" className="h-20 w-16 rounded-xl bg-[#f4efe6] object-contain ring-1 ring-[#5c3a4a]/30" />
          <div className="grid min-w-0 gap-2">
            {photo.url.startsWith("data:") ? (
              <p className="field flex items-center text-sm">{tx(locale, "已從相簿上傳", "Uploaded from camera roll")}</p>
            ) : (
              <input className="field" value={photo.url} aria-label={tx(locale, "相片網址", "Photo URL")} onChange={(e) => setPhotos((current) => current.map((item, i) => (i === index ? { ...item, url: e.target.value } : item)))} placeholder="https:// 或 /demo/..." disabled={locked && index < initialCount} />
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
      ) : null)}
      {filled < 2 ? (
        <p className="text-sm text-muted">
          {photos.some((photo) => !photo.url && (photo.role === "FRONT" || photo.role === "BACK"))
            ? tx(locale, "頭兩張會標成正面同背面，可以改。", "The first two are marked front and back. You can change that.")
            : tx(locale, "最少 2 張。評級卡要自己標正面同背面。", "At least 2 photos. Mark front and back for a graded card.")}
        </p>
      ) : null}
      <Disclosure signal={extraSignal} title={tx(locale, "示範圖或網址", "Demo image or URL")}>
        <div className="flex flex-wrap gap-2">
          {DEMOS.map((demo) => (
            <button key={demo.url} type="button" className="btn-ghost btn gap-2 px-2" disabled={filled >= 12} onClick={() => setPhotos((current) => mergePhotos(current, [{ url: demo.url, role: "GALLERY" }]))}>
              <img src={demo.url} alt="" className="h-10 w-8 rounded-md bg-[#f4efe6] object-contain" />
              {tx(locale, demo.zh, demo.en)}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="field" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="https:// 或 /demo/..." aria-label={tx(locale, "相片網址", "Photo URL")} />
          <button type="button" className="btn btn-ghost shrink-0" disabled={filled >= 12} onClick={addPasted}>{tx(locale, "加入", "Add")}</button>
        </div>
      </Disclosure>
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

function HkDateTime({ locale, name, defaultValue, disabled, onChange, emptyLabel }: { locale: Locale; name: string; defaultValue?: string; disabled?: boolean; onChange?: (value: string) => void; emptyLabel?: string }) {
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
  useEffect(() => {
    onChange?.(value);
  }, [value, onChange]);
  const blank = emptyLabel ?? tx(locale, "請選擇結束時間", "Choose an end time");
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
      {!disabled ? (
        <details className="rounded-2xl bg-soft px-3">
          <summary className="min-h-12 cursor-pointer py-3 font-medium">{tx(locale, "自訂時間", "Custom time")}</summary>
          <div className="grid grid-cols-2 gap-2 pb-3 sm:grid-cols-5">
            <SelectBox label={tx(locale, "日", "Day")} value={day} onChange={setDay} options={range(1, 31)} />
            <SelectBox label={tx(locale, "月", "Month")} value={month} onChange={setMonth} options={range(1, 12)} />
            <SelectBox label={tx(locale, "年", "Year")} value={year} onChange={setYear} options={[nowYear, nowYear + 1].map(String)} />
            <SelectBox label={tx(locale, "時", "Hour")} value={hour} onChange={setHour} options={range(0, 23)} />
            <SelectBox label={tx(locale, "分", "Min")} value={minute} onChange={setMinute} options={["0", "15", "30", "45"]} />
          </div>
        </details>
      ) : null}
      <p className="text-xs text-muted">{value ? `${tx(locale, "香港時間", "Hong Kong time")} ${value.replace("T", " ")}` : blank}</p>
      {value && emptyLabel ? (
        <button type="button" className="btn btn-ghost w-fit" onClick={() => apply({ year: "", month: "", day: "", hour: "", minute: "" })}>
          {tx(locale, "取消時間，改為即時刊登", "Clear time and publish now")}
        </button>
      ) : null}
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

function IntentButtons({ locale, locked, scheduling }: { locale: Locale; locked: boolean; scheduling: boolean }) {
  const { pending } = useFormStatus();
  const live = scheduling && !locked;
  const label = pending
    ? tx(locale, "處理中", "Working")
    : live
      ? tx(locale, "預約刊登", "Schedule")
      : tx(locale, "刊登", "Publish");
  return (
    <>
      <button className="sell-cta btn w-full sm:w-auto" name="intent" value={live ? "schedule" : "publish"} disabled={pending}>
        {label}
      </button>
      {locked ? null : (
        <button className="btn-ghost btn w-fit" name="intent" value="draft" disabled={pending}>{tx(locale, "存草稿", "Save draft")}</button>
      )}
    </>
  );
}

function DraftButton({ locale }: { locale: Locale }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-ghost btn" name="intent" value="draft" disabled={pending}>{tx(locale, "存草稿", "Save draft")}</button>
  );
}
