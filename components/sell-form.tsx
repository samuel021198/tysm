"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { saveListingAction } from "@/actions/trade";
import { DISTRICTS, hkPartsToInput, isAllowedMediaUrl } from "@/lib/format";
import { tx, errText, type Locale } from "@/lib/i18n";
import { LISTING_CROP_ASPECT } from "@/lib/photo-crop";
import { AUCTION_DAYS } from "@/lib/auction";
import { cardDisplayName } from "@/lib/posts";
import { PHOTO_MAX, parseListingForm, wizardFocusField, wizardPublishIssues, wizardStepForIssue, type ListingInput } from "@/lib/sell-wizard";
import { usePhotoCropQueue } from "./photo-crop";
import { startHashtag } from "@/lib/tags";
import { CatalogTitleField, type CatalogHit } from "./catalog-title-field";
import { HashtagHint } from "./topic-field";

type Cat = { id: string; nameZh: string; nameEn: string; groupKey: string; slug?: string };
type Photo = { url: string; role: "FRONT" | "BACK" | "GALLERY" };
type BlockKind = "draft" | "publish";

export type SellCardInitial = {
  name: string;
  catalogId: string;
  catalogTitle: string;
  year: string;
  setName: string;
  setCode: string;
  number: string;
  rarity: string;
  language: string;
  game: string;
  price: string;
  track: string;
  rawGrade: string;
  grader: string;
  gradeScore: string;
  certNumber: string;
};

export type SellInitial = {
  listingId?: string;
  categoryId: string;
  title: string;
  description: string;
  saleType: string;
  price: string;
  startPrice: string;
  reserve?: string;
  auctionDays?: string;
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
  promoted?: boolean;
  catalogCardId?: string;
  collectionItemId?: string;
  cards?: SellCardInitial[];
  stockType?: string;
  shipWithinDays?: number | null;
  preorderShipDate?: string;
};

type CardDraft = SellCardInitial & { key: string };

const RAW_OPTIONS = [
  ["A", "A · 近全新", "A · Near mint"],
  ["B", "B · 良好", "B · Good"],
  ["C", "C · 有使用痕跡", "C · Played"],
  ["D", "D · 明顯損傷", "D · Damaged"],
] as const;

const LANGUAGES = ["日文", "英文", "繁體中文", "簡體中文", "韓文"] as const;

const CARD_ORDER = ["pokemon", "one-piece", "riftbound", "yugioh", "topps-soccer", "topps-basketball", "topps-baseball", "weiss-schwarz", "digimon", "lorcana", "mtg", "flesh-and-blood", "gundam", "dragon-ball", "panini-soccer", "football", "basketball", "baseball", "singers", "actors", "idols", "other"];

const CATALOG_SLUGS = new Set([
  "pokemon",
  "one-piece",
  "riftbound",
  "topps-basketball",
  "topps-soccer",
  "yugioh",
  "digimon",
  "weiss-schwarz",
  "lorcana",
  "mtg",
  "flesh-and-blood",
  "gundam",
  "dragon-ball",
]);

function catalogSlug(slug: string | undefined): string {
  return slug && CATALOG_SLUGS.has(slug) ? slug : "";
}

const STEPS = [
  ["基本資料", "Basics"],
  ["卡片詳情", "Cards"],
  ["交收", "Handover"],
  ["預覽", "Preview"],
] as const;

function blankCard(partial?: Partial<CardDraft>): CardDraft {
  return {
    name: "",
    catalogId: "",
    catalogTitle: "",
    year: "",
    setName: "",
    setCode: "",
    number: "",
    rarity: "",
    language: "",
    game: "",
    price: "",
    track: "RAW",
    rawGrade: "A",
    grader: "PSA",
    gradeScore: "",
    certNumber: "",
    ...partial,
    key: partial?.key || Math.random().toString(36).slice(2),
  };
}

function cardsFromInitial(initial?: SellInitial): CardDraft[] {
  if (initial?.cards?.length) return initial.cards.map((card) => blankCard(card));
  if (!initial) return [blankCard()];
  return [
    blankCard({
      name: initial.cardName || initial.personName || "",
      catalogId: initial.catalogCardId || "",
      year: initial.seasonYear || "",
      setName: initial.setName || initial.brandSeries || "",
      number: initial.cardNumber || "",
      rarity: initial.rarity || "",
      language: initial.language || "",
      game: initial.game || "",
      track: initial.conditionTrack === "GRADED" ? "GRADED" : "RAW",
      rawGrade: initial.rawGrade || "A",
      grader: initial.grader || "PSA",
      gradeScore: initial.gradeScore || "",
      certNumber: initial.certNumber || "",
    }),
  ];
}

function orderedCategories(categories: Cat[]) {
  return [...categories].sort((a, b) => {
    const ai = CARD_ORDER.indexOf(a.slug || "");
    const bi = CARD_ORDER.indexOf(b.slug || "");
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.nameZh.localeCompare(b.nameZh, "zh-HK");
  });
}

export function SellForm({
  locale,
  categories,
  initial,
  hints = [],
  storeReady = false,
  storeLabel = "",
  linkPost = false,
  preferAuction = false,
  promoBalance = 0,
  promoPaidToday = false,
}: {
  locale: Locale;
  categories: Cat[];
  initial?: SellInitial;
  hints?: { title: string; price: string }[];
  storeReady?: boolean;
  storeLabel?: string;
  linkPost?: boolean;
  /** Opened from 拍賣專區. Any account can list. */
  preferAuction?: boolean;
  promoBalance?: number;
  /** Already charged for this listing today, so turning it back on does not spend again. */
  promoPaidToday?: boolean;
}) {
  const [state, action] = useActionState(saveListingAction, null);
  const ordered = useMemo(() => orderedCategories(categories), [categories]);
  const fallbackCategory = ordered.find((cat) => cat.slug === "pokemon")?.id || ordered[0]?.id || "";
  const editing = Boolean(initial?.listingId);
  const fromDex = Boolean(initial?.catalogCardId || initial?.cardName);
  const [step, setStep] = useState(editing ? 3 : fromDex ? 1 : 0);
  const [categoryId, setCategoryId] = useState(initial?.categoryId || fallbackCategory);
  const [price, setPrice] = useState(initial?.price || "");
  const [mode, setMode] = useState<"fixed" | "auction">(
    preferAuction || (initial?.saleType && initial.saleType !== "BUY_NOW") ? "auction" : "fixed",
  );
  const [startPrice, setStartPrice] = useState(initial?.startPrice || "");
  const [reserve, setReserve] = useState(initial?.reserve || "");
  const [auctionDays, setAuctionDays] = useState(initial?.auctionDays || "3");
  const [description, setDescription] = useState(initial?.description || "");
  const [sfCod, setSfCod] = useState(initial?.shipSfCod ?? true);
  const [meetup, setMeetup] = useState(initial?.shipMeetup ?? false);
  const [pickup, setPickup] = useState(initial?.shipPickup ?? false);
  const [meetupDistrict, setMeetupDistrict] = useState(initial?.meetupDistrict ?? "");
  const [meetupWindow, setMeetupWindow] = useState(initial?.meetupWindow ?? "");
  const [meetupNotes, setMeetupNotes] = useState(initial?.meetupNotes ?? "");
  const [publishMode, setPublishMode] = useState<"now" | "later">(initial?.publishAt ? "later" : "now");
  const [publishAt, setPublishAt] = useState(initial?.publishAt || "");
  const [stockType, setStockType] = useState<"IN_STOCK" | "PREORDER">(initial?.stockType === "PREORDER" ? "PREORDER" : "IN_STOCK");
  const [shipWithin, setShipWithin] = useState(initial?.shipWithinDays === 7 || initial?.shipWithinDays === 30 ? initial.shipWithinDays : 3);
  const [promote, setPromote] = useState(Boolean(initial?.promoted) && (promoBalance >= 1 || promoPaidToday));
  const promoShort = promoBalance < 1 && !promoPaidToday;
  const [preorderDate, setPreorderDate] = useState(initial?.preorderShipDate || "");
  const [photos, setPhotos] = useState<Photo[]>(() => (initial?.photos || []).filter((photo) => photo.url).slice(0, PHOTO_MAX));
  const [cards, setCards] = useState<CardDraft[]>(() => cardsFromInitial(initial));
  const [photoNote, setPhotoNote] = useState("");
  const { enqueue: enqueuePhotos, editor: cropEditor } = usePhotoCropQueue({
    aspect: LISTING_CROP_ASPECT,
    locale,
    onUrl: (url) => {
      setPhotos((current) => (current.length >= PHOTO_MAX ? current : [...current, { url, role: "GALLERY" }]));
      setPhotoNote("");
    },
    onFail: () => setPhotoNote(tx(locale, "有相片無法讀取，請改用 JPG 或 PNG。", "Some photos could not be read. Use JPG or PNG.")),
  });
  const [block, setBlock] = useState<string[]>([]);
  const [blockKind, setBlockKind] = useState<BlockKind>("publish");
  const [note, setNote] = useState("");
  const [title, setTitle] = useState(initial?.title || "");
  const [descCursor, setDescCursor] = useState((initial?.description || "").length);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const dragFrom = useRef<number | null>(null);
  const locked = initial?.locked || false;
  const multi = cards.length >= 2;
  const postedSale = locked
    ? initial?.saleType === "AUCTION" || initial?.saleType === "BOTH"
      ? initial.saleType
      : "BUY_NOW"
    : !multi && mode === "auction"
      ? price.trim()
        ? "BOTH"
        : "AUCTION"
      : "BUY_NOW";
  const auction = postedSale !== "BUY_NOW";
  const selected = ordered.find((cat) => cat.id === categoryId);
  const catalogGame = catalogSlug(selected?.slug);
  const categoryLabel = selected ? (locale === "en" ? selected.nameEn : selected.nameZh) : "";
  const scheduling = publishMode === "later";
  const onPublishAt = useCallback((value: string) => setPublishAt(value), []);
  const first = cards[0];

  useEffect(() => {
    const form = formRef.current;
    if (!block.length || !form) return;
    const input = parseListingForm(new FormData(form));
    let target: HTMLElement | null = null;
    for (const code of block) {
      const field = wizardFocusField(code, input);
      target = field ? findWizardField(form, field) : null;
      if (target) break;
    }
    const el = target ?? alertRef.current;
    if (!el) return;
    const frame = requestAnimationFrame(() => {
      if (!el.isConnected) return;
      const focusEl = focusable(el);
      focusEl.scrollIntoView({ block: "center" });
      focusEl.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [block, step]);

  useEffect(() => {
    if (!state?.error) return;
    const code = state.error;
    const at = wizardStepForIssue(code);
    if (at != null) setStep(at);
    setNote("");
    setBlockKind("publish");
    setBlock([code]);
  }, [state]);

  function payload() {
    return cards.map((card) => ({
      cardName: card.name,
      catalogCardId: card.catalogId,
      catalogTitle: card.catalogId ? card.catalogTitle : "",
      year: card.year,
      setName: card.setName,
      setCode: card.setCode,
      collectorNumber: card.number,
      rarity: card.rarity,
      language: card.language,
      game: card.game || categoryLabel,
      price: card.price,
      conditionTrack: card.track,
      rawGrade: card.rawGrade,
      grader: card.grader,
      gradeScore: card.gradeScore,
      certNumber: card.certNumber,
    }));
  }

  function reveal(issues: string[], kind: BlockKind) {
    const at = issues.reduce<number | null>((earliest, code) => {
      const stepAt = wizardStepForIssue(code);
      if (stepAt == null) return earliest;
      return earliest == null || stepAt < earliest ? stepAt : earliest;
    }, null);
    if (at != null) setStep(at);
    setNote("");
    setBlockKind(kind);
    setBlock(issues);
  }

  function go(next: number) {
    const dest = Math.max(0, Math.min(STEPS.length - 1, next));
    if (dest === step) return;
    setNote(tx(locale, `已去到「${STEPS[dest][0]}」。未發布。`, `Now on ${STEPS[dest][1]}. Not published.`));
    setBlock([]);
    setStep(dest);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (locked) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const value = submitter instanceof HTMLButtonElement ? submitter.value : "publish";
    const intent: ListingInput["intent"] = value === "draft" || value === "schedule" ? value : "publish";
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    data.set("intent", intent);
    data.set("photos", JSON.stringify(photos));
    data.set("cards", JSON.stringify(payload()));
    const input = parseListingForm(data);
    if (!input) {
      event.preventDefault();
      reveal(["category"], intent === "draft" ? "draft" : "publish");
      return;
    }
    const groupKey = selected?.groupKey || "tcg";
    const issues = wizardPublishIssues(input, groupKey, new Date(), storeReady);
    if (issues.length) {
      event.preventDefault();
      reveal(issues, intent === "draft" ? "draft" : "publish");
    }
  }

  function applyCatalog(index: number, hit: CatalogHit) {
    setCards((current) =>
      current.map((card, i) =>
        i === index
          ? {
              ...card,
              name: hit.cardName,
              catalogId: hit.id,
              catalogTitle: hit.title,
              game: hit.game,
              setName: hit.setName,
              setCode: hit.setCode || "",
              number: hit.collectorNumber,
              rarity: hit.rarity || "",
              language: hit.language,
              year: hit.year || card.year,
            }
          : card,
      ),
    );
    const image = hit.imageUrl?.trim();
    if (!image || !isAllowedMediaUrl(image)) return;
    setPhotos((current) => {
      if (current.some((photo) => photo.url === image) || current.length >= PHOTO_MAX) return current;
      const role = current.some((photo) => photo.role === "FRONT") ? "GALLERY" : "FRONT";
      return [{ url: image, role }, ...current];
    });
  }

  function patchCard(index: number, partial: Partial<CardDraft>) {
    setCards((current) => current.map((card, i) => (i === index ? { ...card, ...partial } : card)));
  }

  function onFiles(list: FileList | null) {
    if (!list?.length) return;
    const files: File[] = [];
    let failed = 0;
    for (const file of Array.from(list)) {
      if (!file.type.startsWith("image/")) {
        failed += 1;
        continue;
      }
      files.push(file);
    }
    enqueuePhotos(files, PHOTO_MAX - photos.length);
    if (failed) setPhotoNote(tx(locale, "有相片無法讀取，請改用 JPG 或 PNG。", "Some photos could not be read. Use JPG or PNG."));
    if (fileRef.current) fileRef.current.value = "";
  }

  function addHashtag() {
    const next = startHashtag(description, descCursor);
    setDescription(next.text);
    setDescCursor(next.cursor);
    requestAnimationFrame(() => {
      const el = descriptionRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.cursor, next.cursor);
    });
  }

  function movePhoto(from: number, to: number) {
    if (to < 0 || to >= photos.length || from === to) return;
    setPhotos((current) => {
      const next = [...current];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      return next;
    });
  }

  const shown = block;
  const blockHeading =
    blockKind === "draft"
      ? tx(locale, "未能存草稿，資料未齊：", "Can't save the draft yet. Still missing:")
      : tx(locale, "未能發布，資料未齊：", "Can't publish yet. Still missing:");

  const shipSummary = [
    sfCod ? tx(locale, "順豐到付", "SF cash on delivery") : "",
    meetup ? tx(locale, `面交 ${meetupDistrict || "未選地區"}`, `Meet-up ${meetupDistrict || "no district"}`) : "",
    pickup && storeReady ? tx(locale, "店舖自取", "Store pickup") : "",
  ].filter(Boolean);

  return (
    <form ref={formRef} action={action} noValidate onSubmit={onSubmit} className="grid min-w-0 gap-4">
      {initial?.listingId ? <input type="hidden" name="listingId" value={initial.listingId} /> : null}
      {initial?.collectionItemId ? <input type="hidden" name="collectionItemId" value={initial.collectionItemId} /> : null}
      {linkPost ? <input type="hidden" name="alsoPost" value="on" /> : null}
      <input type="hidden" name="photos" value={JSON.stringify(photos)} />
      <input type="hidden" name="cards" value={JSON.stringify(payload())} />
      <input type="hidden" name="saleType" value={postedSale} />
      <input type="hidden" name="quantity" value={String(initial?.quantity || 1)} />
      <input type="hidden" name="shippingDays" value={String(shipWithin)} />
      <input type="hidden" name="conditionTrack" value={first?.track || "RAW"} />
      <input type="hidden" name="rawGrade" value={first?.rawGrade || "A"} />
      <input type="hidden" name="grader" value={first?.grader || "PSA"} />
      <input type="hidden" name="gradeScore" value={first?.track === "GRADED" ? first.gradeScore : ""} />
      {!locked && auction ? (
        <>
          <input type="hidden" name="startPrice" value={startPrice} />
          <input type="hidden" name="reserve" value={reserve} />
          <input type="hidden" name="auctionDays" value={auctionDays} />
        </>
      ) : null}
      {locked && initial?.saleType && initial.saleType !== "BUY_NOW" ? (
        <>
          <input type="hidden" name="startPrice" value={initial.startPrice} />
          <input type="hidden" name="reserve" value={initial.reserve || ""} />
          <input type="hidden" name="auctionDays" value={initial.auctionDays || ""} />
          <input type="hidden" name="auctionEndsAt" value={initial.auctionEndsAt} />
        </>
      ) : null}
      {initial?.offersEnabled ? <input type="hidden" name="offersEnabled" value="on" /> : null}
      {initial?.offersEnabled ? <input type="hidden" name="minOffer" value={initial.minOffer} /> : null}
      {initial?.videoUrl ? <input type="hidden" name="videoUrl" value={initial.videoUrl} /> : null}
      {!locked ? <input type="hidden" name="promote" value={promote ? "on" : "off"} /> : null}
      {locked && initial ? <LockedFields initial={initial} /> : null}

      {!locked ? (
        <div className="grid gap-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-soft">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
          <ol className="grid grid-cols-4 gap-1.5" aria-label={tx(locale, "上架步驟", "Listing steps")}>
            {STEPS.map(([zh, en], index) => (
              <li key={zh}>
                <button
                  type="button"
                  aria-current={index === step ? "step" : undefined}
                  className={`min-h-11 w-full rounded-2xl px-1 text-xs font-semibold ${index === step ? "bg-accent text-white" : "bg-soft"}`}
                  onClick={() => go(index)}
                >
                  {index + 1}. {tx(locale, zh, en)}
                </button>
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted">
            {tx(locale, "未填完都可以跳去後面。發布時先檢查標題、價錢同至少一張相。", "You can jump ahead. Publish checks the title, price, and at least one photo.")}
          </p>
          {note ? <p aria-live="polite" className="text-sm text-ok">{note}</p> : null}
        </div>
      ) : (
        <p className="text-sm text-muted">{tx(locale, "已有出價：只可以改描述同加相片。", "This auction has bids. You can only edit the description and add photos.")}</p>
      )}

      {shown.length ? (
        <div ref={alertRef} role="alert" tabIndex={-1} data-wizard-jump className="rounded-2xl bg-soft px-3 py-3 text-sm text-danger outline-none">
          <p className="font-medium">{blockHeading}</p>
          <ul className="mt-1 list-disc pl-5">
            {shown.map((code) => (
              <li key={code}>{errText(locale, code)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div hidden={!locked && step !== 0} className="grid gap-4">
        <label className="grid gap-1 text-sm font-medium">
          <span className="flex flex-wrap items-baseline gap-x-2">
            {tx(locale, "標題", "Title")}
            <span className="font-normal text-muted">{tx(locale, "標題由你填寫，不會被圖鑑取代。", "You write the title. It is not replaced by the dex.")}</span>
          </span>
          <input
            className="field"
            name={locked ? undefined : "title"}
            disabled={locked}
            minLength={2}
            maxLength={80}
            value={title}
            aria-invalid={shown.includes("title")}
            placeholder={tx(locale, "例如：減價，Sv2a 全陪8折", "e.g. sale, Sv2a set 20% off")}
            onChange={(event) => setTitle(event.target.value)}
          />
          <FieldError locale={locale} codes={shown} code="title" />
        </label>

        {multi ? (
          <p className="text-sm text-muted">{tx(locale, "多於一張卡時，請在每張卡下填寫價錢。", "More than one card: enter a price on each card.")}</p>
        ) : (
          <div className="grid gap-3">
            {!locked ? (
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={tx(locale, "售賣方式", "Sale type")}>
                <button type="button" aria-pressed={mode === "fixed"} className={`h-11 rounded-full text-sm font-semibold ${mode === "fixed" ? "bg-accent text-white" : "bg-soft"}`} onClick={() => setMode("fixed")}>
                  {tx(locale, "固定價", "Fixed price")}
                </button>
                <button type="button" aria-pressed={mode === "auction"} className={`h-11 rounded-full text-sm font-semibold ${mode === "auction" ? "bg-accent text-white" : "bg-soft"}`} onClick={() => setMode("auction")}>
                  {tx(locale, "拍賣", "Auction")}
                </button>
              </div>
            ) : null}
            {auction ? (
              <>
                <label className="grid gap-1 text-sm font-medium">
                  {tx(locale, "起標價 HKD", "Start price HKD")}
                  <input className="field" inputMode="decimal" value={startPrice} disabled={locked} data-focus="startPrice" aria-invalid={shown.includes("start")} placeholder="100" onChange={(event) => setStartPrice(event.target.value)} />
                  <FieldError locale={locale} codes={shown} code="start" />
                </label>
                <div data-focus="auctionDays" className="grid gap-1">
                  <p className="text-sm font-medium">{tx(locale, "時長（1、3、5 或 7 日）", "Length (1, 3, 5, or 7 days)")}</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {AUCTION_DAYS.map((days) => (
                      <button key={days} type="button" aria-pressed={auctionDays === String(days)} disabled={locked} className={`h-11 shrink-0 rounded-full px-3 text-sm font-semibold ${auctionDays === String(days) ? "bg-accent text-white" : "bg-soft"}`} onClick={() => setAuctionDays(String(days))}>
                        {tx(locale, `${days} 日`, `${days}d`)}
                      </button>
                    ))}
                  </div>
                  <FieldError locale={locale} codes={shown} code="auction_days" />
                </div>
                <label className="grid gap-1 text-sm font-medium">
                  {tx(locale, "底價 HKD（選填・買家不可見）", "Reserve HKD (optional)")}
                  <input className="field" inputMode="decimal" value={reserve} disabled={locked} data-focus="reserve" aria-invalid={shown.includes("reserve")} placeholder={tx(locale, "可留空", "Optional")} onChange={(event) => setReserve(event.target.value)} />
                  <FieldError locale={locale} codes={shown} code="reserve" />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  {tx(locale, "即買價 HKD（選填）", "Buy It Now HKD (optional)")}
                  <input className="field" name={locked ? undefined : "price"} disabled={locked} inputMode="decimal" value={price} data-focus="price" aria-invalid={shown.includes("both_price")} placeholder={tx(locale, "可留空", "Optional")} onChange={(event) => setPrice(event.target.value)} />
                  <FieldError locale={locale} codes={shown} code="both_price" />
                </label>
              </>
            ) : (
              <label className="grid gap-1 text-sm font-medium">
                {tx(locale, "價錢 HKD", "Price HKD")}
                <input
                  className="field"
                  name={locked ? undefined : "price"}
                  disabled={locked}
                  inputMode="decimal"
                  value={price}
                  aria-invalid={shown.includes("price")}
                  placeholder="280"
                  onChange={(event) => setPrice(event.target.value)}
                />
                <FieldError locale={locale} codes={shown} code="price" />
              </label>
            )}
          </div>
        )}

        {!locked ? (
          <div data-focus="promote" className="grid gap-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{tx(locale, "推廣", "Promote")}</span>
              <button
                type="button"
                aria-pressed={promote}
                aria-label={tx(locale, promote ? "關閉推廣" : "開啟推廣", promote ? "Turn promo off" : "Turn promo on")}
                disabled={promoShort && !promote}
                className={`h-8 rounded-full px-3 text-xs font-semibold ${promote ? "bg-accent text-white" : "bg-soft text-ink"} disabled:opacity-50`}
                onClick={() => {
                  if (promote) setPromote(false);
                  else if (!promoShort) setPromote(true);
                }}
              >
                {promote ? tx(locale, "開", "On") : tx(locale, "關", "Off")}
              </button>
            </div>
            <p className="text-xs text-muted">{tx(locale, "消耗 1 飛／日 · 示範期已送 7", "1 per day · 7 granted for the demo")}</p>
            {promoShort ? (
              <p className="text-xs text-danger">
                <Link href="/me#promo">{tx(locale, "飛不足", "Not enough")}</Link>
              </p>
            ) : null}
          </div>
        ) : null}

        <div data-wizard-jump data-focus="photos" tabIndex={-1} className="grid gap-2 outline-none">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium">{tx(locale, `相片：${photos.length}/${PHOTO_MAX}`, `Photos: ${photos.length}/${PHOTO_MAX}`)}</p>
            <p className="text-xs text-muted">{tx(locale, "第一張是封面", "First photo is the cover")}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((photo, index) => (
              <div
                key={`${photo.url.slice(0, 48)}-${index}`}
                draggable={!locked}
                onDragStart={() => {
                  dragFrom.current = index;
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragFrom.current == null) return;
                  movePhoto(dragFrom.current, index);
                  dragFrom.current = null;
                }}
                className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-soft ring-1 ring-line"
              >
                <img src={photo.url} alt="" className="h-full w-full object-contain" />
                {index === 0 ? (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-[#0F172A] px-2 py-0.5 text-[10px] font-semibold text-white">
                    {tx(locale, "封面", "Cover")}
                  </span>
                ) : null}
                <button
                  type="button"
                  className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-[#0F172A] text-white"
                  aria-label={tx(locale, "移除相片", "Remove photo")}
                  disabled={locked}
                  onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                >
                  <span className="glyph-x" aria-hidden>×</span>
                </button>
                <div className="absolute inset-x-1 bottom-1 flex gap-1">
                  <button type="button" className="h-10 flex-1 rounded-full bg-card/95 text-xs font-semibold" disabled={index === 0} onClick={() => movePhoto(index, index - 1)}>
                    {tx(locale, "前", "Up")}
                  </button>
                  <button type="button" className="h-10 flex-1 rounded-full bg-card/95 text-xs font-semibold" disabled={index === photos.length - 1} onClick={() => movePhoto(index, index + 1)}>
                    {tx(locale, "後", "Down")}
                  </button>
                </div>
              </div>
            ))}
            {photos.length < PHOTO_MAX ? (
              <label data-wizard-jump data-focus="photos-add" tabIndex={-1} className="grid aspect-[3/4] cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-muted bg-card text-sm font-semibold outline-none">
                {tx(locale, "加相片", "Add")}
                <input ref={fileRef} className="sr-only" type="file" accept="image/*" multiple onChange={(event) => void onFiles(event.target.files)} />
              </label>
            ) : null}
          </div>
          <p className="text-sm text-muted">{tx(locale, "相片越多，越容易賣出。可以拖曳調順序。", "More photos help. Drag to reorder.")}</p>
          {photoNote ? <p className="text-sm text-danger">{photoNote}</p> : null}
          <FieldError locale={locale} codes={shown} code="photos" />
          <FieldError locale={locale} codes={shown} code="photo_url" />
        </div>

        <label className="grid gap-1 text-sm font-medium">
          {tx(locale, "簡單描述", "Short description")}
          <textarea
            ref={descriptionRef}
            className="field min-h-28"
            name="description"
            maxLength={5000}
            value={description}
            placeholder={tx(locale, "可留空。", "Optional.")}
            aria-invalid={shown.includes("description")}
            onChange={(event) => {
              setDescription(event.target.value);
              setDescCursor(event.target.selectionStart ?? event.target.value.length);
            }}
            onSelect={(event) => setDescCursor(event.currentTarget.selectionStart ?? description.length)}
          />
          <FieldError locale={locale} codes={shown} code="description" />
        </label>
        <HashtagHint locale={locale} onAdd={addHashtag} />
      </div>

      {!locked ? (
        <div hidden={step !== 1} className="grid gap-4">
          <label className="grid gap-1 text-sm font-medium">
            {tx(locale, "卡片分類", "Card category")}
            <select
              className="field"
              name="categoryId"
              value={categoryId}
              aria-invalid={shown.includes("category")}
              onChange={(event) => {
                const nextId = event.target.value;
                setCategoryId(nextId);
                setCards((current) => current.map((card) => ({ ...card, catalogId: "", catalogTitle: "" })));
              }}
            >
              {ordered.map((cat) => (
                <option key={cat.id} value={cat.id}>{locale === "en" ? cat.nameEn : cat.nameZh}</option>
              ))}
            </select>
            <FieldError locale={locale} codes={shown} code="category" />
          </label>
          <p className="text-sm text-muted">
            {tx(locale, "卡名係副題同搜尋用。買家見到的主標題仍然係上一步。", "The card name is the subtitle and a search signal. Buyers still see the title from the previous step.")}
          </p>
          {cards.map((card, index) => {
            const firstMissingPrice = cards.findIndex((row) => !row.price.trim());
            return (
              <section key={card.key} className="surface grid gap-3 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">{tx(locale, `卡 ${index + 1}`, `Card ${index + 1}`)}</h2>
                  {cards.length > 1 ? (
                    <button type="button" className="btn btn-ghost h-11 px-3 text-sm text-danger" onClick={() => setCards((current) => current.filter((row) => row.key !== card.key))}>
                      {tx(locale, "移除", "Remove")}
                    </button>
                  ) : null}
                </div>
                <CatalogTitleField
                  locale={locale}
                  game={catalogGame || undefined}
                  value={card.name}
                  named={false}
                  label={tx(locale, "卡名（選填）", "Card name (optional)")}
                  placeholder={
                    catalogGame === "topps-basketball" || catalogGame === "topps-soccer"
                      ? tx(locale, "打球員或卡號", "Player or number")
                      : tx(locale, "打卡名或卡號", "Card name or number")
                  }
                  pinOnPick={(hit) => hit.cardName}
                  onValue={(value) => patchCard(index, { name: value, catalogId: "", catalogTitle: "" })}
                  onPick={(hit) => applyCatalog(index, hit)}
                  onFree={() => patchCard(index, { catalogId: "", catalogTitle: "" })}
                />
                {card.catalogId ? (
                  <div className="grid gap-2 rounded-2xl bg-soft px-3 py-3 text-sm">
                    <p className="font-semibold">{tx(locale, "已揀卡名", "Card selected")}</p>
                    <p>{card.catalogTitle}</p>
                    <button type="button" className="min-h-11 text-left font-semibold text-link" onClick={() => patchCard(index, { catalogId: "", catalogTitle: "" })}>
                      {tx(locale, "改為自己填", "Fill it in yourself")}
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm">{tx(locale, "年份", "Year")}<input className="field" inputMode="numeric" value={card.year} placeholder="2023" onChange={(event) => patchCard(index, { year: event.target.value })} /></label>
                    <label className="grid gap-1 text-sm">{tx(locale, "系列", "Set")}<input className="field" value={card.setName} placeholder="SV2a" onChange={(event) => patchCard(index, { setName: event.target.value })} /></label>
                    <label className="grid gap-1 text-sm">{tx(locale, "卡號", "Number")}<input className="field" value={card.number} placeholder="193" onChange={(event) => patchCard(index, { number: event.target.value })} /></label>
                    <label className="grid gap-1 text-sm">{tx(locale, "稀有度", "Rarity")}<input className="field" value={card.rarity} placeholder="SR" onChange={(event) => patchCard(index, { rarity: event.target.value })} /></label>
                    <label className="grid gap-1 text-sm sm:col-span-2">
                      {tx(locale, "語言", "Language")}
                      <input className="field" value={card.language} list="sell-langs" onChange={(event) => patchCard(index, { language: event.target.value })} />
                    </label>
                  </div>
                )}
                <ConditionFields locale={locale} card={card} invalid={shown.includes("grade")} onChange={(partial) => patchCard(index, partial)} />
                {multi ? (
                  <label className="grid gap-1 text-sm font-medium">
                    {tx(locale, "價錢 HKD", "Price HKD")}
                    <input
                      className="field"
                      inputMode="decimal"
                      value={card.price}
                      data-focus={index === firstMissingPrice ? "cardPrice" : undefined}
                      data-wizard-jump={index === firstMissingPrice ? "" : undefined}
                      aria-invalid={shown.includes("card_price")}
                      placeholder="280"
                      onChange={(event) => patchCard(index, { price: event.target.value })}
                    />
                  </label>
                ) : null}
              </section>
            );
          })}
          <datalist id="sell-langs">
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang} />
            ))}
          </datalist>
          <FieldError locale={locale} codes={shown} code="card_price" anchor="cardPrice" />
          <FieldError locale={locale} codes={shown} code="grade" />
          <button type="button" className="btn btn-ghost w-full" onClick={() => setCards((current) => [...current, blankCard({ game: categoryLabel })])}>
            {tx(locale, "加多一張卡", "Add another card")}
          </button>
        </div>
      ) : null}

      {!locked ? (
        <div hidden={step !== 2} className="grid gap-3 text-sm">
          <fieldset className="grid gap-2">
            <legend className="font-medium">{tx(locale, "貨況", "Stock")}</legend>
            <div className="grid grid-cols-2 gap-2">
              <label className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl px-3 font-semibold ${stockType === "IN_STOCK" ? "bg-accent text-white" : "bg-soft"}`}>
                <input className="sr-only" type="radio" name="stockType" value="IN_STOCK" checked={stockType === "IN_STOCK"} onChange={() => setStockType("IN_STOCK")} />
                {tx(locale, "現貨", "In stock")}
              </label>
              <label className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl px-3 font-semibold ${stockType === "PREORDER" ? "bg-accent text-white" : "bg-soft"}`}>
                <input className="sr-only" type="radio" name="stockType" value="PREORDER" checked={stockType === "PREORDER"} onChange={() => setStockType("PREORDER")} />
                {tx(locale, "預訂", "Preorder")}
              </label>
            </div>
            {stockType === "IN_STOCK" ? (
              <div data-wizard-jump data-focus="shipWithin" tabIndex={-1} className="grid grid-cols-3 gap-2 outline-none">
                {[3, 7, 30].map((days) => (
                  <label key={days} className={`flex min-h-12 items-center justify-center rounded-2xl font-semibold ${shipWithin === days ? "bg-accent text-white" : "bg-soft"}`}>
                    <input className="sr-only" type="radio" name="shipWithinDays" value={days} checked={shipWithin === days} onChange={() => setShipWithin(days)} />
                    {tx(locale, `${days} 日`, `${days} days`)}
                  </label>
                ))}
              </div>
            ) : (
              <label className="grid gap-1 font-medium">
                {tx(locale, "出貨日期", "Ship date")}
                <input className="field" type="date" name="preorderShipDate" value={preorderDate} aria-invalid={shown.includes("preorder")} onChange={(event) => setPreorderDate(event.target.value)} />
                <FieldError locale={locale} codes={shown} code="preorder" />
              </label>
            )}
            <FieldError locale={locale} codes={shown} code="ship_within" anchor="shipWithin" />
          </fieldset>
          <p className="text-sm text-muted">{tx(locale, "至少選一種交收方式。雙方自行交收，平台不代收款。", "Pick at least one handover method. You settle it yourselves. The platform does not take payment.")}</p>
          <label className="grid gap-1 rounded-2xl bg-soft p-3">
            <span className="flex min-h-12 items-center gap-2 font-medium">
              <input type="checkbox" name="shipSfCod" data-wizard-jump checked={sfCod} aria-invalid={shown.includes("shipping")} onChange={(event) => setSfCod(event.target.checked)} />
              {tx(locale, "順豐到付", "SF cash on delivery")}
            </span>
          </label>
          <div className="grid gap-2 rounded-2xl bg-soft p-3">
            <label className="flex min-h-12 items-center gap-2 font-medium">
              <input type="checkbox" name="shipMeetup" checked={meetup} onChange={(event) => setMeetup(event.target.checked)} />
              {tx(locale, "面交", "Meet-up")}
            </label>
            {meetup ? (
              <>
                <label className="grid gap-1">
                  {tx(locale, "面交地區", "Meet-up district")}
                  <select className="field" name="meetupDistrict" value={meetupDistrict} aria-invalid={shown.includes("meetup")} onChange={(event) => setMeetupDistrict(event.target.value)}>
                    <option value="">{tx(locale, "選擇地區", "Choose a district")}</option>
                    {DISTRICTS.map(([zh, en]) => (
                      <option key={zh} value={zh}>{locale === "en" ? en : zh}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  {tx(locale, "常用時段（可選）", "Usual time (optional)")}
                  <input className="field" name="meetupWindow" value={meetupWindow} maxLength={80} onChange={(event) => setMeetupWindow(event.target.value)} />
                </label>
                <label className="grid gap-1">
                  {tx(locale, "備註（可選）", "Note (optional)")}
                  <input className="field" name="meetupNotes" value={meetupNotes} maxLength={200} onChange={(event) => setMeetupNotes(event.target.value)} />
                </label>
              </>
            ) : null}
          </div>
          <div className="grid gap-2 rounded-2xl bg-soft p-3">
            <label className={`flex min-h-12 items-center gap-2 font-medium ${storeReady ? "" : "opacity-60"}`}>
              <input type="checkbox" name="shipPickup" checked={pickup && storeReady} disabled={!storeReady} aria-invalid={shown.includes("store")} onChange={(event) => setPickup(event.target.checked)} />
              {tx(locale, "店舖自取", "Store pickup")}
            </label>
            {storeReady ? (
              <p className="text-muted">{storeLabel}</p>
            ) : (
              <p className="text-muted">
                <a className="text-link" href="/me/settings/account#store" data-focus="store" data-wizard-jump>{tx(locale, "去帳戶設定店舖地址", "Set the shop address")}</a>
              </p>
            )}
          </div>
          <FieldError locale={locale} codes={shown} code="shipping" />
          <FieldError locale={locale} codes={shown} code="meetup" />
          <FieldError locale={locale} codes={shown} code="store" anchor="store" />
        </div>
      ) : null}

      {!locked && step === 3 ? (
        <section className="surface grid gap-3 p-4 text-sm">
          <h2 className="font-semibold">{tx(locale, "預覽", "Preview")}</h2>
          <div className="flex gap-2 overflow-x-auto">
            {photos.map((photo, index) => (
              <img key={index} src={photo.url} alt="" className="h-28 w-20 shrink-0 rounded-xl bg-soft object-contain" />
            ))}
          </div>
          <p className="text-lg font-semibold">{title || tx(locale, "未填標題", "No title yet")}</p>
          {description ? <p className="whitespace-pre-wrap text-muted">{description}</p> : null}
          <p>
            {multi
              ? tx(locale, `合計 HK$${cards.reduce((sum, card) => sum + (Number(card.price) || 0), 0)}`, `Total HK$${cards.reduce((sum, card) => sum + (Number(card.price) || 0), 0)}`)
              : auction
                ? tx(
                    locale,
                    `拍賣 · 起標 HK$${startPrice || "—"} · ${auctionDays} 日${reserve.trim() ? ` · 底價 HK$${reserve}` : ""}${price.trim() ? ` · 即買 HK$${price}` : ""}`,
                    `Auction · start HK$${startPrice || "—"} · ${auctionDays}d${reserve.trim() ? ` · reserve HK$${reserve}` : ""}${price.trim() ? ` · BIN HK$${price}` : ""}`,
                  )
                : price
                  ? `HK$${price}`
                  : tx(locale, "未填價錢", "No price yet")}
          </p>
          <ul className="grid gap-1 text-muted">
            {cards.map((card) => (
              <li key={card.key}>
                {cardDisplayName({ catalogTitle: card.catalogTitle, cardName: card.name, title: cards.length < 2 ? title : "" }) || tx(locale, "未填卡名", "No card name")}
                {multi && card.price ? ` · HK$${card.price}` : ""}
                {` · ${card.track === "GRADED" ? `${card.grader} ${card.gradeScore}` : card.rawGrade}`}
              </li>
            ))}
          </ul>
          <p className="text-muted">{categoryLabel}</p>
          <p className="text-muted">
            {stockType === "PREORDER"
              ? tx(locale, `預訂 · 出貨 ${preorderDate || "未選日期"}`, `Preorder · ships ${preorderDate || "no date"}`)
              : tx(locale, `現貨 · ${shipWithin} 日內出貨`, `In stock · ships within ${shipWithin} days`)}
          </p>
          <p className="text-muted">{shipSummary.join(" · ") || tx(locale, "未選交收方式", "No handover method")}</p>
          <p className="text-sm text-muted">{tx(locale, "買家於貨品頁安排交收。平台不代收、不擔保。", "Buyers arrange a handover from the listing. The platform does not take payment.")}</p>
          {hints.length ? (
            <ul className="text-muted">
              {hints.map((hint) => (
                <li key={hint.title}>{hint.title} · {hint.price}</li>
              ))}
            </ul>
          ) : null}
          <fieldset className="grid gap-2">
            <legend className="font-medium">{tx(locale, "發布", "Publish")}</legend>
            <div className="grid grid-cols-2 gap-2">
              <label className={`flex min-h-12 items-center justify-center rounded-2xl font-semibold ${publishMode === "now" ? "bg-accent text-white" : "bg-soft"}`}>
                <input className="sr-only" type="radio" checked={publishMode === "now"} onChange={() => setPublishMode("now")} />
                {tx(locale, "即時", "Now")}
              </label>
              <label className={`flex min-h-12 items-center justify-center rounded-2xl font-semibold ${publishMode === "later" ? "bg-accent text-white" : "bg-soft"}`}>
                <input className="sr-only" type="radio" checked={publishMode === "later"} onChange={() => setPublishMode("later")} />
                {tx(locale, "排程", "Schedule")}
              </label>
            </div>
            {publishMode === "later" ? (
              <div data-wizard-jump data-focus="publishAt" className="grid gap-2 outline-none">
                <p className="text-muted">{tx(locale, "香港時間。到點先會公開。", "Hong Kong time. It stays hidden until then.")}</p>
                <HkDateTime locale={locale} name="publishAt" defaultValue={initial?.publishAt} onChange={onPublishAt} />
                <FieldError locale={locale} codes={shown} code="schedule" />
              </div>
            ) : (
              <p className="text-muted">{tx(locale, "而家發布就即時公開。", "Publish now and it goes live immediately.")}</p>
            )}
          </fieldset>
        </section>
      ) : null}

      <div className="grid gap-2">
        {!locked && step < 3 ? (
          <button type="button" className="btn btn-primary w-full" onClick={() => go(step + 1)}>{tx(locale, "下一步", "Next")}</button>
        ) : null}
        {locked || step === 3 ? <IntentButtons locale={locale} locked={locked} scheduling={scheduling} /> : null}
        {!locked && step > 0 ? (
          <button type="button" className="btn btn-ghost w-fit" onClick={() => go(step - 1)}>{tx(locale, "上一步", "Back")}</button>
        ) : null}
        {!locked && step < 3 ? <DraftButton locale={locale} /> : null}
      </div>
      {cropEditor}
    </form>
  );
}

function ConditionFields({
  locale,
  card,
  invalid,
  onChange,
}: {
  locale: Locale;
  card: CardDraft;
  invalid: boolean;
  onChange: (partial: Partial<CardDraft>) => void;
}) {
  return (
    <fieldset className="grid gap-2 text-sm">
      <legend className="font-medium">{tx(locale, "品相", "Condition")}</legend>
      <div className="flex gap-2">
        <label className="inline-flex h-11 items-center gap-2 rounded-full bg-soft px-3">
          <input type="radio" checked={card.track === "RAW"} onChange={() => onChange({ track: "RAW" })} />
          Raw
        </label>
        <label className="inline-flex h-11 items-center gap-2 rounded-full bg-soft px-3">
          <input type="radio" checked={card.track === "GRADED"} onChange={() => onChange({ track: "GRADED" })} />
          {tx(locale, "評級", "Graded")}
        </label>
      </div>
      {card.track === "RAW" ? (
        <select className="field" value={card.rawGrade} data-focus="rawGrade" aria-invalid={invalid} onChange={(event) => onChange({ rawGrade: event.target.value })}>
          {RAW_OPTIONS.map(([grade, zh, en]) => (
            <option key={grade} value={grade}>{tx(locale, zh, en)}</option>
          ))}
        </select>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <select className="field" value={card.grader} onChange={(event) => onChange({ grader: event.target.value })}>
            {["PSA", "BGS", "CGC", "TAG"].map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
          <input className="field" inputMode="decimal" placeholder={tx(locale, "分數", "Score")} value={card.gradeScore} data-focus="gradeScore" aria-invalid={invalid} onChange={(event) => onChange({ gradeScore: event.target.value })} />
        </div>
      )}
    </fieldset>
  );
}

function shownField(el: HTMLElement) {
  if (el.closest("[hidden]")) return false;
  return !(el instanceof HTMLInputElement && (el.type === "hidden" || el.type === "file"));
}

function findWizardField(form: HTMLFormElement, field: string) {
  const selector = `[data-focus="${CSS.escape(field)}"], [name="${CSS.escape(field)}"]`;
  const visible = [...form.querySelectorAll<HTMLElement>(selector)].filter(shownField);
  return visible.find((el) => el.matches("input, textarea, select, label")) ?? visible[0] ?? null;
}

function focusable(el: HTMLElement) {
  if (el.matches("input:not([type=hidden]):not([type=file]), textarea, select, button, a[href], summary, [tabindex]")) return el;
  return el.querySelector<HTMLElement>("input:not([type=hidden]):not([type=file]), textarea, select, button, summary") ?? el;
}

function FieldError({ locale, codes, code, anchor }: { locale: Locale; codes: string[]; code: string; anchor?: string }) {
  if (!codes.includes(code)) return null;
  return (
    <p data-focus={anchor} data-wizard-jump={anchor ? "" : undefined} tabIndex={anchor ? -1 : undefined} className="text-sm text-danger outline-none">
      {errText(locale, code)}
    </p>
  );
}

function LockedFields({ initial }: { initial: SellInitial }) {
  return (
    <>
      <input type="hidden" name="categoryId" value={initial.categoryId} />
      <input type="hidden" name="title" value={initial.title} />
      <input type="hidden" name="price" value={initial.price} />
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

function HkDateTime({ locale, name, defaultValue, onChange }: { locale: Locale; name: string; defaultValue?: string; onChange?: (value: string) => void }) {
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
  return (
    <div className="grid gap-2">
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap gap-2">
        {presets.map(([label, parts]) => (
          <button key={label} type="button" className="btn btn-ghost" onClick={() => apply(parts)}>{label}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <SelectBox label={tx(locale, "日", "Day")} value={day} onChange={setDay} options={range(1, 31)} />
        <SelectBox label={tx(locale, "月", "Month")} value={month} onChange={setMonth} options={range(1, 12)} />
        <SelectBox label={tx(locale, "年", "Year")} value={year} onChange={setYear} options={[nowYear, nowYear + 1].map(String)} />
        <SelectBox label={tx(locale, "時", "Hour")} value={hour} onChange={setHour} options={range(0, 23)} />
        <SelectBox label={tx(locale, "分", "Min")} value={minute} onChange={setMinute} options={["0", "15", "30", "45"]} />
      </div>
      <p className="text-xs text-muted">{value ? `${tx(locale, "香港時間", "Hong Kong time")} ${value.replace("T", " ")}` : tx(locale, "請選擇時間", "Choose a time")}</p>
    </div>
  );
}

function SelectBox({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-xs text-muted">
      {label}
      <select className="field" value={value} onChange={(event) => onChange(event.target.value)}>
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
  const label = pending ? tx(locale, "處理中", "Working") : scheduling && !locked ? tx(locale, "排程發布", "Schedule") : tx(locale, "發布", "Publish");
  return (
    <>
      <button className="sell-cta btn w-full" name="intent" value={scheduling && !locked ? "schedule" : "publish"} disabled={pending}>
        {label}
      </button>
      {locked ? null : (
        <button className="btn btn-ghost w-fit" name="intent" value="draft" disabled={pending}>{tx(locale, "存草稿", "Save draft")}</button>
      )}
    </>
  );
}

function DraftButton({ locale }: { locale: Locale }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-ghost" name="intent" value="draft" disabled={pending}>{tx(locale, "存草稿", "Save draft")}</button>
  );
}
