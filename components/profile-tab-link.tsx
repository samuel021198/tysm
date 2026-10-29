"use client";

import Link from "next/link";

export const PROFILE_TAB_EVENT = "tysm-profile-tab";

/** Same-page profile tab. A modified click still follows href (no second inventory route). */
export function ProfileTabLink({
  href,
  tab,
  className,
  children,
}: {
  href: string;
  tab: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        const url = new URL(href, window.location.origin);
        if (url.pathname !== window.location.pathname) return;
        event.preventDefault();
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
        window.dispatchEvent(new CustomEvent(PROFILE_TAB_EVENT, { detail: tab }));
        document.getElementById("profile-posts")?.scrollIntoView({ block: "start" });
      }}
    >
      {children}
    </Link>
  );
}
