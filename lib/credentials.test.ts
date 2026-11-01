import { readFileSync } from "fs";
import { parseLoginAccount, passwordIssue, registerPhone } from "./credentials";
import { errText } from "./i18n";
import { hashPassword, passwordMatches } from "./password";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(parseLoginAccount("admin").kind === "admin", "exact admin");
assert(parseLoginAccount(" admin ").kind === "admin", "trimmed admin");
assert(parseLoginAccount("Admin").kind === "invalid", "Admin is not the handle");
assert(parseLoginAccount("ADMIN").kind === "invalid", "uppercase is not the handle");

const spaced = parseLoginAccount("9123 4567");
assert(spaced.kind === "phone" && spaced.phone === "+85291234567", "spaces stripped");
const plus = parseLoginAccount("+85291234567");
assert(plus.kind === "phone" && plus.phone === "+85291234567", "+852 stored as +852");
assert(parseLoginAccount("21234567").kind === "invalid", "landline is not a mobile");
assert(parseLoginAccount("9123456").kind === "invalid", "short number");
assert(parseLoginAccount("mars").kind === "invalid", "demo handle is not a password login");

assert(!registerPhone("admin").ok && !registerPhone("Admin").ok, "cannot register the admin handle");
const registered = registerPhone("+852 9123 4567");
assert(registered.ok && registered.phone === "+85291234567", "register normalizes a mobile");
assert(passwordIssue("short") === "password_short" && passwordIssue("12345678") === null, "min 8");

assert(errText("zh-HK", "credentials") === "電話／帳號或密碼不正確", "login fail copy");
assert(errText("zh-HK", "phone_format") === "請輸入有效的香港電話號碼", "phone copy");
assert(errText("zh-HK", "password_short") === "密碼至少 8 位", "short password copy");
assert(errText("zh-HK", "password_mismatch") === "兩次密碼不一致", "mismatch copy");
assert(errText("zh-HK", "phone_taken") === "此電話號碼已註冊", "taken copy");
assert(errText("zh-HK", "terms_tick") === "請剔選服務條款", "terms copy");
assert(errText("zh-HK", "nickname_required") === "請輸入暱稱", "nickname copy");

const route = readFileSync(new URL("../app/api/internal/admin-password/route.ts", import.meta.url), "utf8");
assert(route.includes("authorizedBearer") && route.includes("BOOTSTRAP_SECRET") && route.includes("syncAdminPasswordFromEnv"), "bootstrap bearer sets the admin password");
assert(!route.includes("request.json") && !route.includes("formData"), "password is not taken from the request");

const login = readFileSync(new URL("../components/login-form.tsx", import.meta.url), "utf8");
assert(!login.includes("OtpChip") && !login.includes("索取驗證碼") && !login.includes("requestOtp"), "login ui has no otp");
assert(login.includes("登入 TSM") && login.includes("註冊 TSM"), "titles");
assert(login.includes("用香港電話與密碼登入。管理員請輸入帳號 admin。"), "login helper");
assert(login.includes("一個電話號碼對應一個帳號。"), "register helper");
assert(login.includes("電話／帳號") && login.includes('placeholder="91234567"') && login.includes('inputMode="tel"'), "login phone field");
assert(login.includes('autoComplete="current-password"'), "current password");
assert(login.includes("尚未有帳號？註冊") && login.includes("已有帳號？登入"), "mode links");
assert(login.includes("確認密碼") && login.includes("maxLength={24}"), "register fields");
assert(login.includes("我同意") && login.includes("服務條款") && login.includes("私隱政策") && login.includes("新用戶須剔選"), "terms copy");
assert(!login.includes("enterDemo") && !login.includes("DEMO_CODE"), "demo footer not in the form");

const page = readFileSync(new URL("../app/login/page.tsx", import.meta.url), "utf8");
assert(page.includes("max-w-md") && page.includes("<LoginForm"), "card");
assert(!page.includes("enterDemo") && !page.includes("DEMO_ACCOUNTS") && !page.includes("DEMO_CODE"), "demo footer hidden");

const auth = readFileSync(new URL("../actions/auth.ts", import.meta.url), "utf8");
assert(auth.includes("export async function enterDemo"), "enterDemo stays");
assert(auth.includes("export async function requestPhoneOtp") && auth.includes("export async function confirmPhone"), "me phone otp stays");
assert(!auth.includes("export async function verifyOtp"), "otp login action is gone");
assert(auth.includes('redirect("/admin")') && auth.includes("phoneVerified: false"), "admin goes to /admin; register does not skip phone verify");
assert(auth.includes('role: "USER"'), "register creates a user");

const seed = readFileSync(new URL("./seed-demo.ts", import.meta.url), "utf8");
assert(seed.includes("ADMIN_PASSWORD") && seed.includes("passwordHash") && seed.includes("PASSWORD_MIN"), "seed hashes the admin password from the env");

hashPassword("correct-horse")
  .then(async (hash) => {
    assert(hash.startsWith("$2"), "bcrypt hash");
    assert(await passwordMatches("correct-horse", hash), "match");
    assert(!(await passwordMatches("wrong-horse-1", hash)), "mismatch");
    assert(!(await passwordMatches("correct-horse", null)), "missing hash fails");
    assert(!(await passwordMatches("correct-horse", "")), "blank hash fails");
    console.log("credentials ok");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
