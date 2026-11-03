"use client";

import { useRef, useState } from "react";
import { reportIssueAction } from "@/actions/trade";
import { tx, type Locale } from "@/lib/i18n";
import {
  DISPUTE_CHIPS,
  DISPUTE_HELPER,
  DISPUTE_IMAGE_MAX,
  DISPUTE_OTHER,
  DISPUTE_TEXT_MAX,
  disputeReport,
} from "@/lib/order-desk";
import { fileToDataUrl } from "./photo-file";

export function OrderIssueSheet({ locale, orderId, blocked }: { locale: Locale; orderId: string; blocked: boolean }) {
  const [open, setOpen] = useState(false);
  const [chip, setChip] = useState("");
  const [reason, setReason] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const pending = tx(locale, "爭議處理中", "Dispute in review");
  const label = tx(locale, "有問題", "Report a problem");

  if (blocked) {
    return (
      <button type="button" className="btn btn-primary w-full opacity-40" disabled>
        {pending}
      </button>
    );
  }

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const room = DISPUTE_IMAGE_MAX - images.length;
    const next: string[] = [];
    for (const file of [...list].slice(0, room)) {
      try {
        next.push(await fileToDataUrl(file));
      } catch {
        setError(tx(locale, "相片未能加入，請用較小的 JPEG", "That photo could not be added"));
      }
    }
    if (next.length) setImages((current) => [...current, ...next].slice(0, DISPUTE_IMAGE_MAX));
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <>
      <button type="button" className="btn btn-primary w-full" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40" role="dialog" aria-modal="true" aria-label={label}>
          <button type="button" className="absolute inset-0 cursor-default" aria-label={tx(locale, "關閉", "Close")} onClick={() => setOpen(false)} />
          <form
            action={reportIssueAction}
            className="relative z-10 grid max-h-[85vh] w-full max-w-lg gap-3 overflow-y-auto rounded-t-3xl bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-card"
            onSubmit={(event) => {
              const parsed = disputeReport(chip, reason);
              if (!parsed.ok) {
                event.preventDefault();
                setError(
                  chip === DISPUTE_OTHER
                    ? tx(locale, "請寫低清楚的說明", "Write a clear explanation")
                    : tx(locale, "請選擇原因，並寫低說明", "Pick a reason and add a note"),
                );
              }
            }}
          >
            <input type="hidden" name="orderId" value={orderId} />
            {images.map((url, index) => (
              <input key={index} type="hidden" name="image" value={url} />
            ))}
            <h2 className="text-base font-semibold">{label}</h2>
            <fieldset>
              <legend className="text-xs font-semibold">{tx(locale, "原因", "Reason")}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {DISPUTE_CHIPS.map((item) => (
                  <label
                    key={item}
                    className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${chip === item ? "border-ink bg-ink text-white" : "border-line bg-card"}`}
                  >
                    <input
                      type="radio"
                      name="chip"
                      value={item}
                      className="sr-only"
                      required
                      checked={chip === item}
                      onChange={() => {
                        setChip(item);
                        setError("");
                      }}
                    />
                    {item}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="grid gap-1 text-xs font-semibold">
              {tx(locale, "說明", "Note")}
              <textarea
                className="field"
                name="reason"
                required
                maxLength={DISPUTE_TEXT_MAX}
                rows={3}
                value={reason}
                placeholder={tx(locale, "請簡單說明", "A short note")}
                onChange={(event) => {
                  setReason(event.target.value);
                  setError("");
                }}
              />
            </label>
            <p className="text-xs text-muted">{DISPUTE_HELPER}</p>
            <div className="flex flex-wrap items-center gap-2">
              {images.map((url, index) => (
                <span key={index} className="relative">
                  <img src={url} alt="" className="h-16 w-12 rounded-md bg-soft object-cover" />
                  <button
                    type="button"
                    className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-card text-xs shadow-card"
                    aria-label={tx(locale, "移除", "Remove")}
                    onClick={() => setImages((current) => current.filter((_, i) => i !== index))}
                  >
                    ×
                  </button>
                </span>
              ))}
              {images.length < DISPUTE_IMAGE_MAX ? (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="sr-only"
                    onChange={(event) => void addFiles(event.target.files)}
                  />
                  <button type="button" className="btn btn-ghost h-11 px-3 text-sm" onClick={() => fileRef.current?.click()}>
                    {tx(locale, "加入相片", "Add photos")}
                  </button>
                </>
              ) : null}
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <button className="btn btn-primary w-full">{tx(locale, "提交", "Submit")}</button>
          </form>
        </div>
      ) : null}
    </>
  );
}
