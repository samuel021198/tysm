import { createHash, createHmac, randomBytes } from "crypto";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBase: string;
};

export function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

/** Path segments encoded once. Empty segments from a leading slash stay empty. */
export function canonicalUri(path: string): string {
  const prefixed = path.startsWith("/") ? path : `/${path}`;
  return prefixed
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function awsSigV4Authorization(input: {
  method: string;
  path: string;
  query?: string;
  headers: Record<string, string>;
  payloadHash: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
  amzDate: string;
}): string {
  const names = Object.keys(input.headers)
    .map((name) => name.toLowerCase().trim())
    .sort();
  const lookup = new Map(Object.entries(input.headers).map(([name, value]) => [name.toLowerCase().trim(), value.trim().replace(/\s+/g, " ")]));
  const canonicalHeaders = names.map((name) => `${name}:${lookup.get(name) ?? ""}\n`).join("");
  const signedHeaders = names.join(";");
  const canonical = `${input.method.toUpperCase()}\n${canonicalUri(input.path)}\n${input.query ?? ""}\n${canonicalHeaders}\n${signedHeaders}\n${input.payloadHash}`;
  const dateStamp = input.amzDate.slice(0, 8);
  const scope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${input.amzDate}\n${scope}\n${sha256Hex(canonical)}`;
  const signing = hmac(hmac(hmac(hmac(`AWS4${input.secretAccessKey}`, dateStamp), input.region), input.service), "aws4_request");
  const signature = createHmac("sha256", signing).update(stringToSign, "utf8").digest("hex");
  return `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

export function r2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  const publicBase = process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBase) return null;
  if (!publicBase.startsWith("https://")) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket, publicBase };
}

export async function putR2Object(key: string, body: Buffer, contentType: string): Promise<string> {
  const cfg = r2Config();
  if (!cfg) throw new Error("r2 unconfigured");
  const host = `${cfg.accountId}.r2.cloudflarestorage.com`;
  const path = `/${cfg.bucket}/${key}`;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const payloadHash = sha256Hex(body);
  const headers = {
    host,
    "content-type": contentType,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const authorization = awsSigV4Authorization({
    method: "PUT",
    path,
    headers,
    payloadHash,
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    region: "auto",
    service: "s3",
    amzDate,
  });
  const res = await fetch(`https://${host}${canonicalUri(path)}`, {
    method: "PUT",
    headers: {
      "content-type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      authorization,
    },
    body: new Uint8Array(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`r2 ${res.status} ${text.slice(0, 160).replace(/[\r\n]+/g, " ")}`);
  }
  return `${cfg.publicBase}/${key.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/]+={0,2})$/i;

export class PhotoStoreError extends Error {
  constructor() {
    super("photo");
    this.name = "PhotoStoreError";
  }
}

/** Decode a listing/story data URL. Rejects svg and anything `isAllowedMediaUrl` would reject. */
export function imageFromDataUrl(url: string): { body: Buffer; contentType: string } | null {
  if (url.length > 180_000) return null;
  const match = DATA_URL.exec(url);
  if (!match) return null;
  const body = Buffer.from(match[2], "base64");
  if (body.length < 8) return null;
  return { body, contentType: match[1].toLowerCase() };
}

/**
 * Persist a user upload. Data URLs go to R2 when configured.
 * Missing R2 env, https URLs, and local `/demo` paths stay as they are.
 */
export async function storeUploadedImage(url: string, folder: string): Promise<string> {
  if (!url.startsWith("data:")) return url;
  if (!r2Config()) return url;
  const image = imageFromDataUrl(url);
  if (!image) throw new PhotoStoreError();
  const ext = image.contentType.endsWith("png") ? "png" : image.contentType.endsWith("webp") ? "webp" : "jpg";
  const safe = /^[a-z0-9/_-]+$/i.test(folder) ? folder.replace(/^\/+|\/+$/g, "") : "uploads";
  const key = `${safe}/${randomBytes(12).toString("hex")}.${ext}`;
  try {
    return await putR2Object(key, image.body, image.contentType);
  } catch (error) {
    console.error("r2 upload failed", error instanceof Error ? error.message.slice(0, 160) : "error");
    throw new PhotoStoreError();
  }
}

export async function storeUploadedImages<T extends { url: string }>(photos: T[], folder: string): Promise<T[]> {
  const stored: T[] = [];
  for (const photo of photos) stored.push({ ...photo, url: await storeUploadedImage(photo.url, folder) });
  return stored;
}

/** Keep an existing public object when the source URL has not changed. */
export function keptMirroredUrl(
  prior: { imageUrl: string; sourceImageUrl: string | null } | undefined,
  source: string,
): string | null {
  const cfg = r2Config();
  if (!cfg || !prior) return null;
  if (prior.sourceImageUrl !== source) return null;
  return prior.imageUrl.startsWith(`${cfg.publicBase}/`) ? prior.imageUrl : null;
}

export function catalogObjectKey(game: string, externalId: string, ext: string): string {
  const folder =
    game === "ONE_PIECE" ? "one-piece" : game === "RIFTBOUND" ? "riftbound" : game === "TOPPS_BASKETBALL" || game === "TOPPS_SOCCER" ? "topps" : game === "DEMO" ? "demo" : "pokemon";
  const safe = externalId.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return `dex/${folder}/${safe}.${ext}`;
}
