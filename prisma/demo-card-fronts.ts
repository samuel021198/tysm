/**
 * Single-card fronts for the demo feed.
 * Japanese Pokémon art is already on the public catalog bucket.
 * English Base, One Piece, and Riftbound use the same HTTPS the dex stores
 * when that file is not mirrored yet. Sports sets have no catalog art.
 */
const R2 = "https://pub-9b9f3109670d41aeac8a465ff7b3e999.r2.dev/dex/pokemon";
const r2 = (id: string) => `${R2}/${id}.webp`;
const tcg = (path: string) => `https://assets.tcgdex.net/${path}/high.webp`;
const op = (id: string) => `https://optcgapi.com/media/static/Card_Images/${id}.jpg`;
const rift = (hash: string) => `https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/${hash}-744x1039.png`;

export const fronts = {
  charizard: r2("ja_SV2a-006"),
  charizardSar: r2("ja_SV2a-201"),
  charizardBase: tcg("en/base/base1/4"),
  blastoiseBase: tcg("en/base/base1/2"),
  venusaurBase: tcg("en/base/base1/15"),
  pikachu: r2("ja_SV2a-025"),
  pikachuEx: r2("ja_SV8a-236"),
  gengar: r2("ja_SV2a-094"),
  eevee: r2("ja_SV2a-133"),
  mewtwo: r2("ja_SV2a-150"),
  mew: r2("ja_SV2a-151"),
  dragonite: r2("ja_SV2a-149"),
  snorlax: r2("ja_SV2a-143"),
  umbreon: r2("ja_SV8a-093"),
  umbreonSar: r2("ja_SV8a-217"),
  glaceon: r2("ja_S12a-217"),
  luffy: op("OP09-119"),
  luffyLeader: op("ST01-001"),
  luffyOp01: op("OP01-001"),
  zoro: op("OP06-118"),
  nami: op("OP01-016"),
  annie: rift("532d75dc36a16eb5954253a77366fcceac7aec62"),
  scorcher: rift("15ed971e4029a92b362a81ccadf309fb81e40b81"),
  buccaneer: rift("d481971f7560e7235e7d6934767da18daa019eff"),
  messi: "https://cdn11.bigcommerce.com/s-0kvv9/images/stencil/1280x1280/products/466833/726717/messi58reg__59119.1706121689.jpg?c=2",
  salah: "https://cdn11.bigcommerce.com/s-ced6hlkx82/images/stencil/1280x1280/products/282/552/ma10120salahstriker__32389.1591368030.jpg?c=1",
  curry: "https://cdn11.bigcommerce.com/s-0kvv9/images/stencil/1280x1280/products/427276/663492/curry154pink__43910.1678328563.jpg?c=2",
  curryOptic: "https://cdn11.bigcommerce.com/s-0kvv9/images/stencil/1280x1280/products/432507/671872/curryexpressslane__71747.1681434985.jpg?c=2",
};

export const SEED_CARD_FRONT_HOSTS = [
  "https://pub-9b9f3109670d41aeac8a465ff7b3e999.r2.dev/dex/",
  "https://assets.tcgdex.net/",
  "https://optcgapi.com/media/static/Card_Images/",
  "https://cmsassets.rgpub.io/sanity/images/",
  "https://cdn11.bigcommerce.com/",
] as const;

export function isSeedCardFront(url: string): boolean {
  return SEED_CARD_FRONT_HOSTS.some((host) => url.startsWith(host));
}

/** 4:5 center crop. Feed covers use the same frame, so the scene stays in view. */
const scene = (id: string) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1200&h=1500&fit=crop`;

/**
 * Editorial post covers: hand, desk, shelf, lightbox. Card faces stay on the listing.
 * ponytail: 17 scenes, cycled by collection index. Upgrade path: one photo per post if the feed looks repeated.
 */
export const SCENE_COVERS = [
  scene("9661254"),
  scene("9661252"),
  scene("9560279"),
  scene("7708402"),
  scene("7783412"),
  scene("9343494"),
  scene("9572050"),
  scene("7783409"),
  scene("9661257"),
  scene("7708411"),
  scene("7783410"),
  scene("9560283"),
  scene("7708403"),
  scene("9661256"),
  scene("16321207"),
  scene("7708404"),
  scene("7783411"),
] as const;

export function isSceneCover(url: string): boolean {
  return (SCENE_COVERS as readonly string[]).includes(url);
}

/** First frame is the scene. Later frames stay the card close-ups. Caps at four. */
export function withSceneCover(photos: string[], index: number): string[] {
  const cover = SCENE_COVERS[index % SCENE_COVERS.length];
  return [cover, ...photos].slice(0, 4);
}
