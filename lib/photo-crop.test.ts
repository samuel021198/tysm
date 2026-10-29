import { readFileSync } from "node:fs";
import {
  LISTING_CROP_ASPECT,
  POST_CROP_ASPECT,
  clampZoom,
  cropOutputSize,
  cropView,
  quarterTurns,
} from "./photo-crop";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const square = cropOutputSize(LISTING_CROP_ASPECT);
assert(square.width === 960 && square.height === 960, "listing crop exports a 960 square");

const feed = cropOutputSize(POST_CROP_ASPECT);
assert(feed.width === 768 && feed.height === 960 && feed.width * 5 === feed.height * 4, "post crop exports 4:5");

assert(quarterTurns(1) === 1 && quarterTurns(4) === 0 && quarterTurns(-1) === 3, "turns stay on quarter steps");

const covered = cropView({
  srcWidth: 800,
  srcHeight: 500,
  turns: 0,
  frameWidth: 80,
  frameHeight: 100,
  zoom: 1,
  panX: 0,
  panY: 0,
});
assert(covered.scale === 0.2 && covered.panX === 0 && covered.panY === 0, "zoom 1 covers the frame");

const shoved = cropView({
  srcWidth: 800,
  srcHeight: 500,
  turns: 0,
  frameWidth: 80,
  frameHeight: 100,
  zoom: 1,
  panX: 999,
  panY: -999,
});
assert(shoved.panX === 40 && shoved.panY === 0, "pan cannot open a gap at the frame edge");

const turned = cropView({
  srcWidth: 400,
  srcHeight: 200,
  turns: 1,
  frameWidth: 100,
  frameHeight: 100,
  zoom: 1,
  panX: 0,
  panY: 0,
});
assert(turned.turns === 1 && turned.scale === 0.5, "a quarter turn covers using the swapped edge");
assert(clampZoom(0.2) === 1 && clampZoom(8) === 4, "zoom stays between cover and 4×");

const sell = readFileSync(new URL("../components/sell-form.tsx", import.meta.url), "utf8");
const collect = readFileSync(new URL("../components/collect-form.tsx", import.meta.url), "utf8");
const cropUi = readFileSync(new URL("../components/photo-crop.tsx", import.meta.url), "utf8");
const photoFile = readFileSync(new URL("../components/photo-file.ts", import.meta.url), "utf8");
assert(sell.includes("LISTING_CROP_ASPECT") && sell.includes("usePhotoCropQueue"), "listing compose opens the crop editor");
assert(!sell.includes("強化") && !sell.includes("enhanceDataUrl"), "listing upload no longer offers enhance");
assert(collect.includes("POST_CROP_ASPECT") && collect.includes('mode === "post"') && collect.includes("fileToDataUrl"), "posts crop; binder photos still use the plain upload");
assert(cropUi.includes("確認") && cropUi.includes("旋轉") && cropUi.includes("取消"), "crop actions stay the short cantonese labels");
assert(!cropUi.includes("強化") && !photoFile.includes("enhanceDataUrl") && !photoFile.includes("ctx.filter"), "no enhance filter remains on the upload path");

console.log("photo crop ok");
