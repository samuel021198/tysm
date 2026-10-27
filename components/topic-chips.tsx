import Link from "next/link";
import { findHref } from "@/lib/search";

/** Light gray topic chips. Small enough to sit under a 4:5 cover. */
export function TopicChips({ tags, className = "" }: { tags: string[]; className?: string }) {
  if (!tags.length) return null;
  return (
    <p className={`flex flex-wrap gap-x-2 gap-y-1 ${className}`}>
      {tags.map((tag) => (
        <Link key={tag} href={findHref(`#${tag}`)} className="text-[11px] font-normal leading-4 text-muted">
          #{tag}
        </Link>
      ))}
    </p>
  );
}
