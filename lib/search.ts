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

export function listingQueryWhere(query: string): Prisma.ListingWhereInput {
  const needles = searchNeedles(query);
  if (!needles.length) return {};
  const clause = (needle: string): Prisma.ListingWhereInput => {
    const contains = fieldContains(needle);
    return {
      OR: [
        { title: contains },
        { cardName: contains },
        { personName: contains },
        { setName: contains },
        { game: contains },
        { description: contains },
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
  };
  if (needles.length === 1) return clause(needles[0]);
  return { OR: needles.map(clause) };
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
