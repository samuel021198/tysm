"use client";

import { useActionState, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { publishStory } from "@/actions/stories";
import { errText, tx, type Locale } from "@/lib/i18n";
import { clampPct, clampScale, containRect, STORY_EMOJIS, TEXT_COLORS, type StoryLayer } from "@/lib/story-edit";
import { fileToDataUrl } from "./photo-file";
import { Icon } from "./icons";

const DEMOS = [
  { url: "/demo/cards/seed_charizard.svg", zh: "噴火龍", en: "Charizard" },
  { url: "/demo/cards/seed_pikachu.svg", zh: "皮卡丘", en: "Pikachu" },
];

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("read"));
    img.src = src;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const ch of text) {
    const next = line + ch;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = ch;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 8);
}

async function flattenStory(src: string, layers: StoryLayer[]) {
  const img = await loadImage(src);
  const scale = Math.min(1, 960 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  for (const layer of layers) {
    const x = (clampPct(layer.x) / 100) * canvas.width;
    const y = (clampPct(layer.y) / 100) * canvas.height;
    if (layer.kind === "text") {
      const text = layer.text.trim();
      if (!text) continue;
      const size = Math.max(22, Math.round(canvas.width * 0.055));
      ctx.font = `700 ${size}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = Math.max(3, size / 10);
      ctx.lineJoin = "round";
      ctx.strokeStyle = layer.color.toLowerCase() === "#1b1418" ? "#ffffff" : "rgba(27,20,24,0.55)";
      ctx.fillStyle = layer.color;
      const lines = wrapText(ctx, text, canvas.width * 0.8);
      const lineHeight = size * 1.2;
      const start = y - ((lines.length - 1) * lineHeight) / 2;
      lines.forEach((row, index) => {
        const ly = start + index * lineHeight;
        ctx.strokeText(row, x, ly);
        ctx.fillText(row, x, ly);
      });
    } else {
      const size = Math.max(28, Math.round(canvas.width * 0.12 * clampScale(layer.scale)));
      ctx.font = `${size}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(layer.emoji, x, y);
    }
  }
  let quality = 0.72;
  let url = canvas.toDataURL("image/jpeg", quality);
  while (url.length > 140_000 && quality > 0.42) {
    quality -= 0.08;
    url = canvas.toDataURL("image/jpeg", quality);
  }
  if (!url.startsWith("data:image/jpeg") || url.length > 180_000) throw new Error("big");
  return url;
}

export function StoryComposer({ locale }: { locale: Locale }) {
  const [state, action] = useActionState(publishStory, null);
  const [preview, setPreview] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [opening, setOpening] = useState(true);
  const [layers, setLayers] = useState<StoryLayer[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [box, setBox] = useState({ x: 0, y: 0, w: 1, h: 1 });
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ id: string; px: number; py: number; x: number; y: number } | null>(null);
  const seq = useRef(0);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLive(false);
  }

  async function startCamera() {
    stopCamera();
    setNote("");
    setOpening(true);
    const media = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
    if (!media) {
      setOpening(false);
      return;
    }
    try {
      const stream = await media({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      setLive(true);
    } catch {
      setNote(tx(locale, "鏡頭未開到。可以用系統相機或者相簿。", "The camera did not open. Use the system camera or your album."));
    } finally {
      setOpening(false);
    }
  }

  useEffect(() => {
    let cancel = false;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    void (async () => {
      const media = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
      if (!media) {
        if (!cancel) setOpening(false);
        return;
      }
      try {
        const stream = await media({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (cancel) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        setLive(true);
      } catch {
        if (!cancel) setNote(tx(locale, "鏡頭未開到。可以用系統相機或者相簿。", "The camera did not open. Use the system camera or your album."));
      } finally {
        if (!cancel) setOpening(false);
      }
    })();
    return () => {
      cancel = true;
      document.body.style.overflow = prev;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [locale]);

  useEffect(() => {
    const video = videoRef.current;
    if (!live || !video || !streamRef.current) return;
    video.srcObject = streamRef.current;
    void video.play().catch(() => undefined);
  }, [live]);

  function measure() {
    const stage = stageRef.current;
    const img = imgRef.current;
    if (!stage || !img) return;
    const rect = stage.getBoundingClientRect();
    setBox(containRect(rect.width, rect.height, img.naturalWidth || img.width, img.naturalHeight || img.height));
  }

  useEffect(() => {
    if (!preview) return;
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [preview]);

  async function useFile(file: File | undefined) {
    if (!file) return;
    try {
      setPreview(await fileToDataUrl(file));
      setLayers([]);
      setSelected(null);
      setEmojiOpen(false);
      setNote("");
      stopCamera();
    } catch {
      setNote(tx(locale, "這張相片讀不到或太大。", "Could not read that photo."));
    }
  }

  async function shutter() {
    const video = videoRef.current;
    if (!video?.videoWidth) {
      setNote(tx(locale, "鏡頭未就緒。可以改用系統相機。", "Camera is not ready. Use the system camera instead."));
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) return;
    await useFile(new File([blob], "story.jpg", { type: "image/jpeg" }));
  }

  function addText() {
    const id = `t${++seq.current}`;
    setLayers((prev) => [...prev, { id, kind: "text", text: "", x: 50, y: 42, color: TEXT_COLORS[0] }]);
    setSelected(id);
    setEmojiOpen(false);
  }

  function addSticker(emoji: string) {
    const id = `s${++seq.current}`;
    setLayers((prev) => [...prev, { id, kind: "sticker", emoji, x: 50, y: 58, scale: 1 }]);
    setSelected(id);
    setEmojiOpen(false);
  }

  function pointerDown(event: ReactPointerEvent, layer: StoryLayer) {
    event.preventDefault();
    event.stopPropagation();
    setSelected(layer.id);
    drag.current = { id: layer.id, px: event.clientX, py: event.clientY, x: layer.x, y: layer.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function removeSelected() {
    if (!selected) return;
    setLayers((prev) => prev.filter((layer) => layer.id !== selected));
    setSelected(null);
  }

  function pointerMove(event: ReactPointerEvent) {
    const current = drag.current;
    if (!current || !(box.w > 0) || !(box.h > 0)) return;
    const dx = ((event.clientX - current.px) / box.w) * 100;
    const dy = ((event.clientY - current.py) / box.h) * 100;
    setLayers((prev) =>
      prev.map((layer) => (layer.id === current.id ? { ...layer, x: clampPct(current.x + dx), y: clampPct(current.y + dy) } : layer)),
    );
  }

  async function share() {
    if (!preview || busy) return;
    setBusy(true);
    setNote("");
    try {
      const painted = layers.some((layer) => layer.kind === "sticker" || layer.text.trim());
      const url = painted ? await flattenStory(preview, layers) : preview;
      if (imageRef.current) imageRef.current.value = url;
      formRef.current?.requestSubmit();
    } catch {
      setNote(tx(locale, "這張相片讀不到或太大。", "Could not read that photo."));
      setBusy(false);
    }
  }

  const active = layers.find((layer) => layer.id === selected) ?? null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#1b1418] text-white">
      <input
        ref={cameraRef}
        className="sr-only"
        type="file"
        accept="image/*"
        capture="environment"
        aria-label={tx(locale, "系統相機", "System camera")}
        onChange={(event) => void useFile(event.target.files?.[0])}
      />
      <input
        ref={albumRef}
        className="sr-only"
        type="file"
        accept="image/*"
        aria-label={tx(locale, "相簿", "Album")}
        onChange={(event) => void useFile(event.target.files?.[0])}
      />
      <div className="flex items-center justify-between px-2 pt-[max(0.25rem,env(safe-area-inset-top))]">
        <Link href="/" className="grid h-11 w-11 place-items-center text-3xl leading-none" aria-label={tx(locale, "關閉", "Close")}>
          <span aria-hidden>×</span>
        </Link>
        <p className="text-sm font-semibold">{tx(locale, "動態", "Story")}</p>
        <span className="w-11" />
      </div>
      {state?.error ? <p className="px-4 text-sm text-[#ffb4be]">{errText(locale, state.error)}</p> : null}
      {note ? <p className="px-4 text-sm text-[#ffb4be]">{note}</p> : null}
      {preview ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            ref={stageRef}
            className="relative min-h-0 flex-1"
            onPointerMove={pointerMove}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            <img ref={imgRef} src={preview} alt="" className="absolute inset-0 h-full w-full object-contain" onLoad={measure} />
            {layers.map((layer) => (
              <button
                key={layer.id}
                type="button"
                className={`absolute touch-none px-2 py-1 ${layer.id === selected ? "rounded-xl ring-2 ring-white" : ""}`}
                style={{
                  left: box.x + (layer.x / 100) * box.w,
                  top: box.y + (layer.y / 100) * box.h,
                  transform: "translate(-50%, -50%)",
                  color: layer.kind === "text" ? layer.color : undefined,
                  fontSize: layer.kind === "sticker" ? `${Math.round(32 * layer.scale)}px` : "1.35rem",
                  fontWeight: 700,
                  textShadow: layer.kind === "text" && layer.color.toLowerCase() !== "#1b1418" ? "0 1px 2px rgba(0,0,0,0.65)" : undefined,
                }}
                onPointerDown={(event) => pointerDown(event, layer)}
              >
                {layer.kind === "text" ? layer.text || tx(locale, "文字", "Text") : layer.emoji}
              </button>
            ))}
          </div>
          {active?.kind === "text" ? (
            <div className="grid gap-2 px-3 pt-2">
              <input
                className="field text-ink"
                value={active.text}
                maxLength={80}
                autoFocus
                placeholder={tx(locale, "輸入文字", "Type")}
                aria-label={tx(locale, "文字", "Text")}
                onChange={(event) => {
                  const text = event.target.value;
                  setLayers((prev) => prev.map((layer) => (layer.id === active.id && layer.kind === "text" ? { ...layer, text } : layer)));
                }}
              />
              <div className="flex gap-2">
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-11 w-11 rounded-full border-2 ${active.color === color ? "border-white" : "border-transparent"}`}
                    style={{ background: color }}
                    aria-label={color}
                    onClick={() => setLayers((prev) => prev.map((layer) => (layer.id === active.id && layer.kind === "text" ? { ...layer, color } : layer)))}
                  />
                ))}
                <button type="button" className="min-h-11 px-3 text-sm font-semibold" onClick={removeSelected}>
                  {tx(locale, "移除", "Remove")}
                </button>
              </div>
            </div>
          ) : null}
          {active?.kind === "sticker" ? (
            <div className="flex items-center justify-center gap-3 px-3 pt-2">
              <button
                type="button"
                className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-xl"
                aria-label={tx(locale, "縮細", "Smaller")}
                onClick={() =>
                  setLayers((prev) =>
                    prev.map((layer) => (layer.id === active.id && layer.kind === "sticker" ? { ...layer, scale: clampScale(layer.scale - 0.2) } : layer)),
                  )
                }
              >
                −
              </button>
              <button
                type="button"
                className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-xl"
                aria-label={tx(locale, "放大", "Larger")}
                onClick={() =>
                  setLayers((prev) =>
                    prev.map((layer) => (layer.id === active.id && layer.kind === "sticker" ? { ...layer, scale: clampScale(layer.scale + 0.2) } : layer)),
                  )
                }
              >
                +
              </button>
              <button type="button" className="min-h-12 px-3 text-sm font-semibold" onClick={removeSelected}>
                {tx(locale, "移除", "Remove")}
              </button>
            </div>
          ) : null}
          {emojiOpen ? (
            <div className="grid grid-cols-8 gap-1 px-3 pt-2">
              {STORY_EMOJIS.map((emoji) => (
                <button key={emoji} type="button" className="grid h-11 place-items-center text-2xl" aria-label={emoji} onClick={() => addSticker(emoji)}>
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}
          <div className="grid grid-cols-4 gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            <button type="button" className="btn btn-ghost min-h-12" onClick={() => { setPreview(null); setLayers([]); void startCamera(); }}>
              {tx(locale, "重影", "Retake")}
            </button>
            <button type="button" className="btn btn-ghost min-h-12" onClick={addText}>
              {tx(locale, "文字", "Text")}
            </button>
            <button type="button" className="btn btn-ghost min-h-12" onClick={() => setEmojiOpen((open) => !open)}>
              {tx(locale, "貼圖", "Emoji")}
            </button>
            <form ref={formRef} action={action}>
              <input ref={imageRef} type="hidden" name="imageUrl" />
              <button type="button" className="btn btn-primary min-h-12 w-full" disabled={busy} onClick={() => void share()}>
                {busy ? "…" : tx(locale, "發佈", "Share")}
              </button>
            </form>
          </div>
        </div>
      ) : live ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <video ref={videoRef} className="min-h-0 w-full flex-1 bg-black object-cover" playsInline muted autoPlay />
          <div className="flex items-center justify-between gap-3 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            <button type="button" className="min-h-12 min-w-16 text-sm font-semibold" onClick={() => albumRef.current?.click()}>
              {tx(locale, "相簿", "Album")}
            </button>
            <button
              type="button"
              className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-rose to-teal shadow-[0_10px_22px_rgba(58,143,164,0.34)]"
              aria-label={tx(locale, "影低", "Shutter")}
              onClick={() => void shutter()}
            >
              <span className="h-14 w-14 rounded-full border-[3px] border-[#1b1418]/25 bg-card" />
            </button>
            <button type="button" className="min-h-12 min-w-16 text-sm font-semibold" onClick={() => cameraRef.current?.click()}>
              {tx(locale, "系統相機", "System")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
          <button type="button" className="grid gap-3" onClick={() => void startCamera()} disabled={opening}>
            <span className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-rose to-teal text-[#1b1418]">
              <Icon name="camera" className="h-10 w-10" />
            </span>
            <span className="text-lg font-semibold">{opening ? tx(locale, "開啟鏡頭…", "Opening camera…") : tx(locale, "開鏡頭", "Open camera")}</span>
          </button>
          <div className="flex w-full max-w-sm gap-2">
            <button type="button" className="btn btn-ghost min-h-12 flex-1" onClick={() => albumRef.current?.click()}>
              {tx(locale, "相簿", "Album")}
            </button>
            <button type="button" className="btn btn-ghost min-h-12 flex-1" onClick={() => cameraRef.current?.click()}>
              {tx(locale, "系統相機", "System camera")}
            </button>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {DEMOS.map((demo) => (
              <button key={demo.url} type="button" className="h-11 rounded-full bg-white/10 px-3 text-sm" onClick={() => setPreview(demo.url)}>
                {tx(locale, "示範 · ", "Demo · ")}
                {locale === "en" ? demo.en : demo.zh}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
