export const CREATE_MODES = [
  {
    id: "sell",
    href: "/sell",
    zh: "上架",
    en: "List",
    hintZh: "進階上架，可以拍賣同揀運送",
    hintEn: "Advanced listing, auctions and shipping",
    ctaZh: "去上架",
    ctaEn: "List a card",
    icon: "tag",
  },
  {
    id: "post",
    href: "/add?kind=post",
    zh: "開 post",
    en: "Post",
    hintZh: "寫一則貼文，唔使上架",
    hintEn: "Write a standalone post",
    ctaZh: "開 post",
    ctaEn: "New post",
    icon: "note",
  },
  {
    id: "story",
    href: "/story/new",
    zh: "動態",
    en: "Story",
    hintZh: "影張相，24 小時後消失",
    hintEn: "A photo that disappears in 24 hours",
    ctaZh: "發動態",
    ctaEn: "New story",
    icon: "camera",
  },
  {
    id: "collect",
    href: "/add",
    zh: "加入收藏",
    en: "Collect",
    hintZh: "只收入收藏格",
    hintEn: "Save it to your collection",
    ctaZh: "加入收藏",
    ctaEn: "Add to collection",
    icon: "bookmark",
  },
] as const;

export function createDest(href: string, loggedIn: boolean) {
  return loggedIn ? href : `/login?next=${encodeURIComponent(href)}`;
}

export function createIndexFromScroll(scrollLeft: number, width: number, count: number) {
  if (!(width > 0) || count <= 0) return 0;
  const index = Math.round(scrollLeft / width);
  return Math.min(count - 1, Math.max(0, index));
}
