"use client";

import { useRef, useState } from "react";
import { sendMessage } from "@/actions/social";
import { tx, type Locale } from "@/lib/i18n";
import { fileToDataUrl } from "./photo-file";

export function MessageComposer({ locale, threadId }: { locale: Locale; threadId: string }) {
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
    <form
      action={sendMessage}
      className="sticky z-20 grid gap-2 rounded-[1.25rem] bg-card/95 p-3 shadow-card backdrop-blur md:static"
      style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
    >
      <input type="hidden" name="threadId" value={threadId} />
      <input type="hidden" name="imageUrl" value={imageUrl} />
      <textarea className="field min-h-12" name="body" placeholder={tx(locale, "訊息", "Message")} rows={2} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="btn btn-ghost cursor-pointer">
          {tx(locale, "加入相片", "Add photo")}
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept="image/*"
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
        </label>
        <input
          className="field min-w-0 flex-1"
          value={imageUrl.startsWith("data:") ? "" : imageUrl}
          placeholder={imageUrl.startsWith("data:") ? tx(locale, "已選擇相片", "Photo ready") : tx(locale, "或貼上圖片網址", "Or paste an image URL")}
          onChange={(event) => setImageUrl(event.target.value)}
          aria-label={tx(locale, "圖片網址", "Image URL")}
        />
      </div>
      {imageUrl.startsWith("data:") ? (
        <img src={imageUrl} alt="" className="h-24 w-20 rounded-xl bg-soft object-contain" />
      ) : null}
      {note ? <p className="text-sm text-danger">{note}</p> : null}
      <button className="btn btn-primary w-full">{tx(locale, "送出", "Send")}</button>
    </form>
  );
}
