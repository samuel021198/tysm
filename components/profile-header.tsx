"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { tx, type Locale } from "@/lib/i18n";
import { mapsSearchUrl, profileLinkLabel } from "@/lib/profile-edit";
import { BioText } from "./bio-text";
import { ProfileTabLink } from "./profile-tab-link";
import { TopicChips } from "./topic-chips";

export type VerificationTierName = "NORMAL" | "TRUSTED" | "MERCHANT";

/** Small score beside the display name. Hidden when there are no ratings. */
export function RatingPill({ locale, average, count }: { locale: Locale; average: number; count: number }) {
  if (count < 1) return null;
  const label = `★ ${average.toFixed(1)}`;
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full bg-soft px-1.5 py-0.5 text-[11px] font-semibold leading-none text-ink"
      aria-label={tx(locale, `評分 ${label}，${count} 個`, `Rating ${label}, ${count} ratings`)}
    >
      {label}
    </span>
  );
}

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

/** Tap copy under the pill. NORMAL has nothing to explain. */
export function verificationTip(tier: VerificationTierName): string | null {
  if (tier === "TRUSTED") return "已通過身份驗證";
  if (tier === "MERCHANT") return "已通過商戶驗證";
  return null;
}

export function VerificationPill({ tier }: { tier: VerificationTierName }) {
  const pill = verificationPill(tier);
  const tip = verificationTip(tier);
  const [open, setOpen] = useState(false);
  if (!pill || !tip) return null;
  return (
    <span className="inline-flex shrink-0 flex-col items-center">
      <button
        type="button"
        className={`inline-flex cursor-pointer items-center whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none ${pill.className}`}
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        {pill.label}
      </button>
      {open ? (
        <span role="status" className="mt-1 max-w-[8.5rem] whitespace-normal text-center text-[11px] font-medium leading-snug text-ink">
          {tip}
        </span>
      ) : null}
    </span>
  );
}

/** Display name, then the verification pill, then the score. The pill tip stays on this row. */
export function NameLine({
  name,
  tier,
  locale,
  rating = null,
  nameClassName = "",
  className = "",
}: {
  name: ReactNode;
  tier: VerificationTierName;
  locale: Locale;
  rating?: { average: number; count: number } | null;
  nameClassName?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex min-w-0 max-w-full flex-wrap items-center gap-1 align-middle ${className}`}>
      <span className={`min-w-0 max-w-full ${nameClassName}`}>{name}</span>
      <VerificationPill tier={tier} />
      {rating ? <RatingPill locale={locale} average={rating.average} count={rating.count} /> : null}
    </span>
  );
}

export function ProfileHeader({
  locale,
  userId,
  base,
  nickname,
  avatarUrl,
  bio,
  links,
  interestTags,
  handoverPlace,
  rating = null,
  followers,
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
  avatarUrl: string | null;
  bio: string | null;
  links: string[];
  interestTags: string[];
  handoverPlace: string | null;
  rating?: { average: number; count: number } | null;
  followers: number;
  postCount: number;
  listingCount: number;
  verificationTier?: VerificationTierName;
  self?: boolean;
  children?: ReactNode;
}) {
  const blurb = bio?.trim();
  const place = handoverPlace?.trim();
  const action = "inline-flex h-8 flex-1 items-center justify-center rounded-full border border-line bg-card px-2 text-xs font-medium text-ink";
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
          <NameLine name={nickname} tier={verificationTier} locale={locale} rating={rating} />
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
