import Link from "next/link";
import { tx, type Locale } from "@/lib/i18n";

/** Bell hub: 通知 | 訊息. */
export function InboxHub({ locale, tab }: { locale: Locale; tab: "notes" | "messages" }) {
  const tabs = [
    { id: "notes" as const, href: "/notifications", zh: "通知", en: "Notifications" },
    { id: "messages" as const, href: "/messages", zh: "訊息", en: "Messages" },
  ];
  return (
    <nav aria-label={tx(locale, "收件箱", "Inbox")} className="mb-3 flex gap-2">
      {tabs.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          aria-current={tab === item.id ? "page" : undefined}
          className={`inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold ${tab === item.id ? "bg-accent text-white" : "bg-soft text-ink"}`}
        >
          {tx(locale, item.zh, item.en)}
        </Link>
      ))}
    </nav>
  );
}
