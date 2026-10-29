import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPrefs } from "@/lib/auth";
import { tx } from "@/lib/i18n";
import { newsDetailBlocks, newsDetailCopy, newsSortAt, newsSourceLine } from "@/lib/news";
import { NewsCover } from "@/components/news-cover";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const row = await prisma.newsItem.findUnique({ where: { slug }, select: { title: true } });
  return { title: row?.title || "新聞" };
}

export default async function NewsDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [prefs, row] = await Promise.all([getPrefs(), prisma.newsItem.findUnique({ where: { slug } })]);
  if (!row) notFound();
  const locale = prefs.locale;
  const { copy, sourceUrl } = newsDetailCopy(row.body, row.linkUrl);
  const detail = newsDetailBlocks(copy);
  const href = sourceUrl || detail.linkUrl;

  return (
    <article className="mx-auto grid max-w-lg gap-3">
      <NewsCover
        source={row.source}
        coverUrl={row.coverUrl}
        fit="contain"
        className="h-auto max-h-[28rem] w-auto max-w-full justify-self-center rounded-2xl"
      />
      <h1 className="text-xl font-semibold leading-snug">{row.title}</h1>
      <p className="text-sm text-muted">{newsSourceLine(row.source, newsSortAt(row), new Date(), locale)}</p>
      {detail.blocks.length || href ? (
        <div className="grid gap-2">
          {detail.blocks.map((block, index) =>
            block.kind === "prose" ? (
              <p key={index} className="whitespace-pre-wrap text-sm leading-6">
                {block.text}
              </p>
            ) : (
              <div key={index} className="rounded-xl bg-soft px-3 py-2">
                <p className="text-xs text-muted">{block.label}</p>
                <p className={block.emphasis ? "text-[15px] font-semibold" : "text-sm"}>{block.value}</p>
              </div>
            ),
          )}
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center self-start rounded-full bg-soft px-3 text-sm font-medium text-link"
            >
              {tx(locale, "來源", "Source")}
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
