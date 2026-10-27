"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { saveCollection, savePost } from "@/actions/collect";
import { errText, tx, type Locale } from "@/lib/i18n";
import { fileToDataUrl } from "./photo-file";
import { SellForm, type SellInitial } from "./sell-form";

type Cat = { id: string; nameZh: string; nameEn: string; groupKey: string; slug?: string };
type Photo = { url: string; role: "FRONT" | "BACK" | "GALLERY" };

const DEMOS = [
  { url: "/demo/cards/seed_charizard.svg", zh: "噴火龍", en: "Charizard" },
  { url: "/demo/cards/seed_pikachu.svg", zh: "皮卡丘", en: "Pikachu" },
  { url: "/demo/cards/seed_charizard-back.svg", zh: "卡背", en: "Back" },
];

const RAW = [
  ["A", "A · 近全新", "A · Near mint"],
  ["B", "B · 良好", "B · Good"],
  ["C", "C · 有使用痕跡", "C · Played"],
  ["D", "D · 明顯損傷", "D · Damaged"],
] as const;

function nextRole(photos: Photo[]): Photo["role"] {
  if (!photos.some((photo) => photo.role === "FRONT")) return "FRONT";
  if (!photos.some((photo) => photo.role === "BACK")) return "BACK";
  return "GALLERY";
}

function Submit({ label }: { label: string }) {
  const status = useFormStatus();
  return (
    <button className="btn btn-primary w-full" disabled={status.pending}>
      {status.pending ? "…" : label}
    </button>
  );
}

export function CollectForm({
  locale,
  mode,
  categories,
  phoneVerified,
  percent = "8",
  storeReady = false,
  storeLabel = "",
}: {
  locale: Locale;
  mode: "collection" | "post";
  categories: Cat[];
  phoneVerified: boolean;
  percent?: string;
  storeReady?: boolean;
  storeLabel?: string;
}) {
  const [state, action] = useActionState(mode === "post" ? savePost : saveCollection, null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [forSale, setForSale] = useState(false);
  const [alsoList, setAlsoList] = useState(false);
  const [listToken, setListToken] = useState(0);
  const [body, setBody] = useState("");
  const [track, setTrack] = useState<"RAW" | "GRADED">("RAW");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [photoNote, setPhotoNote] = useState("");
  const group = categories.find((cat) => cat.id === categoryId)?.groupKey || "tcg";

  function toggleList(checked: boolean) {
    if (checked) setListToken((token) => token + 1);
    setAlsoList(checked);
  }

  function addPhoto(url: string) {
    setPhotos((prev) => {
      if (!url || prev.length >= 12 || prev.some((photo) => photo.url === url)) return prev;
      return [...prev, { url, role: nextRole(prev) }];
    });
  }

  async function onFiles(list: FileList | null) {
    if (!list) return;
    for (const file of [...list].slice(0, 12)) {
      try {
        addPhoto(await fileToDataUrl(file));
      } catch {
        setPhotoNote(tx(locale, "這張相片讀不到或太大。", "Could not read that photo."));
      }
    }
  }

  if (mode === "post" && alsoList) {
    const line = body.trim().split("\n")[0]?.trim().slice(0, 80) ?? "";
    const initial: SellInitial = {
      categoryId: categories.find((cat) => cat.slug === "pokemon")?.id || categories[0]?.id || "",
      title: line.length >= 2 ? line : "",
      description: body.trim(),
      saleType: "BUY_NOW",
      price: "",
      startPrice: "",
      auctionEndsAt: "",
      offersEnabled: false,
      minOffer: "",
      shippingDays: 3,
      shipSfCod: true,
      shipMeetup: false,
      shipPickup: false,
      meetupDistrict: "",
      meetupWindow: "",
      meetupNotes: "",
      quantity: 1,
      game: "",
      setName: "",
      cardName: "",
      cardNumber: "",
      rarity: "",
      language: "",
      personName: "",
      seasonYear: "",
      brandSeries: "",
      conditionTrack: "RAW",
      rawGrade: "A",
      grader: "PSA",
      gradeScore: "",
      certNumber: "",
      videoUrl: "",
      publishAt: "",
      photos,
      locked: false,
    };
    return (
      <div className="grid gap-4">
        <label className="surface flex items-center justify-between gap-3 px-4 py-3">
          <span>
            <span className="block font-semibold">{tx(locale, "同時上架", "List it too")}</span>
            <span className="block text-sm text-muted">{tx(locale, "用同一張上架表。標題同相片已帶入。", "Same listing form. Title and photos are filled in.")}</span>
          </span>
          <input type="checkbox" checked={alsoList} onChange={(event) => toggleList(event.target.checked)} className="h-6 w-6" />
        </label>
        {!phoneVerified ? <p className="text-sm text-danger">{tx(locale, "放賣要先驗證香港電話。", "Verify your Hong Kong phone before selling.")}</p> : null}
        <SellForm key={listToken} locale={locale} categories={categories} percent={percent} storeReady={storeReady} storeLabel={storeLabel} linkPost initial={initial} />
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      {state?.error ? <p className="rounded-2xl bg-soft px-4 py-3 text-sm text-danger">{errText(locale, state.error)}</p> : null}
      <input type="hidden" name="photos" value={JSON.stringify(photos)} />
      <div className="grid gap-2">
        <div className="flex gap-2 overflow-x-auto">
          {photos.map((photo, index) => (
            <button
              key={`${photo.url}-${index}`}
              type="button"
              className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-soft"
              onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
            >
              <img src={photo.url} alt="" className="h-full w-full object-contain" />
              <span className="absolute bottom-1 left-1 rounded-full bg-card px-1.5 text-[10px]">{index === 0 ? tx(locale, "刪", "×") : index + 1}</span>
            </button>
          ))}
        </div>
        <label className="btn btn-ghost w-fit cursor-pointer">
          {tx(locale, "加相片", "Add photos")}
          <input className="sr-only" type="file" accept="image/*" multiple onChange={(event) => void onFiles(event.target.files)} />
        </label>
        <div className="flex flex-wrap gap-2">
          {DEMOS.map((demo) => (
            <button key={demo.url} type="button" className="h-11 rounded-full bg-soft px-3 text-sm" onClick={() => addPhoto(demo.url)}>
              {locale === "en" ? demo.en : demo.zh}
            </button>
          ))}
        </div>
        {photoNote ? <p className="text-sm text-danger">{photoNote}</p> : null}
        {mode === "collection" ? (
          <p className="text-sm text-muted">{tx(locale, "My Binder 至少一張相。放賣至少兩張，評級卡要有正面同背面。", "One photo for My Binder. Two to sell. Graded cards need a front and a back.")}</p>
        ) : null}
      </div>

      {mode === "post" ? (
        <>
          <textarea className="field min-h-28" name="body" maxLength={500} value={body} placeholder={tx(locale, "寫幾隻字…", "Write something…")} onChange={(event) => setBody(event.target.value)} />
          <label className="surface flex items-center justify-between gap-3 px-4 py-3">
            <span>
              <span className="block font-semibold">{tx(locale, "同時上架", "List it too")}</span>
              <span className="block text-sm text-muted">{tx(locale, "用同一張上架表，並帶入標題同相片。", "Opens the same listing form with the title and photos filled in.")}</span>
            </span>
            <input type="checkbox" name="alsoList" checked={alsoList} onChange={(event) => toggleList(event.target.checked)} className="h-6 w-6" />
          </label>
          <Submit label={tx(locale, "發佈", "Post")} />
        </>
      ) : (
        <>
          <label className="grid gap-1 text-sm font-medium">
            {tx(locale, "卡名", "Card name")}
            <input className="field" name="title" required minLength={2} maxLength={80} placeholder={tx(locale, "例如噴火龍 VMAX", "e.g. Charizard VMAX")} />
          </label>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">{tx(locale, "品相", "Condition")}</legend>
            <div className="flex gap-2">
              <label className="inline-flex h-11 items-center gap-2 rounded-full bg-soft px-3 text-sm">
                <input type="radio" name="conditionTrack" value="RAW" checked={track === "RAW"} onChange={() => setTrack("RAW")} />
                Raw
              </label>
              <label className="inline-flex h-11 items-center gap-2 rounded-full bg-soft px-3 text-sm">
                <input type="radio" name="conditionTrack" value="GRADED" checked={track === "GRADED"} onChange={() => setTrack("GRADED")} />
                {tx(locale, "評級", "Graded")}
              </label>
            </div>
            {track === "RAW" ? (
              <select className="field" name="rawGrade" defaultValue="A">
                {RAW.map(([value, zh, en]) => (
                  <option key={value} value={value}>{locale === "en" ? en : zh}</option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <select className="field" name="grader" defaultValue="PSA">
                  {["PSA", "BGS", "CGC", "TAG"].map((grader) => (
                    <option key={grader}>{grader}</option>
                  ))}
                </select>
                <input className="field" name="gradeScore" inputMode="decimal" placeholder={tx(locale, "分數", "Score")} />
              </div>
            )}
          </fieldset>
          <label className="grid gap-1 text-sm font-medium">
            {tx(locale, "備註", "Note")}
            <textarea className="field" name="note" maxLength={500} placeholder={tx(locale, "可留空", "Optional")} />
          </label>
          <fieldset className="grid gap-2" aria-label={tx(locale, "My Binder，我的卡", "My Binder")}>
            <legend className="text-sm font-medium">My Binder</legend>
            <label className="inline-flex h-11 items-center gap-2 text-sm">
              <input type="radio" name="visibility" value="PUBLIC" defaultChecked />
              {tx(locale, "公開", "Public")}
            </label>
            <label className="inline-flex h-11 items-center gap-2 text-sm">
              <input type="radio" name="visibility" value="PRIVATE" />
              {tx(locale, "私人", "Private")}
            </label>
          </fieldset>
          <label className="surface flex items-center justify-between gap-3 px-4 py-3">
            <span>
              <span className="block font-semibold">{tx(locale, "放賣", "List for sale")}</span>
              <span className="block text-sm text-muted">{tx(locale, "直購，運費預設順豐到付。會同時發到動態。", "Buy It Now, SF cash on delivery. Also posts to the feed.")}</span>
            </span>
            <input type="checkbox" name="forSale" checked={forSale} onChange={(event) => setForSale(event.target.checked)} className="h-5 w-5" />
          </label>
          {forSale ? (
            <div className="grid gap-3">
              {!phoneVerified ? <p className="text-sm text-danger">{tx(locale, "放賣要先驗證香港電話。", "Verify your Hong Kong phone before selling.")}</p> : null}
              <label className="grid gap-1 text-sm font-medium">
                {tx(locale, "價錢 HKD", "Price HKD")}
                <input className="field" name="price" inputMode="decimal" placeholder="280" required />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                {tx(locale, "分類", "Category")}
                <select className="field" name="categoryId" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{locale === "en" ? cat.nameEn : cat.nameZh}</option>
                  ))}
                </select>
              </label>
              {group === "tcg" ? (
                <div className="grid gap-2">
                  <input className="field" name="game" required placeholder={tx(locale, "遊戲，例如 Pokémon", "Game, e.g. Pokémon")} />
                  <input className="field" name="setName" required placeholder={tx(locale, "系列", "Set")} />
                  <input className="field" name="language" required defaultValue={locale === "en" ? "Japanese" : "日文"} placeholder={tx(locale, "語言", "Language")} />
                </div>
              ) : (
                <div className="grid gap-2">
                  <input className="field" name="seasonYear" required placeholder={tx(locale, "賽季／年份", "Season / year")} />
                  <input className="field" name="brandSeries" required placeholder={tx(locale, "品牌系列", "Brand / series")} />
                </div>
              )}
              <p className="text-sm text-muted">
                <Link className="text-link" href="/sell">{tx(locale, "進階上架", "Advanced listing")}</Link>
                {tx(locale, "可以改運送同排程。", " covers shipping and scheduling.")}
              </p>
            </div>
          ) : (
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" name="publish" />
              {tx(locale, "發佈到動態", "Post to the feed")}
            </label>
          )}
          <Submit label={forSale ? tx(locale, "加入 My Binder 並放賣", "Add to My Binder and list") : tx(locale, "加入 My Binder", "Add to My Binder")} />
        </>
      )}
    </form>
  );
}
