"use client";

import { usePathname } from "next/navigation";
import { Icon } from "./icons";

/** Account links that do not fit the one-row header. Remounts closed after navigation. */
export function HeaderMenu({
  label,
  badge = 0,
  children,
}: {
  label: string;
  badge?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <details key={pathname} className="relative">
      <summary
        aria-label={label}
        className="relative grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full text-ink hover:bg-soft [&::-webkit-details-marker]:hidden"
      >
        <Icon name="me" className="h-[18px] w-[18px]" strokeWidth={2} />
        {badge ? (
          <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent/15 px-1 text-[10px] font-semibold leading-none text-accent">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </summary>
      <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-line bg-card p-1 shadow-card">{children}</div>
    </details>
  );
}
