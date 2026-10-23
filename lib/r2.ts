import { createHash, createHmac } from "crypto";

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
