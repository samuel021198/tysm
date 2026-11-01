import { readFileSync } from "fs";
import { adminTab, openFirst, reportHref } from "./admin-desk";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(adminTab(undefined) === "applications" && adminTab("overview") === "applications" && adminTab("orders") === "applications", "申請 is the default tab");
assert(adminTab("users") === "users" && adminTab("disputes") === "disputes", "known tabs stay");
assert(reportHref("LISTING", "abc") === "/listing/abc" && reportHref("USER", "u1") === "/u/u1", "report targets link");
assert(reportHref("POST", "p1") === "/post/p1" && reportHref("THREAD", "t1") === "/messages/t1", "post and thread reports link");
assert(reportHref("OTHER", "x") === null && reportHref("LISTING", "../admin") === null, "unknown or unsafe targets do not link");
const ranked = openFirst([{ id: "d", status: "BUYER_WINS" }, { id: "a", status: "OPEN" }, { id: "b", status: "APPEALED" }, { id: "c", status: "RESOLVED" }]);
assert(ranked.map((row) => row.id).join() === "a,b,d,c", "open and appealed stay first");

const page = readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/admin-shell.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const actions = readFileSync(new URL("../actions/admin.ts", import.meta.url), "utf8");
assert(shell.includes("TSM 管理") && shell.includes("返回前台") && shell.includes("登出") && shell.includes("申請") && shell.includes("舉報") && shell.includes("爭議"), "desk header");
assert(shell.includes("用戶") && shell.includes("貨品") && shell.includes("品類") && !shell.includes("rounded-full"), "six underline tabs, not storefront chips");
assert(!shell.includes("overview") && !shell.includes("佣金") && !shell.includes("TabBar"), "no overview, commission, or bottom tab");
assert(page.includes("暱稱") && page.includes("標記誠信") && page.includes("標記專業商戶") && page.includes("禁拍") && page.includes("liftBan") && page.includes("/u/"), "users table");
assert(page.includes("禁用") && page.includes("確定禁用此帳戶？") && !page.includes("升") && !actions.includes('role: "ADMIN"'), "ban confirms; nobody is promoted to admin");
assert(page.includes("審核中") && page.includes("已通過") && page.includes("已拒絕") && page.includes("批核") && page.includes("拒絕"), "applications");
assert(page.includes("下架") && page.includes("確定下架此貨品？") && page.includes('status === "ACTIVE"'), "unlist only when active, with confirm");
assert(page.includes("標記已處理") && !page.includes("從舉報"), "resolve a report; no quick ban from the report");
assert(page.includes("買家勝（賣家付退運）") && page.includes("賣家勝"), "dispute decisions");
assert(page.includes("父分類") && page.includes("新增子分類") && !page.includes("刪除分類"), "categories add a child and do not delete");
assert(!page.includes("setCommission") && !page.includes("tab=overview") && !page.includes("tab=orders"), "commission and the old tabs stay off the desk");
assert(layout.includes("x-pathname") && layout.includes("admin-shell") && layout.includes("TabBar"), "admin drops the storefront chrome");
assert(actions.includes("planVerificationReview") && actions.includes("verificationTier") && actions.includes("disabled"), "review writes the tier; ban is a flag");

console.log("admin desk ok");
