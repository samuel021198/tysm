"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tx, type Locale } from "@/lib/i18n";

function keyBytes(key: string) {
  const pad = "=".repeat((4 - (key.length % 4)) % 4);
  const raw = atob(`${key}${pad}`.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushToggle({ locale, vapidPublic, on }: { locale: Locale; vapidPublic: string; on: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!vapidPublic) return null;

  async function enable() {
    setBusy(true);
    setErr("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setErr(tx(locale, "呢個瀏覽器未支援推送。", "This browser cannot do push."));
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setErr(tx(locale, "未允許通知。", "Notifications stay off."));
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidPublic) });
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub),
      });
      if (!res.ok) {
        setErr(tx(locale, "未能開啟。", "Could not turn on."));
        return;
      }
      router.refresh();
    } catch {
      setErr(tx(locale, "未能開啟。", "Could not turn on."));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setErr("");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      await fetch("/api/push", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub ? { endpoint: sub.endpoint } : {}),
      });
      await sub?.unsubscribe();
      router.refresh();
    } catch {
      setErr(tx(locale, "未能關閉。", "Could not turn off."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-1">
      <button type="button" className="w-fit text-xs font-semibold text-link disabled:opacity-50" disabled={busy} onClick={on ? disable : enable}>
        {on ? tx(locale, "關閉瀏覽器通知", "Turn off browser alerts") : tx(locale, "開啟瀏覽器通知", "Turn on browser alerts")}
      </button>
      {err ? <p className="text-xs text-danger">{err}</p> : null}
    </div>
  );
}
