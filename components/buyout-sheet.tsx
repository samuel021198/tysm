"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { publishBuyout } from "@/actions/buyout";
import { BUYOUT_HANDOVER_MAX, BUYOUT_NOTE_MAX, BUYOUT_PHOTO_MAX } from "@/lib/buyout";
import { errText, tx, type Locale } from "@/lib/i18n";
import { LISTING_CROP_ASPECT } from "@/lib/photo-crop";
import { CatalogTitleField, type CatalogHit } from "./catalog-title-field";
import { usePhotoCropQueue } from "./photo-crop";

function SubmitLabel({ locale }: { locale: Locale }) {
  const status = useFormStatus();
  return (
    <button className="btn btn-primary w-full" disabled={status.pending}>
      {status.pending ? "…" : tx(locale, "發佈買取", "Post a buyout")}
    </button>
  );
}

export function BuyoutSheet({ locale, onClose }: { locale: Locale; onClose: () => void }) {
  const [state, action] = useActionState(publishBuyout, null);
  const went = useRef(false);
  const [photos, setPhotos] = useState<{ url: string }[]>([]);
  const [cardName, setCardName] = useState("");
  const [catalogId, setCatalogId] = useState("");
  const [note, setNote] = useState("");
  const [photoNote, setPhotoNote] = useState("");
  const [mounted, setMounted] = useState(false);

  const { enqueue, editor } = usePhotoCropQueue({
    aspect: LISTING_CROP_ASPECT,
    locale,
    onUrl: (url) => {
      setPhotoNote("");
      setPhotos((prev) => {
        if (!url || prev.length >= BUYOUT_PHOTO_MAX || prev.some((photo) => photo.url === url)) return prev;
        return [...prev, { url }];
      });
    },
    onFail: () => setPhotoNote(tx(locale, "這張相片讀不到或太大。", "Could not read that photo.")),
  });

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!state?.ok || went.current) return;
    went.current = true;
    onClose();
    window.location.assign("/me?tab=buyout&ok=buyout");
  }, [state, onClose]);
  if (!mounted) return null;

  const sheet = (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40" role="dialog" aria-modal="true" aria-label={tx(locale, "發佈買取", "Post a buyout")}>
      <button type="button" className="absolute inset-0 cursor-default" aria-label={tx(locale, "關閉", "Close")} onClick={onClose} />
      <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-card">
        <form action={action} className="grid gap-4">
          {state?.error ? <p className="rounded-2xl bg-soft px-4 py-3 text-sm text-danger">{errText(locale, state.error)}</p> : null}
          <input type="hidden" name="photos" value={JSON.stringify(photos)} />
          <input type="hidden" name="cardName" value={cardName} />
          <input type="hidden" name="catalogCardId" value={catalogId} />

          <div className="grid gap-2">
            <p className="text-sm font-medium">{tx(locale, "圖", "Photos")}</p>
            <div className="flex gap-2 overflow-x-auto">
              {photos.map((photo, index) => (
                <button
                  key={`${photo.url}-${index}`}
                  type="button"
                  className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-soft"
                  aria-label={tx(locale, "移除相片", "Remove photo")}
                  onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                >
                  <img src={photo.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
            {photos.length < BUYOUT_PHOTO_MAX ? (
              <label className="btn btn-ghost w-fit cursor-pointer">
                {tx(locale, "加相片", "Add photos")}
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => {
                    const list = event.target.files;
                    if (list) {
                      const files = [...list].filter((file) => file.type.startsWith("image/"));
                      enqueue(files, BUYOUT_PHOTO_MAX - photos.length);
                      if (files.length !== list.length) setPhotoNote(tx(locale, "這張相片讀不到或太大。", "Could not read that photo."));
                    }
                    event.target.value = "";
                  }}
                />
              </label>
            ) : null}
            {photoNote ? <p className="text-sm text-danger">{photoNote}</p> : null}
          </div>

          <CatalogTitleField
            locale={locale}
            named={false}
            label={tx(locale, "想收", "Card")}
            value={cardName}
            onValue={(value) => {
              setCardName(value);
              setCatalogId("");
            }}
            onPick={(hit: CatalogHit) => {
              setCardName(hit.cardName || hit.title);
              setCatalogId(hit.id);
            }}
            onFree={() => setCatalogId("")}
            pinOnPick={(hit) => hit.cardName || hit.title}
          />

          <label className="grid gap-1 text-sm font-medium">
            {tx(locale, "想入價（HK$）", "Wanted price (HK$)")}
            <input className="field" name="price" inputMode="decimal" placeholder="280" required />
          </label>

          <label className="flex min-h-12 items-center gap-2 rounded-2xl bg-soft px-3 text-sm font-medium">
            <input type="checkbox" name="negotiable" defaultChecked />
            {tx(locale, "可議價", "Negotiable")}
          </label>

          <label className="grid gap-1 text-sm font-medium">
            {tx(locale, "說明", "Note")}
            <textarea className="field min-h-28" name="note" required maxLength={BUYOUT_NOTE_MAX} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>

          <label className="grid gap-1 text-sm font-medium">
            {tx(locale, "交收", "Handover")}
            <input
              className="field"
              name="handover"
              maxLength={BUYOUT_HANDOVER_MAX}
              placeholder={tx(locale, "地區或面交，可留空", "District or meet-up, optional")}
            />
          </label>

          <SubmitLabel locale={locale} />
        </form>
        {editor}
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
