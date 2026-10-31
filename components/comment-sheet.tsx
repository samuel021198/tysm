"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { COMMENT_REACTS, cleanComment, cleanCommentImage, replyDraft, type GifPick } from "@/lib/comments";
import { SWIPE_DOWN } from "@/lib/gesture";
import { errText, tx, type Locale } from "@/lib/i18n";
import { fileToDataUrl } from "./photo-file";

type Person = { id: string; nickname: string; avatarUrl: string | null };
type Comment = { id: string; body: string; imageUrl: string | null; createdAt: string; author: Person };

function shownGifs(value: unknown): GifPick[] {
  if (!Array.isArray(value)) return [];
  const out: GifPick[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const item = row as { id?: unknown; previewUrl?: unknown; url?: unknown };
    const url = cleanCommentImage(item.url);
    const previewUrl = cleanCommentImage(item.previewUrl);
    const id = String(item.id ?? "").trim();
    if (!url || !previewUrl || !id) continue;
    out.push({ id, previewUrl, url });
  }
  return out;
}

export function CommentSheet({
  postId,
  locale,
  onClose,
  onPosted,
}: {
  postId: string;
  locale: Locale;
  onClose: () => void;
  onPosted: () => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [viewer, setViewer] = useState<Person | null>(null);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<string | null>(null);
  const [gifOpen, setGifOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [gifs, setGifs] = useState<GifPick[]>([]);
  const [gifConfigured, setGifConfigured] = useState(true);
  const [gifSettled, setGifSettled] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [keyboard, setKeyboard] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const drag = useRef<{ y: number; id: number } | null>(null);
  const pull = useRef<number | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const title = tx(locale, "回應", "Replies");
  const pasted = cleanCommentImage(gifQuery);

  useEffect(() => {
    const y = window.scrollY;
    const body = document.body;
    const prev = { position: body.style.position, top: body.style.top, width: body.style.width };
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.width = "100%";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      window.scrollTo(0, y);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function lift() {
      if (!vv) return;
      setKeyboard(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    }
    lift();
    vv.addEventListener("resize", lift);
    vv.addEventListener("scroll", lift);
    return () => {
      vv.removeEventListener("resize", lift);
      vv.removeEventListener("scroll", lift);
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(`/api/posts/${postId}/comments`);
        const data = (await res.json().catch(() => null)) as { comments?: Comment[]; viewer?: Person | null } | null;
        if (cancel) return;
        if (!res.ok || !data?.comments) {
          setError(tx(locale, "暫時載入唔到", "Could not load comments"));
          return;
        }
        setComments(data.comments);
        setViewer(data.viewer ?? null);
      } catch {
        if (!cancel) setError(tx(locale, "暫時載入唔到", "Could not load comments"));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [postId, locale]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments.length, loading]);

  useEffect(() => {
    if (!gifOpen || (pasted && pasted.startsWith("https://"))) return;
    let cancel = false;
    const ac = new AbortController();
    const query = gifQuery;
    const handle = setTimeout(() => {
      const params = new URLSearchParams({ q: query, locale });
      fetch(`/api/gifs?${params}`, { signal: ac.signal })
        .then((res) => res.json())
        .then((data: { gifs?: unknown; configured?: boolean } | null) => {
          if (cancel) return;
          setGifConfigured(data?.configured !== false);
          setGifs(shownGifs(data?.gifs));
          setGifSettled(query);
        })
        .catch((err: unknown) => {
          if (cancel || (err instanceof DOMException && err.name === "AbortError")) return;
          setGifs([]);
          setGifSettled(query);
        });
    }, query ? 250 : 0);
    return () => {
      cancel = true;
      ac.abort();
      clearTimeout(handle);
    };
  }, [gifOpen, gifQuery, locale, pasted]);

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    try {
      setAttachment(await fileToDataUrl(file));
      setGifOpen(false);
      setError("");
    } catch {
      setError(tx(locale, "相片無法讀取，請改用 JPG、PNG 或 WebP。", "That photo could not be read. Use JPG, PNG, or WebP."));
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function useGif(url: string) {
    setAttachment(url);
    setGifOpen(false);
    setGifQuery("");
    setError("");
  }

  async function send(raw: string, fromDraft = false) {
    const text = cleanComment(raw);
    const image = fromDraft ? attachment : null;
    if ((!text && !image) || busy.current || !viewer) return;
    busy.current = true;
    setError("");
    const tempId = `tmp-${Date.now()}`;
    const optimistic: Comment = {
      id: tempId,
      body: text ?? "",
      imageUrl: image,
      createdAt: new Date().toISOString(),
      author: viewer,
    };
    setComments((list) => [...list, optimistic]);
    if (fromDraft) {
      setDraft("");
      setAttachment(null);
      setGifOpen(false);
      setGifQuery("");
    }
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text ?? "", imageUrl: image ?? "" }),
      });
      const data = (await res.json().catch(() => null)) as { comment?: Comment; error?: string } | null;
      const created = data?.comment;
      if (!res.ok || !created) {
        setComments((list) => list.filter((item) => item.id !== tempId));
        if (fromDraft) {
          setDraft(text ?? "");
          setAttachment(image);
        }
        const code = data?.error === "comment" || data?.error === "photo_url" ? data.error : "";
        setError(code ? errText(locale, code) : tx(locale, "送出失敗", "Could not send"));
        return;
      }
      setComments((list) => list.map((item) => (item.id === tempId ? created : item)));
      onPosted();
    } catch {
      setComments((list) => list.filter((item) => item.id !== tempId));
      if (fromDraft) {
        setDraft(text ?? "");
        setAttachment(image);
      }
      setError(tx(locale, "送出失敗", "Could not send"));
    } finally {
      busy.current = false;
    }
  }

  function onHeaderDown(event: React.PointerEvent) {
    if (event.button !== 0) return;
    drag.current = { y: event.clientY, id: event.pointerId };
  }

  function onHeaderMove(event: React.PointerEvent) {
    const origin = drag.current;
    if (!origin || event.pointerId !== origin.id) return;
    setOffset(Math.max(0, event.clientY - origin.y));
  }

  function onHeaderUp(event: React.PointerEvent) {
    const origin = drag.current;
    if (!origin || event.pointerId !== origin.id) return;
    drag.current = null;
    const dy = event.clientY - origin.y;
    if (dy > SWIPE_DOWN) onClose();
    else setOffset(0);
  }

  const next = `${window.location.pathname}${window.location.search}`;
  const sheet = (
    <div className="fixed inset-0 z-[70] flex items-end justify-center">
      <button type="button" className="absolute inset-0 bg-[#0F172A]/40" aria-label={tx(locale, "關閉", "Close")} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[min(78dvh,40rem)] w-full max-w-lg flex-col rounded-t-2xl bg-card text-ink shadow-card"
        style={{ transform: `translate3d(0, ${offset - keyboard}px, 0)`, maxHeight: keyboard ? `calc(100dvh - ${keyboard}px - 0.5rem)` : undefined }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="grid justify-items-center gap-2 px-3 pb-2 pt-2"
          onPointerDown={onHeaderDown}
          onPointerMove={onHeaderMove}
          onPointerUp={onHeaderUp}
          onPointerCancel={() => {
            drag.current = null;
            setOffset(0);
          }}
        >
          <span className="h-1 w-10 rounded-full bg-ink/20" />
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        <div
          ref={listRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2"
          onPointerDown={(event) => {
            pull.current = listRef.current && listRef.current.scrollTop <= 0 ? event.clientY : null;
          }}
          onPointerMove={(event) => {
            if (pull.current == null || !listRef.current) return;
            if (listRef.current.scrollTop > 0) {
              pull.current = null;
              setOffset(0);
              return;
            }
            const dy = event.clientY - pull.current;
            if (dy > 0) setOffset(dy);
          }}
          onPointerUp={(event) => {
            if (pull.current == null) return;
            const dy = event.clientY - pull.current;
            pull.current = null;
            if (dy > SWIPE_DOWN) onClose();
            else setOffset(0);
          }}
          onPointerCancel={() => {
            pull.current = null;
            setOffset(0);
          }}
        >
          {loading ? <p className="py-6 text-center text-sm text-muted">{tx(locale, "載入中", "Loading")}</p> : null}
          {!loading && comments.length === 0 ? <p className="py-6 text-center text-sm text-muted">{tx(locale, "未有留言。", "No comments yet.")}</p> : null}
          <ul className="grid gap-3">
            {comments.map((comment) => (
              <li key={comment.id} className="flex gap-2 text-sm">
                <Link href={`/u/${comment.author.id}`} className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-xs font-bold text-white">
                  {comment.author.avatarUrl ? <img src={comment.author.avatarUrl} alt="" className="h-full w-full object-cover" /> : comment.author.nickname.slice(0, 1)}
                </Link>
                <div className="min-w-0 flex-1">
                  <p>
                    <Link href={`/u/${comment.author.id}`} className="font-semibold">{comment.author.nickname}</Link>
                    {comment.body ? <> {comment.body}</> : null}
                  </p>
                  {comment.imageUrl ? <img src={comment.imageUrl} alt="" className="mt-1 max-h-40 max-w-[12rem] rounded-lg bg-soft object-contain" /> : null}
                  {viewer ? (
                    <button
                      type="button"
                      className="mt-1 text-xs font-semibold text-muted"
                      onClick={() => {
                        setDraft((current) => replyDraft(comment.author.nickname, current));
                        inputRef.current?.focus();
                      }}
                    >
                      {tx(locale, "回覆", "Reply")}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
        {error ? <p className="px-3 pb-1 text-xs text-danger">{error}</p> : null}
        {!loading && viewer ? (
          <>
            {attachment ? (
              <div className="px-3">
                <div className="relative w-fit">
                  <img src={attachment} alt="" className="h-16 max-w-[7.5rem] rounded-lg bg-soft object-contain" />
                  <button
                    type="button"
                    className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-xs leading-none text-card"
                    aria-label={tx(locale, "移除", "Remove")}
                    onClick={() => setAttachment(null)}
                  >
                    ×
                  </button>
                </div>
              </div>
            ) : null}
            <div className="flex justify-between px-2">
              {COMMENT_REACTS.map((emoji) => (
                <button key={emoji} type="button" className="grid h-9 w-9 place-items-center text-lg" aria-label={emoji} onClick={() => void send(emoji)}>
                  {emoji}
                </button>
              ))}
            </div>
            {gifOpen ? (
              <div className="grid gap-1 border-t border-line px-3 py-2">
                <input
                  value={gifQuery}
                  onChange={(event) => setGifQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    if (pasted?.startsWith("https://")) useGif(pasted);
                  }}
                  placeholder={tx(locale, "搜尋 GIF 或貼上連結", "Search GIFs or paste a link")}
                  aria-label={tx(locale, "搜尋 GIF 或貼上連結", "Search GIFs or paste a link")}
                  className="min-h-9 bg-transparent text-sm outline-none placeholder:text-muted"
                />
                {pasted?.startsWith("https://") ? (
                  <button type="button" className="w-fit" onClick={() => useGif(pasted)} aria-label="GIF">
                    <img src={pasted} alt="" className="h-16 max-w-[7.5rem] rounded-lg bg-soft object-contain" />
                  </button>
                ) : (
                  <div className="grid max-h-36 grid-cols-4 gap-1 overflow-y-auto">
                    {gifs.map((gif) => (
                      <button key={gif.id} type="button" className="overflow-hidden rounded-md bg-soft" onClick={() => useGif(gif.url)} aria-label="GIF">
                        <img src={gif.previewUrl} alt="" className="h-16 w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
                {!gifConfigured && !pasted ? <p className="text-xs text-muted">{tx(locale, "可以貼上 GIF 連結", "Paste a GIF link")}</p> : null}
                {gifConfigured && gifQuery && gifSettled === gifQuery && !pasted && gifs.length === 0 ? <p className="text-xs text-muted">{tx(locale, "沒有 GIF", "No GIFs")}</p> : null}
              </div>
            ) : null}
            <form
              className="flex items-center gap-1 border-t border-line px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
              onSubmit={(event) => {
                event.preventDefault();
                void send(draft, true);
              }}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-soft text-xs font-bold">
                {viewer.avatarUrl ? <img src={viewer.avatarUrl} alt="" className="h-full w-full object-cover" /> : viewer.nickname.slice(0, 1)}
              </span>
              <input
                ref={inputRef}
                value={draft}
                maxLength={300}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={tx(locale, "加入對話……", "Join the conversation…")}
                className="min-h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
                aria-label={tx(locale, "加入對話……", "Join the conversation…")}
              />
              <button type="button" className="grid h-9 w-9 shrink-0 place-items-center" aria-label={tx(locale, "相片", "Photo")} onClick={() => fileRef.current?.click()}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3.5" y="5" width="17" height="14" rx="2" />
                  <circle cx="9" cy="10" r="1.4" />
                  <path d="M20.5 15.5 15 11l-8.5 8" />
                </svg>
              </button>
              <input ref={fileRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void onPhoto(event.target.files?.[0])} />
              <button type="button" className="grid h-9 w-9 shrink-0 place-items-center" aria-label="GIF" aria-pressed={gifOpen} onClick={() => setGifOpen((open) => !open)}>
                <span className="rounded-[4px] border-[1.5px] border-current px-[3px] py-px text-[9px] font-bold leading-none tracking-wide">GIF</span>
              </button>
              <button type="submit" className="grid h-9 w-9 shrink-0 place-items-center text-link disabled:text-muted" disabled={!cleanComment(draft) && !attachment} aria-label={tx(locale, "送出", "Send")}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h13M13 6l6 6-6 6" />
                </svg>
              </button>
            </form>
          </>
        ) : null}
        {!loading && !viewer ? (
          <p className="border-t border-line px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-sm">
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-link">{tx(locale, "登入之後先可以留言", "Log in to comment")}</Link>
          </p>
        ) : null}
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
