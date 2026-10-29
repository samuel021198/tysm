import type { ReactNode } from "react";
import Link from "next/link";
import { tx, type Locale } from "@/lib/i18n";
import { mapsSearchUrl, profileLinkLabel } from "@/lib/profile-edit";
import { BioText } from "./bio-text";
import { ProfileTabLink } from "./profile-tab-link";
import { TopicChips } from "./topic-chips";

export type VerificationTierName = "NORMAL" | "TRUSTED" | "MERCHANT";

/** Four-character pill beside the display name. NORMAL is no badge. */
export function verificationPill(tier: VerificationTierName): { label: string; className: string } | null {
  if (tier === "TRUSTED") {
    return { label: "誠信用戶", className: "bg-[#E8F5E9] text-[#1B5E20]" };
  }
  if (tier === "MERCHANT") {
    return { label: "專業商戶", className: "bg-[#FFF3E0] text-[#E65100]" };
  }
  return null;
}

export function ProfileHeader({
  locale,
  userId,
  base,
  nickname,
  username,
  avatarUrl,
  bio,
  links,
  interestTags,
  handoverPlace,
  reviews,
  followers,
  completed,
  postCount,
  listingCount,
  verificationTier = "NORMAL",
  self,
  children,
}: {
  locale: Locale;
  userId: string;
  base: string;
  nickname: string;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  links: string[];
  interestTags: string[];
  handoverPlace: string | null;
  reviews: { stars: number }[];
  followers: number;
  completed: number;
  postCount: number;
  listingCount: number;
  verificationTier?: VerificationTierName;
  self?: boolean;
  children?: ReactNode;
}) {
  const blurb = bio?.trim();
  const place = handoverPlace?.trim();
  const pill = verificationPill(verificationTier);
  const action = "inline-flex h-8 flex-1 items-center justify-center rounded-full border border-line bg-card px-2 text-xs font-medium text-ink";
  const score = reviews.length ? (reviews.reduce((sum, review) => sum + review.stars, 0) / reviews.length).toFixed(1) : null;
  const rating = `★ ${score ?? "—"} (${completed})`;
  const stats = [
    { href: `${base}?tab=posts#profile-posts`, value: postCount, label: tx(locale, "則貼文", "Posts"), tab: null },
    { href: `${base}?tab=selling#profile-posts`, value: listingCount, label: tx(locale, "商品", "Listings"), tab: "selling" },
    { href: `/shop/${userId}/followers`, value: followers, label: tx(locale, "粉絲", "Followers"), tab: null },
  ];
  return (
    <header className="grid gap-3">
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-[5.5rem] w-[5.5rem] shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid h-[5.5rem] w-[5.5rem] shrink-0 place-items-center rounded-full bg-accent text-2xl font-semibold leading-none text-white">
            {nickname.slice(0, 1)}
          </span>
        )}
        <dl className="grid min-w-0 flex-1 grid-cols-3 text-center">
          {stats.map((stat) => {
            const figure = (
              <>
                <span className="block text-lg font-semibold leading-none">{stat.value}</span>
                <span className="mt-1 block text-[11px] leading-tight text-muted">{stat.label}</span>
              </>
            );
            const className = "block rounded-xl px-1 py-1 active:bg-soft";
            return (
              <div key={stat.label}>
                {stat.tab === "selling" ? (
                  <ProfileTabLink href={stat.href} tab="selling" className={className}>
                    {figure}
                  </ProfileTabLink>
                ) : (
                  <Link href={stat.href} className={className}>
                    {figure}
                  </Link>
                )}
              </div>
            );
          })}
        </dl>
      </div>
      <div>
        <h1 className="text-[15px] font-semibold leading-snug">
          <span className="inline-flex items-center gap-1 align-middle">
            {nickname}
            {pill ? (
              <span className={`inline-flex items-center whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none ${pill.className}`}>
                {pill.label}
              </span>
            ) : null}
          </span>
          {username ? <span className="ml-1.5 font-normal text-muted">@{username}</span> : null}
          {!username && self ? (
            <Link href="/me/edit" className="ml-1.5 font-normal text-link">
              @{tx(locale, "用戶名稱", "username")}
            </Link>
          ) : null}
          <span className="ml-1.5 font-semibold" aria-label={tx(locale, `評分 ${rating}，完成交易 ${completed}`, `Rating ${rating}, ${completed} completed`)}>
            {rating}
          </span>
        </h1>
        {blurb ? <BioText text={blurb} /> : null}
        <TopicChips tags={interestTags.slice(0, 8)} className="mt-1" />
        {links.length ? (
          <ul className="mt-1 grid gap-0.5 text-sm">
            {links.slice(0, 3).map((href) => (
              <li key={href}>
                <a href={href} className="text-link" target="_blank" rel="noreferrer">
                  {profileLinkLabel(href)}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {place ? (
          <a href={mapsSearchUrl(place)} className="mt-1 inline-flex text-sm text-link" target="_blank" rel="noreferrer">
            {place}
          </a>
        ) : null}
      </div>
      {self ? (
        <div className="flex items-center gap-1.5">
          <Link href="/me/edit" className={action}>
            {tx(locale, "編輯", "Edit")}
          </Link>
          <Link href="/me/footprint" className={action}>
            {tx(locale, "足跡", "Footprint")}
          </Link>
          <Link href="/me/settings" aria-label={tx(locale, "設定", "Settings")} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-card text-sm leading-none">
            <span aria-hidden>⚙️</span>
          </Link>
        </div>
      ) : null}
      {children}
    </header>
  );
}
