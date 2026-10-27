import type { Prisma } from "@prisma/client";

// ponytail: hand-kept zh/en aliases, capped at 8 needles. Upgrade path: a DB synonym table if the catalog outgrows this list.
const GROUPS: readonly (readonly string[])[] = [
  ["寶可夢", "寵物小精靈", "Pokémon", "Pokemon"],
  ["噴火龍", "Charizard"],
  ["皮卡丘", "Pikachu"],
  ["可達鴨", "Psyduck"],
  ["傑尼龜", "Squirtle"],
  ["妙蛙種子", "Bulbasaur"],
  ["超夢", "Mewtwo"],
  ["路飛", "Luffy"],
  ["娜美", "Nami"],
  ["海賊王", "航海王", "One Piece"],
  ["美斯", "Messi"],
  ["居里", "Stephen Curry", "Curry"],
  ["大谷翔平", "大谷", "Shohei Ohtani", "Ohtani"],
  ["周杰倫", "Jay Chou"],
  ["姜濤", "Keung To"],
  ["足球", "Football", "Soccer"],
  ["籃球", "Basketball"],
  ["棒球", "Baseball"],
  ["歌手", "Singers"],
  ["偶像", "Idols"],
  ["演員", "Actors"],
  ["運動員", "Athletes"],
];

export function foldSearch(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function searchNeedles(query: string): string[] {
  const q = query.trim().slice(0, 80);
  if (!q) return [];
  const folded = foldSearch(q);
  const out = new Set<string>([q]);
  const plain = folded;
  if (plain !== q.toLowerCase()) out.add(plain);
  const latin = /[a-z]/i.test(q);
  const prefixMin = latin ? 3 : 2;
  for (const group of GROUPS) {
    const hit = group.some((term) => {
      const t = foldSearch(term);
      if (t.length < 2) return false;
      if (folded === t || folded.includes(t)) return true;
      if (q.length >= prefixMin && t.startsWith(folded)) return true;
      if (folded.length >= 4 && t.includes(folded)) return true;
      return false;
    });
    if (!hit) continue;
    for (const term of group) out.add(term);
    if (out.size >= 8) break;
  }
  return [...out].slice(0, 8);
}

function fieldContains(needle: string): Prisma.StringFilter {
  return { contains: needle, mode: "insensitive" };
}

export function userQueryWhere(query: string): Prisma.UserWhereInput {
  const needles = searchNeedles(query);
  if (!needles.length) return { id: { in: [] } };
  return {
    OR: needles.flatMap((needle) => {
      const contains = fieldContains(needle);
      return [{ nickname: contains }, { storeName: contains }];
    }),
  };
}

function listingNeedleWhere(needle: string): Prisma.ListingWhereInput {
  const contains = fieldContains(needle);
  return {
    OR: [
      { title: contains },
      { cardName: contains },
      { personName: contains },
      { setName: contains },
      { game: contains },
      { description: contains },
      { items: { some: { OR: [{ cardName: contains }, { catalogTitle: contains }, { setName: contains }] } } },
      {
        category: {
          OR: [
            { nameZh: contains },
            { nameEn: contains },
            { parent: { OR: [{ nameZh: contains }, { nameEn: contains }] } },
          ],
        },
      },
    ],
  };
}

/** Post text plus the listing reached via CollectionItem.listing. Collection item title is not a search field. */
export function postQueryWhere(query: string): Prisma.PostWhereInput {
  const needles = searchNeedles(query);
  if (!needles.length) return { id: { in: [] } };
  const clause = (needle: string): Prisma.PostWhereInput => {
    const contains = fieldContains(needle);
    return {
      OR: [
        { body: contains },
        { author: { nickname: contains } },
        { collectionItem: { listing: listingNeedleWhere(needle) } },
      ],
    };
  };
  if (needles.length === 1) return clause(needles[0]);
  return { OR: needles.map(clause) };
}

export function listingQueryWhere(query: string): Prisma.ListingWhereInput {
  const needles = searchNeedles(query);
  if (!needles.length) return {};
  if (needles.length === 1) return listingNeedleWhere(needles[0]);
  return { OR: needles.map(listingNeedleWhere) };
}

export type MarketShow = "all" | "listing" | "post";

export function marketShow(value: string | undefined | null): MarketShow {
  return value === "listing" || value === "post" ? value : "all";
}

/** Keep the active result chip while the other market filters change. `all` stays off the URL. */
export function marketSearchHref(
  current: {
    q?: string;
    cat?: string;
    cond?: string;
    min?: string;
    sort?: string;
    pmin?: string;
    pmax?: string;
    sale?: string;
    set?: string;
    num?: string;
  },
  show: MarketShow = "all",
): string {
  const params = new URLSearchParams();
  const entries: [string, string | undefined][] = [
    ["q", current.q],
    ["cat", current.cat],
    ["cond", current.cond],
    ["min", current.min],
    ["sort", current.sort && current.sort !== "relevance" ? current.sort : ""],
    ["pmin", current.pmin],
    ["pmax", current.pmax],
    ["sale", current.sale],
    ["set", current.set],
    ["num", current.num],
  ];
  for (const [key, value] of entries) {
    const next = value?.trim();
    if (next) params.set(key, next);
  }
  if (show !== "all") params.set("show", show);
  const search = params.toString();
  return search ? `/search?${search}` : "/search";
}

/**
 * 賣場 posts: the linked listing has to pass the market filter (active, category, condition, …).
 * Pass that filter without the text query. Text matches the post body, the author, or the listing.
 */
export function listedPostWhere(listingWhere: Prisma.ListingWhereInput, query = ""): Prisma.PostWhereInput {
  const linked: Prisma.PostWhereInput = { collectionItem: { listing: listingWhere } };
  const q = query.trim();
  if (!q) return linked;
  return { AND: [linked, postQueryWhere(q)] };
}

export type MemoryItem = {
  query: string;
  cat?: string;
  catZh?: string;
  catEn?: string;
};

export type SuggestListing = {
  id: string;
  title: string;
  categorySlug?: string | null;
  categoryZh?: string | null;
  categoryEn?: string | null;
};

export type SuggestCategory = {
  slug: string;
  nameZh: string;
  nameEn: string;
};

export type SuggestRow = {
  key: string;
  href: string;
  label: string;
  hintZh?: string;
  hintEn?: string;
  query?: string;
  cat?: string;
  catZh?: string;
  catEn?: string;
  kind: "query" | "memory" | "category" | "listing";
};

export function memoryKey(item: { query: string; cat?: string | null }): string {
  return `${item.query.trim().slice(0, 80)}|${item.cat?.trim() || ""}`;
}

export function searchHref(query: string, extra?: { cat?: string }): string {
  const params = new URLSearchParams();
  const q = query.trim().slice(0, 80);
  if (q) params.set("q", q);
  if (extra?.cat) params.set("cat", extra.cat);
  const search = params.toString();
  return search ? `/search?${search}` : "/search";
}

/** Universal search: users, posts, and listings. Market filters stay on `searchHref`. */
export function findHref(query: string): string {
  const params = new URLSearchParams();
  const q = query.trim().slice(0, 80);
  if (q) params.set("q", q);
  const search = params.toString();
  return search ? `/find?${search}` : "/find";
}

export function textHits(query: string, text: string): boolean {
  const raw = query.trim();
  const folded = foldSearch(raw);
  const target = foldSearch(text);
  if (!folded || !target) return false;
  const min = /[a-z]/i.test(raw) ? 2 : 1;
  if (folded.length < min) return false;
  if (target.includes(folded)) return true;
  return searchNeedles(raw).some((needle) => {
    const n = foldSearch(needle);
    return n.length >= min && n !== folded && target.includes(n);
  });
}

export function categoryMatches(query: string, nameZh: string, nameEn: string): boolean {
  return textHits(query, nameZh) || textHits(query, nameEn);
}

function cleanMemory(item: MemoryItem): MemoryItem | null {
  const query = item.query?.trim().slice(0, 80) ?? "";
  if (!query) return null;
  const cat = item.cat?.trim() || undefined;
  return { query, cat, catZh: cat ? item.catZh : undefined, catEn: cat ? item.catEn : undefined };
}

export function rememberMemory(list: MemoryItem[], item: MemoryItem, limit = 12): MemoryItem[] {
  const next = cleanMemory(item);
  if (!next) return list;
  const key = memoryKey(next);
  return [next, ...list.filter((row) => memoryKey(row) !== key)].slice(0, limit);
}

export function forgetMemory(list: MemoryItem[], item: { query: string; cat?: string }): MemoryItem[] {
  const key = memoryKey(item);
  return list.filter((row) => memoryKey(row) !== key);
}

export function mergeMemory(primary: MemoryItem[], incoming: MemoryItem[], limit = 12): MemoryItem[] {
  const out: MemoryItem[] = [];
  const seen = new Set<string>();
  for (const item of [...primary, ...incoming]) {
    const next = cleanMemory(item);
    if (!next) continue;
    const key = memoryKey(next);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
    if (out.length >= limit) break;
  }
  return out;
}

function memoryRow(item: MemoryItem, to: "find" | "search"): SuggestRow {
  return {
    key: `m:${memoryKey(item)}`,
    kind: "memory",
    href: to === "find" ? findHref(item.query) : searchHref(item.query, { cat: item.cat }),
    label: item.query,
    hintZh: item.catZh ? `在${item.catZh}` : undefined,
    hintEn: item.catEn ? `in ${item.catEn}` : undefined,
    query: item.query,
    cat: item.cat,
    catZh: item.catZh,
    catEn: item.catEn,
  };
}

export function buildSuggestRows(input: {
  query: string;
  recent: MemoryItem[];
  saved: MemoryItem[];
  tab: "recent" | "saved";
  listings: SuggestListing[];
  categories: SuggestCategory[];
  to?: "find" | "search";
}): SuggestRow[] {
  const to = input.to ?? "search";
  const q = input.query.trim().slice(0, 80);
  if (!q) {
    const source = input.tab === "saved" ? input.saved : input.recent;
    return source.map((item) => memoryRow(item, to));
  }

  const rows: SuggestRow[] = [];
  const seen = new Set<string>();
  const push = (row: SuggestRow) => {
    if (rows.length >= 8 || seen.has(row.href)) return false;
    seen.add(row.href);
    rows.push(row);
    return true;
  };

  push({ key: `q:${q}`, kind: "query", href: to === "find" ? findHref(q) : searchHref(q), label: q, query: q });

  let recentShown = 0;
  for (const item of input.recent) {
    if (recentShown >= 3) break;
    if (!textHits(q, item.query)) continue;
    if (push(memoryRow(item, to))) recentShown += 1;
  }

  let cats = 0;
  const addCat = (slug: string, nameZh: string, nameEn: string) => {
    if (cats >= 3) return;
    const ok = push({
      key: `c:${q}|${slug}`,
      kind: "category",
      href: to === "find" ? findHref(q) : searchHref(q, { cat: slug }),
      label: q,
      hintZh: `在${nameZh}`,
      hintEn: `in ${nameEn}`,
      query: q,
      cat: slug,
      catZh: nameZh,
      catEn: nameEn,
    });
    if (ok) cats += 1;
  };
  for (const cat of input.categories) addCat(cat.slug, cat.nameZh, cat.nameEn);
  for (const listing of input.listings) {
    if (!listing.categorySlug || !listing.categoryZh || !listing.categoryEn) continue;
    addCat(listing.categorySlug, listing.categoryZh, listing.categoryEn);
  }

  let listingsShown = 0;
  for (const listing of input.listings) {
    if (listingsShown >= 6) break;
    const ok = push({
      key: `l:${listing.id}`,
      kind: "listing",
      href: `/listing/${listing.id}`,
      label: listing.title,
      hintZh: listing.categoryZh ? `在${listing.categoryZh}` : undefined,
      hintEn: listing.categoryEn ? `in ${listing.categoryEn}` : undefined,
    });
    if (ok) listingsShown += 1;
  }
  return rows;
}

// Desktop dropdown must dismiss on outside scroll/blur. The mobile sheet scrolls
// its own list and keeps focus, so those events must not close it.
export function suggestPanelDismiss(
  reason: "blur" | "scroll" | "escape" | "submit",
  opts: { mobileSheet: boolean; insidePanel: boolean; focusInside: boolean },
): boolean {
  if (reason === "escape" || reason === "submit") return true;
  if (reason === "blur") return !opts.mobileSheet && !opts.focusInside;
  return !opts.mobileSheet && !opts.insidePanel;
}

export function searchScore(
  listing: {
    title: string;
    cardName?: string | null;
    personName?: string | null;
    game?: string | null;
    category?: { nameZh?: string | null; nameEn?: string | null; parent?: { nameZh?: string | null; nameEn?: string | null } | null } | null;
  },
  query: string,
): number {
  const needles = searchNeedles(query).map(foldSearch);
  const hit = (text: string | null | undefined, weight: number) =>
    text && needles.some((needle) => foldSearch(text).includes(needle)) ? weight : 0;
  return (
    hit(listing.title, 5) +
    hit(listing.cardName, 4) +
    hit(listing.personName, 4) +
    hit(listing.game, 2) +
    hit(listing.category?.nameZh, 3) +
    hit(listing.category?.nameEn, 3) +
    hit(listing.category?.parent?.nameZh, 1) +
    hit(listing.category?.parent?.nameEn, 1)
  );
}
