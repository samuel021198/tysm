import Link from "next/link";
import { tx, type Locale } from "@/lib/i18n";

/** 消息 inner tabs: 個人消息 | 新聞. */
export function InboxHub({ locale, tab }: { locale: Locale; tab: "notes" | "news" }) {
  const tabs = [
    { id: "notes" as const, href: "/notifications", label: "個人消息" },
    { id: "news" as const, href: "/news", label: "新聞" },
  ];
  return (
    <nav aria-label={tx(locale, "消息", "Updates")} className="mb-3 grid grid-cols-2 border-b border-line">
      {tabs.map((item) => {
        const on = tab === item.id;
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={`flex h-11 items-center justify-center border-b-2 text-sm font-semibold ${on ? "border-ink text-ink" : "border-transparent text-muted"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
