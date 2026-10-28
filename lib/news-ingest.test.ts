import { readFileSync } from "fs";
import { POST } from "../app/api/internal/news/route";
import { parseNewsIngest, planNewsUpsert, newsIdForSlug } from "./news-ingest";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const base = { slug: "op-eb05-heroines", title: "EB-05", source: "One Piece" };

const missing = parseNewsIngest({ title: "EB-05", source: "One Piece" });
assert(!missing.ok && missing.error === "invalid_slug", "slug is required");
const blankTitle = parseNewsIngest({ ...base, title: "  " });
assert(!blankTitle.ok && blankTitle.error === "invalid_title", "title cannot be blank");
const badTag = parseNewsIngest({ ...base, tag: "HOT" });
assert(!badTag.ok && badTag.error === "invalid_tag", "tag must be the enum");
const badHot = parseNewsIngest({ ...base, hot: "true" });
assert(!badHot.ok && badHot.error === "invalid_hot", "hot must be a boolean");
const badEvent = parseNewsIngest({ ...base, eventAt: "tomorrow" });
assert(!badEvent.ok && badEvent.error === "invalid_event", "eventAt must be an ISO date");
const badLink = parseNewsIngest({ ...base, linkUrl: "http://example.com/a" });
assert(!badLink.ok && badLink.error === "invalid_link", "linkUrl must be https");
const cover = parseNewsIngest({ ...base, coverUrl: "/brands/topps.svg" });
assert(cover.ok && cover.value.coverUrl === "/brands/topps.svg", "a site cover is kept");
const scriptCover = parseNewsIngest({ ...base, coverUrl: "javascript:alert(1)" });
assert(!scriptCover.ok && scriptCover.error === "invalid_cover", "script covers are rejected");
assert(!parseNewsIngest(null).ok, "a non-object body is rejected");
assert(!parseNewsIngest([]).ok, "an array body is rejected");

const created = parseNewsIngest({
  ...base,
  teaser: "EB-05",
  body: "10/31 開賣。",
  tag: "RESTOCK",
  eventAt: "2026-10-31T00:00:00+08:00",
  hot: true,
  linkUrl: "https://www.onepiece-cardgame.com/en/",
  note: "ignored",
});
assert(created.ok, "a publish body parses");
if (!created.ok) throw new Error("unreachable");
assert(created.value.tag === "RESTOCK" && created.value.hot === true && created.value.source === "One Piece", "tag, hot, and source are kept");
assert(created.value.eventAt?.toISOString() === "2026-10-30T16:00:00.000Z", "eventAt keeps the instant");
assert(created.value.id === undefined, "omitted id stays omitted");
assert(!("note" in created.value), "unknown keys are ignored");
assert(parseNewsIngest({ ...base, tag: "DATE" }).ok, "DATE is a tag");
const named = parseNewsIngest({ ...base, id: "news_custom", source: "Pokémon" });
assert(named.ok && named.value.id === "news_custom" && named.value.source === "Pokémon", "an explicit id and brand source pass through");
const badId = parseNewsIngest({ ...base, id: "news custom" });
assert(!badId.ok && badId.error === "invalid_id", "id stays a token");

const plan = planNewsUpsert(null, created.value);
assert(plan.ok && plan.mode === "create", "a new slug creates");
if (!plan.ok || plan.mode !== "create") throw new Error("unreachable");
assert(plan.data.id === newsIdForSlug(base.slug) && plan.data.id === "news_op-eb05-heroines", "id is news_${slug}");
assert(plan.data.slug === base.slug && plan.data.coverUrl === null && plan.data.brandColor === "#111111", "create fills cover and color defaults");
assert(!("draft" in plan.data) && !("status" in plan.data), "v1 writes a live row");

const again = planNewsUpsert({ id: "news_op_eb05" }, { ...created.value, title: "Heroines vol.2" });
assert(again.ok && again.mode === "update", "an existing slug updates");
if (!again.ok || again.mode !== "update") throw new Error("unreachable");
assert(again.data.title === "Heroines vol.2" && again.data.hot === true && again.data.teaser === "EB-05", "sent fields update");
const partial = parseNewsIngest({ ...base, title: "只改標題" });
assert(partial.ok, "title update parses");
if (!partial.ok) throw new Error("unreachable");
const patched = planNewsUpsert({ id: "news_op_eb05" }, partial.value);
assert(patched.ok && patched.mode === "update", "partial body updates");
if (!patched.ok || patched.mode !== "update") throw new Error("unreachable");
assert(patched.data.title === "只改標題" && patched.data.teaser === undefined && patched.data.hot === undefined, "omitted fields stay");

const mismatch = planNewsUpsert({ id: "news_op_eb05" }, { ...partial.value, id: "news_other" });
assert(!mismatch.ok && mismatch.error === "id_mismatch", "a different id does not retarget the row");

const cleared = parseNewsIngest({ ...base, eventAt: null, coverUrl: "", linkUrl: null });
assert(cleared.ok && cleared.value.eventAt === null && cleared.value.coverUrl === null && cleared.value.linkUrl === null, "null clears dated and linked fields");

const route = readFileSync(new URL("../app/api/internal/news/route.ts", import.meta.url), "utf8");
assert(route.includes("authorizedBearer") && route.includes("BOOTSTRAP_SECRET"), "news ingest reuses the bootstrap bearer");
assert(route.includes("unauthorized") && route.includes("401") && route.includes("400"), "bad auth is 401 and a bad body is 400");
assert(route.includes("parseNewsIngest") && route.includes("planNewsUpsert"), "the route publishes through the helper");
assert(route.includes('revalidatePath("/news")'), "the list refreshes after publish");
assert(!route.includes("seedDemo") && !route.includes("draft"), "publish does not reseed and has no draft");
const reseed = readFileSync(new URL("../app/api/internal/reseed/route.ts", import.meta.url), "utf8");
assert(reseed.includes("seedDemo") && !reseed.includes("news-ingest") && !reseed.includes("parseNewsIngest"), "reseed behavior stays put");

async function checkRoute() {
  const previous = process.env.BOOTSTRAP_SECRET;
  process.env.BOOTSTRAP_SECRET = "test-secret";
  const call = (authorization: string, body: string) =>
    POST(
      new Request("http://localhost/api/internal/news", {
        method: "POST",
        headers: { authorization, "content-type": "application/json" },
        body,
      }),
    );
  const unauth = await call("Bearer wrong", "{}");
  assert(unauth.status === 401 && (await unauth.json()).error === "unauthorized", "a bad bearer is 401");
  const bad = await call("Bearer test-secret", JSON.stringify({ title: "x" }));
  assert(bad.status === 400 && (await bad.json()).error === "invalid_slug", "a body missing slug is 400");
  const badTag = await call("Bearer test-secret", JSON.stringify({ slug: "a", title: "t", source: "s", tag: "NOPE" }));
  assert(badTag.status === 400 && (await badTag.json()).error === "invalid_tag", "a bad tag is 400");
  delete process.env.BOOTSTRAP_SECRET;
  const missing = await call("Bearer test-secret", "{}");
  assert(missing.status === 503 && (await missing.json()).error === "unconfigured", "no secret is 503");
  if (previous === undefined) delete process.env.BOOTSTRAP_SECRET;
  else process.env.BOOTSTRAP_SECRET = previous;
  console.log("news ingest ok");
}

checkRoute().catch((error) => {
  console.error(error);
  process.exit(1);
});
