export const CREATE_MODES = [
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
    id: "post",
    href: "/add?kind=post",
    zh: "貼文",
    en: "Post",
    hintZh: "寫一則貼文，可以同時上架",
    hintEn: "Write a post, and list it for sale if you want",
    ctaZh: "寫貼文",
    ctaEn: "New post",
    icon: "note",
  },
  {
    id: "sell",
    href: "/sell",
    zh: "上架",
    en: "List",
    hintZh: "四步上架：相片、價錢、運送",
    hintEn: "Four steps: photos, price, and shipping",
    ctaZh: "去上架",
    ctaEn: "List a card",
    icon: "tag",
  },
] as const;

export function createDest(href: string, loggedIn: boolean) {
  return loggedIn ? href : `/login?next=${encodeURIComponent(href)}`;
}

export function createDefaultIndex() {
  const index = CREATE_MODES.findIndex((mode) => mode.id === "post");
  return index < 0 ? 0 : index;
}
