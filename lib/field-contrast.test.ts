import { readFileSync } from "fs";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function channel(c: number) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function lum(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

function contrast(a: string, b: string) {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function vars(css: string, selector: string) {
  const start = css.indexOf("{", css.indexOf(selector));
  const body = css.slice(start + 1, css.indexOf("}", start));
  const out: Record<string, string> = {};
  for (const match of body.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})/g)) out[match[1]] = match[2].toLowerCase();
  return out;
}

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const field = css.slice(css.indexOf(".field {"), css.indexOf(".btn {"));

assert(!field.includes("bg-soft") && !field.includes("border-0"), "field fill must not fall back to the page wash");
assert(field.includes("var(--field-border)") && field.includes("var(--field-focus)"), "field border and focus use the contrast tokens");

for (const [name, selector] of [["light", ":root"], ["dark", ".dark"]] as const) {
  const token = vars(css, selector);
  const page = token["--bg"];
  const fill = token["--field"];
  assert(contrast(token["--field-border"], page) >= 3, `${name} border vs page`);
  assert(contrast(token["--field-border"], fill) >= 3, `${name} border vs fill`);
  assert(contrast(token["--field-placeholder"], fill) >= 4.5, `${name} placeholder`);
  assert(contrast(token["--ink"], fill) >= 4.5, `${name} value text`);
  assert(contrast(token["--field-focus"], page) >= 3, `${name} focus vs page`);
  assert(contrast(token["--muted"], fill) >= 4.5, `${name} disabled text`);
  assert(fill !== token["--soft"], `${name} fill is not --soft`);
}

console.log("field contrast ok");
