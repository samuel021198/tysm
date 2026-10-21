"use client";

import { useEffect, useState } from "react";
import { tx, type Locale } from "@/lib/i18n";

export function Countdown({ endsAt, locale }: { endsAt: string; locale: Locale }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (now == null) return <span>{tx(locale, "倒數中", "Counting down")}</span>;
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return <span>{tx(locale, "已結束", "Ended")}</span>;
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const clock = [hours, mins, secs].map((n) => String(n).padStart(2, "0")).join(":");
  return <span>{days > 0 ? `${days}d ${clock}` : clock}</span>;
}
