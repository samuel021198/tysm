"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { publishStory } from "@/actions/stories";
import { errText, tx, type Locale } from "@/lib/i18n";
import { fileToDataUrl } from "./photo-file";
import { Icon } from "./icons";
import { Submit } from "./submit";

const DEMOS = [
  { url: "/demo/cards/seed_charizard.svg", zh: "噴火龍", en: "Charizard" },
  { url: "/demo/cards/seed_pikachu.svg", zh: "皮卡丘", en: "Pikachu" },
];

export function StoryComposer({ locale }: { locale: Locale }) {
  const [state, action] = useActionState(publishStory, null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [live, setLive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLive(false);
  }

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  useEffect(() => {
    const video = videoRef.current;
    if (!live || !video || !streamRef.current) return;
    video.srcObject = streamRef.current;
    void video.play().catch(() => undefined);
  }, [live]);

  async function useFile(file: File | undefined) {
    if (!file) return;
    try {
      setPreview(await fileToDataUrl(file));
      setNote("");
      stopCamera();
    } catch {
      setNote(tx(locale, "這張相片讀不到或太大。", "Could not read that photo."));
    }
  }

  async function startCamera() {
    setNote("");
    const media = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
    if (!media) {
      cameraRef.current?.click();
      return;
    }
    try {
      const stream = await media({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      setLive(true);
    } catch {
      cameraRef.current?.click();
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

  return (
    <div className="grid gap-4">
      {state?.error ? <p className="rounded-2xl bg-soft px-4 py-3 text-sm text-danger">{errText(locale, state.error)}</p> : null}
      {note ? <p className="text-sm text-danger">{note}</p> : null}
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
      {preview ? (
        <form action={action} className="grid gap-3">
          <input type="hidden" name="imageUrl" value={preview} />
          <img src={preview} alt="" className="aspect-[9/16] max-h-[70vh] w-full rounded-[1.75rem] bg-[#1b1418] object-contain" />
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setPreview(null)}>
              {tx(locale, "取消", "Cancel")}
            </button>
            <Submit label={tx(locale, "發佈", "Share")} pendingLabel="…" />
          </div>
        </form>
      ) : live ? (
        <div className="grid gap-3">
          <video ref={videoRef} className="aspect-[9/16] max-h-[70vh] w-full rounded-[1.75rem] bg-[#1b1418] object-cover" playsInline muted autoPlay />
          <div className="flex items-center justify-center gap-3">
            <button type="button" className="btn btn-ghost" onClick={stopCamera}>
              {tx(locale, "取消", "Cancel")}
            </button>
            <button
              type="button"
              className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-rose to-teal shadow-[0_10px_22px_rgba(58,143,164,0.34)]"
              aria-label={tx(locale, "影低", "Shutter")}
              onClick={() => void shutter()}
            >
              <span className="h-12 w-12 rounded-full border-[3px] border-[#1b1418]/25 bg-card" />
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => cameraRef.current?.click()}>
              {tx(locale, "系統相機", "System")}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <button type="button" className="surface grid aspect-[9/16] max-h-[58vh] w-full place-items-center gap-3 px-8 text-center" onClick={() => void startCamera()}>
            <span className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-rose to-teal text-[#1b1418]">
              <Icon name="camera" className="h-9 w-9" />
            </span>
            <span className="text-lg font-semibold">{tx(locale, "影相", "Take photo")}</span>
            <span className="text-sm text-muted">{tx(locale, "開鏡頭影一張。鏡頭用唔到就會改叫系統相機。", "Opens the camera, or the system camera if that fails.")}</span>
          </button>
          <button type="button" className="btn btn-ghost w-full" onClick={() => albumRef.current?.click()}>
            {tx(locale, "從相簿揀", "Choose from album")}
          </button>
          <div className="flex flex-wrap justify-center gap-2">
            {DEMOS.map((demo) => (
              <button key={demo.url} type="button" className="h-11 rounded-full bg-soft px-3 text-sm" onClick={() => setPreview(demo.url)}>
                {tx(locale, "示範 · ", "Demo · ")}
                {locale === "en" ? demo.en : demo.zh}
              </button>
            ))}
          </div>
        </div>
      )}
      <Link href="/" className="text-center text-sm text-link">
        {tx(locale, "返回主頁", "Back home")}
      </Link>
    </div>
  );
}
