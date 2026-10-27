import type { ReactNode } from "react";
import { tx, type Locale } from "@/lib/i18n";

export function ProfileHeader({
  locale,
  nickname,
  avatarUrl,
  bio,
  reviews,
  followers,
  completed,
  children,
}: {
  locale: Locale;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  reviews: { stars: number }[];
  followers: number;
  completed: number;
  children?: ReactNode;
}) {
  const blurb = bio?.trim();
  const rating = reviews.length ? reviews.reduce((sum, review) => sum + review.stars, 0) / reviews.length : null;
  return (
    <header className="flex items-start gap-2.5">
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold leading-none text-white">
          {nickname.slice(0, 1)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-semibold leading-tight">{nickname}</h1>
        <p className="mt-0.5 text-xs leading-snug text-muted">
          {rating != null ? (
            <>
              {tx(locale, "評分", "Rating")} <span className="font-semibold text-ink">{rating.toFixed(1)} ({reviews.length})</span>
            </>
          ) : (
            tx(locale, "未有評分", "No rating yet")
          )}
          <span className="px-1" aria-hidden>·</span>
          {tx(locale, "粉絲", "Followers")} <span className="font-semibold text-ink">{followers}</span>
          <span className="px-1" aria-hidden>·</span>
          {tx(locale, "完成交易", "Completed")} <span className="font-semibold text-ink">{completed}</span>
        </p>
        {blurb ? <p className="mt-0.5 line-clamp-2 text-xs leading-snug">{blurb}</p> : null}
        {children}
      </div>
    </header>
  );
}
