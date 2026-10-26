"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { markStorySeen } from "@/actions/stories";
import { tx, type Locale } from "@/lib/i18n";
import type { StoryRing } from "@/lib/stories";

type Cursor = { user: number; frame: number };

function ageLabel(iso: string, locale: Locale) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return tx(locale, "剛剛", "Just now");
  if (mins < 60) return tx(locale, `${mins} 分鐘`, `${mins}m`);
  const hours = Math.max(1, Math.round(mins / 60));
  return tx(locale, `${hours} 小時`, `${hours}h`);
}

function advance(rings: StoryRing[], current: Cursor, delta: number): Cursor | null {
  const ring = rings[current.user];
  if (!ring) return null;
  const frame = current.frame + delta;
  if (frame >= 0 && frame < ring.stories.length) return { user: current.user, frame };
  const step = delta > 0 ? 1 : -1;
  let user = current.user + step;
  while (rings[user] && rings[user].stories.length === 0) user += step;
  if (!rings[user] || rings[user].stories.length === 0) return delta < 0 ? current : null;
  return { user, frame: delta > 0 ? 0 : rings[user].stories.length - 1 };
}

export function StoryRail({ locale, rings }: { locale: Locale; rings: StoryRing[] }) {
  const router = useRouter();
  const [items, setItems] = useState(rings);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [images, setImages] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<Record<string, boolean>>({});
  const itemsRef = useRef(items);
  const marked = useRef(new Set<string>());
  itemsRef.current = items;

  useEffect(() => setItems(rings), [rings]);

  useEffect(() => {
    if (!cursor) return;
    const story = itemsRef.current[cursor.user]?.stories[cursor.frame];
    if (!story || story.seen || marked.current.has(story.id)) return;
    marked.current.add(story.id);
    const userId = itemsRef.current[cursor.user]?.userId;
    void markStorySeen(story.id);
    setItems((prev) =>
      prev.map((ring) => {
        if (ring.userId !== userId) return ring;
        const stories = ring.stories.map((frame) => (frame.id === story.id ? { ...frame, seen: true } : frame));
        return { ...ring, stories, seen: stories.every((frame) => frame.seen) };
      }),
    );
  }, [cursor]);

  useEffect(() => {
    if (!cursor) return;
    const story = itemsRef.current[cursor.user]?.stories[cursor.frame];
    if (!story || story.imageUrl || images[story.id] || missing[story.id]) return;
    const id = story.id;
    const controller = new AbortController();
    void fetch(`/api/stories/${id}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { imageUrl?: string } | null) => {
        if (body?.imageUrl) setImages((prev) => (prev[id] ? prev : { ...prev, [id]: body.imageUrl as string }));
        else setMissing((prev) => ({ ...prev, [id]: true }));
      })
      .catch(() => {
        if (!controller.signal.aborted) setMissing((prev) => ({ ...prev, [id]: true }));
      });
    return () => controller.abort();
  }, [cursor, images, missing]);

  useEffect(() => {
    if (!cursor) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCursor(null);
      if (event.key === "ArrowRight") setCursor((current) => (current ? advance(itemsRef.current, current, 1) : null));
      if (event.key === "ArrowLeft") setCursor((current) => (current ? advance(itemsRef.current, current, -1) : null));
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [cursor]);

  useEffect(() => {
    if (!cursor) return;
    const story = itemsRef.current[cursor.user]?.stories[cursor.frame];
    const ready = Boolean(story && (story.imageUrl || images[story.id] || missing[story.id]));
    if (!ready) return;
    const timer = window.setTimeout(() => setCursor((current) => (current ? advance(itemsRef.current, current, 1) : null)), 5000);
    return () => window.clearTimeout(timer);
  }, [cursor, images, missing]);

  if (items.length === 0) return null;

  function openRing(index: number) {
    const ring = items[index];
    if (!ring || ring.stories.length === 0) {
      router.push(ring?.mine ? "/story/new" : "/login?next=/story/new");
      return;
    }
    const frame = ring.stories.findIndex((story) => !story.seen);
    setCursor({ user: index, frame: frame < 0 ? 0 : frame });
  }

  const ring = cursor ? items[cursor.user] : null;
  const frame = ring?.stories[cursor?.frame ?? -1];
  const frameSrc = frame?.imageUrl || (frame ? images[frame.id] : "") || "";

  return (
    <section aria-label={tx(locale, "限時動態", "Stories")}>
      <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item, index) => {
          const fresh = item.stories.length > 0 && !item.seen;
          const name = item.mine ? tx(locale, "你的", "You") : item.nickname;
          return (
            <button key={item.userId} type="button" className="flex w-[4.75rem] shrink-0 flex-col items-center gap-1" onClick={() => openRing(index)}>
              <span className={`relative grid h-[4.25rem] w-[4.25rem] place-items-center rounded-full p-[2.5px] ${fresh ? "bg-gradient-to-br from-rose via-[#e7b7cc] to-teal" : "bg-[#d5c9cf] dark:bg-white/25"}`}>
                <span className="grid h-full w-full place-items-center rounded-full bg-card p-[2px]">
                  <span className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-gradient-to-br from-rose to-teal text-sm font-bold text-[#1b1418]">
                    {item.avatarUrl ? <img src={item.avatarUrl} alt="" className="h-full w-full object-cover" /> : (item.nickname || "你").slice(0, 1)}
                  </span>
                </span>
                {item.mine && item.stories.length === 0 ? (
                  <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-rose to-teal text-base font-bold leading-none text-[#1b1418] ring-2 ring-bg">
                    +
                  </span>
                ) : null}
              </span>
              <span className="w-full truncate text-center text-[11px] font-medium">{name}</span>
            </button>
          );
        })}
      </div>
      {cursor && ring && frame ? (
        <div className="fixed inset-0 z-50 bg-[#100e10] text-white" role="dialog" aria-modal="true" aria-label={ring.nickname || tx(locale, "限時動態", "Story")}>
          {frameSrc ? (
            <img src={frameSrc} alt="" className="absolute inset-0 h-full w-full object-contain" />
          ) : (
            <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm">
              {missing[frame.id] ? tx(locale, "呢個動態已經過咗時間。", "This story has expired.") : tx(locale, "載入緊…", "Loading…")}
            </p>
          )}
          <div className="absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/55 to-transparent px-3 pt-[max(0.6rem,env(safe-area-inset-top))]">
            <div className="flex gap-1">
              {ring.stories.map((story, index) => (
                <span key={story.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/35">
                  <span
                    key={index === cursor.frame ? `${story.id}-play` : `${story.id}-rest`}
                    className={`block h-full origin-left bg-white ${index < cursor.frame ? "w-full" : index === cursor.frame ? "story-bar w-full" : "w-0"}`}
                  />
                </span>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3 pb-6">
              <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-rose to-teal text-sm font-bold text-[#1b1418]">
                {ring.avatarUrl ? <img src={ring.avatarUrl} alt="" className="h-full w-full object-cover" /> : (ring.nickname || "你").slice(0, 1)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{ring.mine ? tx(locale, "你的動態", "Your story") : ring.nickname}</span>
                <span className="block text-xs text-white/75">{ageLabel(frame.createdAt, locale)}</span>
              </span>
              <button type="button" className="ml-auto grid h-11 w-11 place-items-center rounded-full text-2xl leading-none" aria-label={tx(locale, "關閉", "Close")} onClick={() => setCursor(null)}>
                ×
              </button>
            </div>
          </div>
          <button type="button" className="absolute inset-y-0 left-0 z-10 w-1/3" aria-label={tx(locale, "上一則", "Previous")} onClick={() => setCursor((current) => (current ? advance(itemsRef.current, current, -1) : null))} />
          <button type="button" className="absolute inset-y-0 right-0 z-10 w-1/3" aria-label={tx(locale, "下一則", "Next")} onClick={() => setCursor((current) => (current ? advance(itemsRef.current, current, 1) : null))} />
        </div>
      ) : null}
    </section>
  );
}
