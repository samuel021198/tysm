"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { cropOutputSize, cropView, quarterTurns } from "@/lib/photo-crop";
import { tx, type Locale } from "@/lib/i18n";
import { compressCanvas } from "./photo-file";

type Job = { id: number; file: File };

export function usePhotoCropQueue({
  aspect,
  locale,
  onUrl,
  onFail,
}: {
  aspect: number;
  locale: Locale;
  onUrl: (url: string) => void;
  onFail: () => void;
}) {
  const [queue, setQueue] = useState<Job[]>([]);
  const seq = useRef(0);
  const onUrlRef = useRef(onUrl);
  const onFailRef = useRef(onFail);
  onUrlRef.current = onUrl;
  onFailRef.current = onFail;

  const enqueue = useCallback((files: File[], room: number) => {
    const images = files.filter((file) => file.type.startsWith("image/"));
    if (!images.length || room <= 0) return;
    setQueue((current) => {
      const space = Math.max(0, room - current.length);
      if (!space) return current;
      const jobs = images.slice(0, space).map((file) => ({ id: ++seq.current, file }));
      return [...current, ...jobs];
    });
  }, []);

  const shift = useCallback(() => setQueue((current) => current.slice(1)), []);
  const accept = useCallback(
    (url: string) => {
      onUrlRef.current(url);
      shift();
    },
    [shift],
  );
  const fail = useCallback(() => {
    onFailRef.current();
    shift();
  }, [shift]);

  const job = queue[0] ?? null;
  const editor = job ? (
    <PhotoCropper key={job.id} file={job.file} aspect={aspect} locale={locale} onConfirm={accept} onCancel={shift} onError={fail} />
  ) : null;

  return { enqueue, editor };
}

function PhotoCropper({
  file,
  aspect,
  locale,
  onConfirm,
  onCancel,
  onError,
}: {
  file: File;
  aspect: number;
  locale: Locale;
  onConfirm: (url: string) => void;
  onCancel: () => void;
  onError: () => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [turns, setTurns] = useState(0);
  const [busy, setBusy] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ panX: number; panY: number; zoom: number; dist: number; originX: number; originY: number } | null>(null);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const turnsRef = useRef(turns);
  const onErrorRef = useRef(onError);
  const onCancelRef = useRef(onCancel);
  panRef.current = pan;
  zoomRef.current = zoom;
  turnsRef.current = turns;
  onErrorRef.current = onError;
  onCancelRef.current = onCancel;

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    let gone = false;
    image.onload = () => {
      if (!gone && image.width > 0 && image.height > 0) setImg(image);
      else if (!gone) onErrorRef.current();
    };
    image.onerror = () => {
      if (!gone) onErrorRef.current();
    };
    image.src = url;
    return () => {
      gone = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCancelRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setFrame((prev) => (prev.w === rect.width && prev.h === rect.height ? prev : { w: rect.width, h: rect.height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [img]);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (!img || frame.w <= 0) return;
      const requested = zoomRef.current * (event.deltaY < 0 ? 1.08 : 1 / 1.08);
      const view = cropView({
        srcWidth: img.width,
        srcHeight: img.height,
        turns: turnsRef.current,
        frameWidth: frame.w,
        frameHeight: frame.h,
        zoom: requested,
        panX: panRef.current.x,
        panY: panRef.current.y,
      });
      zoomRef.current = Math.min(4, Math.max(1, requested));
      panRef.current = { x: view.panX, y: view.panY };
      setZoom(zoomRef.current);
      setPan(panRef.current);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [img, frame.w, frame.h]);

  function liveView(nextZoom = zoom, nextPan = pan) {
    if (!img || frame.w <= 0 || frame.h <= 0) return null;
    return cropView({
      srcWidth: img.width,
      srcHeight: img.height,
      turns,
      frameWidth: frame.w,
      frameHeight: frame.h,
      zoom: nextZoom,
      panX: nextPan.x,
      panY: nextPan.y,
    });
  }

  function rebase() {
    const pts = [...pointers.current.values()];
    const origin = pts[0] || { x: 0, y: 0 };
    const dist = pts.length >= 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 1;
    gesture.current = {
      panX: panRef.current.x,
      panY: panRef.current.y,
      zoom: zoomRef.current,
      dist: dist || 1,
      originX: pts.length >= 2 ? (pts[0].x + pts[1].x) / 2 : origin.x,
      originY: pts.length >= 2 ? (pts[0].y + pts[1].y) / 2 : origin.y,
    };
  }

  function movePointers() {
    const g = gesture.current;
    if (!g || !img || frame.w <= 0 || frame.h <= 0) return;
    const pts = [...pointers.current.values()];
    if (!pts.length) return;
    const pinch = pts.length >= 2;
    const dist = pinch ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : g.dist;
    const originX = pinch ? (pts[0].x + pts[1].x) / 2 : pts[0].x;
    const originY = pinch ? (pts[0].y + pts[1].y) / 2 : pts[0].y;
    const nextZoom = pinch ? g.zoom * (dist / g.dist) : g.zoom;
    const view = cropView({
      srcWidth: img.width,
      srcHeight: img.height,
      turns: turnsRef.current,
      frameWidth: frame.w,
      frameHeight: frame.h,
      zoom: nextZoom,
      panX: g.panX + (originX - g.originX),
      panY: g.panY + (originY - g.originY),
    });
    zoomRef.current = Math.min(4, Math.max(1, nextZoom));
    panRef.current = { x: view.panX, y: view.panY };
    setZoom(zoomRef.current);
    setPan(panRef.current);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    rebase();
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    movePointers();
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) gesture.current = null;
    else rebase();
  }

  function rotate() {
    const next = quarterTurns(turnsRef.current + 1);
    turnsRef.current = next;
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    gesture.current = null;
    setTurns(next);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function confirm() {
    const view = liveView();
    if (!img || !view || busy) return;
    setBusy(true);
    try {
      const { width, height } = cropOutputSize(aspect);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      const s = width / frame.w;
      ctx.translate(width / 2 + view.panX * s, height / 2 + view.panY * s);
      ctx.rotate((view.turns * Math.PI) / 2);
      ctx.scale(view.scale * s, view.scale * s);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      onConfirm(compressCanvas(canvas));
    } catch {
      onError();
    } finally {
      setBusy(false);
    }
  }

  const view = liveView();
  const frameWidth = `min(100%, calc(70vh * ${aspect}), 24rem)`;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={tx(locale, "裁相", "Crop")} className="fixed inset-0 z-50 flex flex-col bg-[#0F172A] text-white">
      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        <div
          ref={frameRef}
          className="relative touch-none overflow-hidden bg-black ring-2 ring-white"
          style={{ aspectRatio: aspect, width: frameWidth }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {img && view ? (
            <img
              src={img.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 select-none"
              style={{
                width: img.width * view.scale,
                height: img.height * view.scale,
                maxWidth: "none",
                transform: `translate(-50%, -50%) translate(${view.panX}px, ${view.panY}px) rotate(${view.turns * 90}deg)`,
              }}
            />
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <button type="button" className="h-12 text-base font-semibold" onClick={onCancel}>
          {tx(locale, "取消", "Cancel")}
        </button>
        <button type="button" className="h-12 text-base font-semibold" onClick={rotate}>
          {tx(locale, "旋轉", "Rotate")}
        </button>
        <button type="button" className="h-12 rounded-full bg-white text-base font-semibold text-[#0F172A] disabled:opacity-60" disabled={busy || !view} onClick={confirm}>
          {tx(locale, "確認", "Confirm")}
        </button>
      </div>
    </div>,
    document.body,
  );
}
