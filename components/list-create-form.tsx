"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { publishCreateAction } from "@/actions/trade";
import { createTitle } from "@/lib/create-modes";
import { DISTRICTS } from "@/lib/format";
import { errText, tx, type Locale } from "@/lib/i18n";
import { LISTING_CROP_ASPECT } from "@/lib/photo-crop";
import { PHOTO_MAX } from "@/lib/sell-wizard";
import { usePhotoCropQueue } from "./photo-crop";

type Cat = { id: string; nameZh: string; nameEn: string };
type Photo = { url: string; role: "FRONT" | "BACK" | "GALLERY" };

const ONE_CARD = JSON.stringify([
  {
    cardName: "",
    catalogCardId: "",
    catalogTitle: "",
    year: "",
    setName: "",
    setCode: "",
    collectorNumber: "",
    rarity: "",
    language: "",
    game: "",
    price: "",
    conditionTrack: "RAW",
    rawGrade: "A",
    grader: "",
    gradeScore: "",
    certNumber: "",
  },
]);

function SubmitLabel({ locale }: { locale: Locale }) {
  const status = useFormStatus();
  return (
    <button className="btn btn-primary w-full" name="intent" value="publish" disabled={status.pending}>
      {status.pending ? "…" : tx(locale, "發佈", "Publish")}
    </button>
  );
}

export function ListCreateForm({ locale, categories }: { locale: Locale; categories: Cat[] }) {
  const [state, action] = useActionState(publishCreateAction, null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [caption, setCaption] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [meetup, setMeetup] = useState(false);
  const [photoNote, setPhotoNote] = useState("");

  const { enqueue, editor } = usePhotoCropQueue({
    aspect: LISTING_CROP_ASPECT,
    locale,
    onUrl: (url) => {
      setPhotoNote("");
      setPhotos((prev) => {
        if (!url || prev.length >= PHOTO_MAX || prev.some((photo) => photo.url === url)) return prev;
        const role = prev.length === 0 ? "FRONT" : "GALLERY";
        return [...prev, { url, role }];
      });
    },
    onFail: () => setPhotoNote(tx(locale, "這張相片讀不到或太大。", "Could not read that photo.")),
  });

  function onFiles(list: FileList | null) {
    if (!list) return;
    const files = [...list].filter((file) => file.type.startsWith("image/"));
    enqueue(files, PHOTO_MAX - photos.length);
    if (files.length !== list.length) setPhotoNote(tx(locale, "這張相片讀不到或太大。", "Could not read that photo."));
  }

  return (
    <form action={action} className="grid gap-4">
      {state?.error ? <p className="rounded-2xl bg-soft px-4 py-3 text-sm text-danger">{errText(locale, state.error)}</p> : null}
      <input type="hidden" name="photos" value={JSON.stringify(photos)} />
      <input type="hidden" name="title" value={createTitle(caption)} />
      <input type="hidden" name="cards" value={ONE_CARD} />
      <input type="hidden" name="saleType" value="BUY_NOW" />
      <input type="hidden" name="intent" value="publish" />
      <input type="hidden" name="quantity" value="1" />
      <input type="hidden" name="conditionTrack" value="RAW" />
      <input type="hidden" name="rawGrade" value="A" />
      <input type="hidden" name="shippingDays" value="3" />
      <input type="hidden" name="stockType" value="IN_STOCK" />
      <input type="hidden" name="shipWithinDays" value="3" />
      <input type="hidden" name="categoryId" value={categoryId} />

      <div className="grid gap-2">
        <div className="flex gap-2 overflow-x-auto">
          {photos.map((photo, index) => (
            <button
              key={`${photo.role}-${index}`}
              type="button"
              className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-soft"
              onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
            >
              <img src={photo.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
        {photos.length < PHOTO_MAX ? (
          <label className="btn btn-ghost w-fit cursor-pointer">
            {tx(locale, "加相片", "Add photos")}
            <input
              className="sr-only"
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                onFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        ) : null}
        {photoNote ? <p className="text-sm text-danger">{photoNote}</p> : null}
      </div>

      <label className="grid gap-1 text-sm font-medium">
        {tx(locale, "價錢 HKD", "Price HKD")}
        <input className="field" name="price" inputMode="decimal" placeholder="280" required />
      </label>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">{tx(locale, "分類", "Category")}</legend>
        <div className="flex gap-2 overflow-x-auto">
          {categories.map((cat) => {
            const on = cat.id === categoryId;
            return (
              <button
                key={cat.id}
                type="button"
                aria-pressed={on}
                className={`inline-flex h-11 shrink-0 items-center rounded-full px-3 text-sm leading-none ${on ? "bg-soft font-semibold text-ink" : "font-medium text-muted"}`}
                onClick={() => setCategoryId(cat.id)}
              >
                {locale === "en" ? cat.nameEn : cat.nameZh}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="grid gap-2 text-sm">
        <legend className="font-medium">{tx(locale, "交收", "Handover")}</legend>
        <label className="flex min-h-12 items-center gap-2 rounded-2xl bg-soft px-3 font-medium">
          <input type="checkbox" name="shipSfCod" defaultChecked />
          {tx(locale, "順豐到付", "SF cash on delivery")}
        </label>
        <div className="grid gap-2 rounded-2xl bg-soft p-3">
          <label className="flex min-h-12 items-center gap-2 font-medium">
            <input type="checkbox" name="shipMeetup" checked={meetup} onChange={(event) => setMeetup(event.target.checked)} />
            {tx(locale, "面交", "Meet-up")}
          </label>
          {meetup ? (
            <label className="grid gap-1">
              {tx(locale, "面交地區", "Meet-up district")}
              <select className="field" name="meetupDistrict" defaultValue="">
                <option value="">{tx(locale, "選擇地區", "Choose a district")}</option>
                {DISTRICTS.map(([zh, en]) => (
                  <option key={zh} value={zh}>{locale === "en" ? en : zh}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </fieldset>

      <label className="grid gap-1 text-sm font-medium">
        {tx(locale, "說明", "Caption")}
        <textarea
          className="field min-h-28"
          name="description"
          maxLength={5000}
          value={caption}
          placeholder={tx(locale, "寫低狀態同交收。", "Condition and handover.")}
          onChange={(event) => setCaption(event.target.value)}
        />
      </label>

      <SubmitLabel locale={locale} />
      {editor}
    </form>
  );
}
