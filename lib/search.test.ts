import { foldSearch, searchNeedles, searchScore } from "./search";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const has = (q: string, term: string) => searchNeedles(q).some((needle) => foldSearch(needle) === foldSearch(term));

assert(has("寶可夢", "Pokémon"), "寶可夢 expands to Pokémon");
assert(has("Pokemon", "寶可夢"), "Pokemon expands to 寶可夢");
assert(has("pokémon", "pokemon"), "accent folds onto pokemon");
assert(has("可達鴨", "Psyduck"), "可達鴨 expands to Psyduck");
assert(has("Psyduck", "可達鴨"), "Psyduck expands to 可達鴨");
assert(has("噴火龍 VMAX", "Charizard"), "title fragment still expands 噴火龍");
assert(!has("zz", "寶可夢"), "unrelated query does not pull Pokémon");

const pokemon = { title: "噴火龍 VMAX", cardName: "噴火龍", game: "Pokémon", category: { nameZh: "寶可夢", nameEn: "Pokémon" } };
const duck = { title: "Psyduck", cardName: "Psyduck", game: "Pokémon", category: { nameZh: "寶可夢", nameEn: "Pokémon" } };
assert(searchScore(pokemon, "寶可夢") > searchScore(duck, "Charizard"), "charizard ranks for 寶可夢 and not for the other card's name");
assert(searchScore(duck, "可達鴨") >= 5, "english-only Psyduck title scores for 可達鴨");
assert(searchScore(pokemon, "Charizard") >= 4, "chinese card name scores for Charizard");

console.log("search ok");
