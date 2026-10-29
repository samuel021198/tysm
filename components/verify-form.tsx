"use client";

import { useRef, useState } from "react";
import { applyVerification } from "@/actions/verification";
import { tx, type Locale } from "@/lib/i18n";
import { VERIFY_REASON_MAX } from "@/lib/verification";
import { fileToDataUrl } from "./photo-file";

export function VerifyForm({ locale }: { locale: Locale }) {
  const [documentUrl, setDocumentUrl] = useState("");
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      setDocumentUrl(await fileToDataUrl(file));
      setNote("");
    } catch {
      setDocumentUrl("");
      setNote(tx(locale, "文件讀唔到，請改用 JPG 或 PNG。", "That file could not be read. Use JPG or PNG."));
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <form action={applyVerification} className="surface grid gap-3 p-3 text-sm">
      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">{tx(locale, "邊種認證", "Which badge")}</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="track" value="TRUSTED" required />
          {tx(locale, "誠信（香港身份證）", "Trusted (Hong Kong ID)")}
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="track" value="MERCHANT" />
          {tx(locale, "商戶（商業登記）", "Merchant (business registration)")}
        </label>
      </fieldset>
      <input type="hidden" name="documentUrl" value={documentUrl} />
      <label className={`btn w-full cursor-pointer ${documentUrl ? "btn-ghost" : "btn-primary"}`}>
        {documentUrl ? tx(locale, "更換文件", "Change document") : tx(locale, "上傳文件", "Upload document")}
        <input
          ref={fileRef}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required={!documentUrl}
          onChange={(event) => void onFile(event.target.files?.[0])}
        />
      </label>
      {documentUrl ? <img src={documentUrl} alt="" className="h-24 w-20 rounded-xl bg-soft object-contain" /> : null}
      <label className="grid gap-1 text-xs">
        {tx(locale, "原因", "Reason")}
        <textarea className="field" name="reason" required maxLength={VERIFY_REASON_MAX} rows={3} placeholder={tx(locale, "簡短原因", "Short reason")} />
      </label>
      {note ? <p className="text-sm text-danger">{note}</p> : null}
      {documentUrl ? <button className="btn btn-primary w-fit">{tx(locale, "提交申請", "Submit")}</button> : null}
      <p className="text-xs text-muted">{tx(locale, "文件只供審核，唔會出喺公開頁。", "The document is for review only. It is not on your public page.")}</p>
    </form>
  );
}
