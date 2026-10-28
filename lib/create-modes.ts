export const CREATE_MODES = [
  {
    id: "post",
    href: "/add?kind=post",
    zh: "貼文",
    en: "Post",
    hintZh: "寫一則貼文，可以同時上架",
    hintEn: "Write a post, and list it for sale if you want",
    icon: "note",
  },
  {
    id: "sell",
    href: "/sell",
    zh: "上架",
    en: "List",
    hintZh: "四步上架：相片、價錢、運送",
    hintEn: "Four steps: photos, price, and shipping",
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
