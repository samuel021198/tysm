"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { errText, tx, type Locale } from "@/lib/i18n";
import { RATING_COMMENT_MAX } from "@/lib/ratings";

export function DealRatingForm({ locale, orderId }: { locale: Locale; orderId: string }) {
  const router = useRouter();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stars < 1 || pending) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/orders/${orderId}/rating`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stars, comment }),
    });
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      if (body?.error === "once") {
        router.refresh();
        return;
      }
      setPending(false);
      setError(errText(locale, body?.error || "stars"));
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-2">
      <div className="flex justify-center gap-1" role="radiogroup" aria-label={tx(locale, "評分", "Rating")}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={stars === n}
            aria-label={tx(locale, `${n} 星`, `${n} stars`)}
            className={`h-8 w-8 text-lg leading-none ${stars >= n ? "text-ink" : "text-muted"}`}
            onClick={() => setStars(n)}
          >
            ★
          </button>
        ))}
      </div>
      <input
        className="field"
        name="comment"
        value={comment}
        maxLength={RATING_COMMENT_MAX}
        placeholder={tx(locale, "一句（可留空）", "One line (optional)")}
        onChange={(event) => setComment(event.target.value)}
      />
      {error ? <p className="text-center text-xs text-danger">{error}</p> : null}
      <button className="btn btn-primary w-full" disabled={pending || stars < 1}>
        {tx(locale, "送出評分", "Send rating")}
      </button>
    </form>
  );
}
