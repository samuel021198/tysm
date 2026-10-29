import { readFileSync } from "node:fs";
import { POST } from "../app/api/internal/clear-chats/route";
import { clearChats, messageNoticeWhere } from "./clear-chats";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function checkWipe() {
  const calls: string[] = [];
  const deleted = await clearChats({
    message: {
      deleteMany: async () => {
        calls.push("messages");
        return { count: 4 };
      },
    },
    messageThread: {
      deleteMany: async () => {
        calls.push("threads");
        return { count: 2 };
      },
    },
    notification: {
      deleteMany: async (args) => {
        calls.push("notes");
        assert(args.where === messageNoticeWhere, "chat bells use the thread href");
        assert(args.where.type === "message" && args.where.href.startsWith === "/messages/", "only thread bells");
        return { count: 1 };
      },
    },
  });
  assert(deleted.messages === 4 && deleted.threads === 2, "counts are messages and threads");
  assert(!("notes" in deleted), "bells are not part of the response");
  assert(calls.join() === "messages,threads,notes", "messages are deleted before threads");
}

const route = readFileSync(new URL("../app/api/internal/clear-chats/route.ts", import.meta.url), "utf8");
assert(route.includes('export const dynamic = "force-dynamic"') && route.includes('export const runtime = "nodejs"'), "route stays dynamic on node");
assert(route.includes("authorizedBearer") && route.includes("BOOTSTRAP_SECRET"), "auth matches reseed");
assert(route.includes("postgres(?:ql)?:\\/\\/\\S+") && route.includes('console.error("clear-chats failed", safeMessage(error))'), "errors redact a database url");
assert(route.includes("clearChats") && route.includes("deleted"), "success returns the wipe counts");
assert(!route.includes("seedDemo") && !route.includes("wipeUserContent"), "this route does not reseed");
for (const table of ["user", "listing", "post", "order", "offer", "catalogCard", "catalogSet"]) {
  assert(!route.includes(`${table}.deleteMany`), `${table} stays`);
}

const reseed = readFileSync(new URL("../app/api/internal/reseed/route.ts", import.meta.url), "utf8");
assert(reseed.includes("seedDemo") && !reseed.includes("clearChats"), "reseed behavior stays put");

async function checkAuth() {
  const previous = process.env.BOOTSTRAP_SECRET;
  const call = (authorization?: string) =>
    POST(
      new Request("http://localhost/api/internal/clear-chats", {
        method: "POST",
        headers: authorization ? { authorization } : {},
      }),
    );
  delete process.env.BOOTSTRAP_SECRET;
  const missing = await call("Bearer test-secret");
  assert(missing.status === 503 && (await missing.json()).error === "unconfigured", "no secret is 503");
  process.env.BOOTSTRAP_SECRET = "test-secret";
  const unauth = await call("Bearer wrong");
  assert(unauth.status === 401 && (await unauth.json()).error === "unauthorized", "a bad bearer is 401");
  const bare = await call();
  assert(bare.status === 401, "a missing bearer is 401");
  if (previous === undefined) delete process.env.BOOTSTRAP_SECRET;
  else process.env.BOOTSTRAP_SECRET = previous;
}

checkWipe()
  .then(() => checkAuth())
  .then(() => console.log("clear-chats ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
