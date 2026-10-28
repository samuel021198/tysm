"use client";

import { useEffect, useRef, useState } from "react";
import { sendMessage } from "@/actions/social";
import { composerCanSend, composerExpanded } from "@/lib/message-composer";
import { tx, type Locale } from "@/lib/i18n";
import { Icon } from "./icons";
import { fileToDataUrl } from "./photo-file";

const MAX_H = 144;

export function MessageComposer({ locale, threadId, focus = false }: { locale: Locale; threadId: string; focus?: boolean }) {
  const [imageUrl, setImageUrl] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const [focused, setFocused] = useState(focus);
  const [tray, setTray] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const expanded = composerExpanded({ focused, tray, body, image: imageUrl });
  const canSend = composerCanSend({ body, image: imageUrl });

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 36), MAX_H)}px`;
  }, [body, expanded]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setTray(true);
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
      className={`sticky z-20 bg-card/95 px-1.5 py-1 shadow-card backdrop-blur md:static ${expanded ? "rounded-2xl" : "rounded-full"}`}
      style={{ bottom: "calc(var(--tab-h) + 0.35rem)" }}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        setFocused(false);
        if (!body.trim() && !imageUrl.trim()) setTray(false);
      }}
    >
      <input type="hidden" name="threadId" value={threadId} />
      <input type="hidden" name="imageUrl" value={imageUrl} />
      <input ref={fileRef} className="sr-only" type="file" accept="image/*" onChange={(event) => void onFile(event.target.files?.[0])} />
      {imageUrl.startsWith("data:") ? (
        <div className="relative mb-1 ml-10 w-fit">
          <img src={imageUrl} alt="" className="h-14 w-11 rounded-lg bg-soft object-contain" />
          <button
            type="button"
            className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-xs leading-none text-card"
            aria-label={tx(locale, "移除", "Remove")}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setImageUrl("")}
          >
            ×
          </button>
        </div>
      ) : null}
      <div className="flex items-end gap-0.5">
        <button
          type="button"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted"
          aria-label={tx(locale, "加入相片", "Add photo")}
          aria-expanded={expanded}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            const open = expanded;
            setTray(true);
            if (open) fileRef.current?.click();
          }}
        >
          <Icon name="camera" className="h-5 w-5" />
        </button>
        <textarea
          ref={boxRef}
          className="field max-h-36 min-h-0 flex-1 resize-none overflow-y-auto !rounded-full !py-1.5 leading-5"
          style={{ minHeight: "2.25rem" }}
          name="body"
          rows={1}
          value={body}
          placeholder={tx(locale, "訊息", "Message")}
          aria-label={tx(locale, "訊息", "Message")}
          autoFocus={focus}
          onChange={(event) => setBody(event.target.value)}
        />
        {focused || canSend ? (
          <button
            type="submit"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-white disabled:opacity-40"
            disabled={!canSend}
            aria-label={tx(locale, "送出", "Send")}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h13M13 6l6 6-6 6" />
            </svg>
          </button>
        ) : null}
      </div>
      {expanded ? (
        <div className="flex items-center gap-2 px-1.5 pb-1 pt-1">
          <button type="button" className="shrink-0 text-sm font-semibold text-link" onMouseDown={(event) => event.preventDefault()} onClick={() => fileRef.current?.click()}>
            {tx(locale, "加入相片", "Add photo")}
          </button>
          <input
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
            value={imageUrl.startsWith("data:") ? "" : imageUrl}
            placeholder={imageUrl.startsWith("data:") ? tx(locale, "已選擇相片", "Photo ready") : tx(locale, "或貼上圖片網址", "Or paste an image URL")}
            onChange={(event) => setImageUrl(event.target.value)}
            aria-label={tx(locale, "圖片網址", "Image URL")}
          />
        </div>
      ) : null}
      {note ? <p className="px-2 pb-1 text-sm text-danger">{note}</p> : null}
    </form>
  );
}
