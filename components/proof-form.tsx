"use client";

import { useRef, useState } from "react";
import { proofAction } from "@/actions/trade";
import { tx, type Locale } from "@/lib/i18n";
import { fileToDataUrl } from "./photo-file";

export function ProofForm({ locale, orderId, next }: { locale: Locale; orderId: string; next: string }) {
  const [imageUrl, setImageUrl] = useState("");
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      setImageUrl(await fileToDataUrl(file));
      setNote("");
    } catch {
      setNote(tx(locale, "相片讀唔到，請改用 JPG 或 PNG。", "That photo could not be read. Use JPG or PNG."));
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <form action={proofAction} className="grid gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="imageUrl" value={imageUrl} />
      <label className={`btn w-full cursor-pointer ${imageUrl ? "btn-ghost" : "btn-primary"}`}>
        {imageUrl ? tx(locale, "更換證明圖", "Change proof") : tx(locale, "上傳付款證明", "Upload payment proof")}
        <input ref={fileRef} className="sr-only" type="file" accept="image/*" required={!imageUrl} onChange={(event) => void onFile(event.target.files?.[0])} />
      </label>
      {imageUrl ? <img src={imageUrl} alt="" className="h-24 w-20 rounded-xl bg-soft object-contain" /> : null}
      {note ? <p className="text-sm text-danger">{note}</p> : null}
      {imageUrl ? (
        <button className="btn btn-primary w-full">{tx(locale, "上傳付款證明", "Upload payment proof")}</button>
      ) : null}
    </form>
  );
}
