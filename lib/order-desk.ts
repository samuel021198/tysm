import { isAllowedMediaUrl } from "./format";
import { dealPhase } from "./deal-phase";

/** Written statuses on 我的訂單. Chat phases stay on the thread. */
export const DESK_STATUSES = ["進行中", "已完成", "已取消", "爭議中"] as const;
export type DeskStatus = (typeof DESK_STATUSES)[number];

export const DESK_HINT: Record<DeskStatus, string> = {
  進行中: "雙方已落單／交收未完",
  已完成: "雙方確認交收完",
  已取消: "未完成已取消",
  爭議中: "有一方撳咗「有問題」",
};

export const DISPUTE_CHIPS = ["未收到貨", "品相不符", "交收有異", "其他（請說明）"] as const;
export type DisputeChip = (typeof DISPUTE_CHIPS)[number];
export const DISPUTE_OTHER: DisputeChip = "其他（請說明）";
export const DISPUTE_HELPER = "交收有異／未收到／品相不符，可附圖";
export const DISPUTE_IMAGE_MAX = 3;
export const DISPUTE_TEXT_MAX = 200;

const OPEN_DISPUTE = new Set(["OPEN", "APPEALED"]);

export function deskStatus(order: {
  status: string;
  fulfillment?: unknown;
  dispute?: { status: string } | null;
}): DeskStatus {
  if (order.status === "DISPUTED" || OPEN_DISPUTE.has(order.dispute?.status ?? "")) return "爭議中";
  if (order.status === "CANCELLED" || order.status === "REFUNDED") return "已取消";
  const phase = dealPhase(order);
  if (order.status === "COMPLETED" || phase === "DONE") return "已完成";
  if (phase === "CANCELLED") return "已取消";
  return "進行中";
}

export type DeskStep = { label: "下單" | "進行中" | "完結"; state: "done" | "current" | "wait" };

/** 下單 → 進行中 → 完結. A dispute stays on the middle step. */
export function deskTimeline(status: DeskStatus): DeskStep[] {
  if (status === "已完成" || status === "已取消") {
    return [
      { label: "下單", state: "done" },
      { label: "進行中", state: "done" },
      { label: "完結", state: "done" },
    ];
  }
  return [
    { label: "下單", state: "done" },
    { label: "進行中", state: "current" },
    { label: "完結", state: "wait" },
  ];
}

function oneLine(raw: string): string {
  return raw.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

/** 「其他」must be a real note, not the chip label or punctuation only. */
export function otherReasonClear(text: string): boolean {
  const trimmed = oneLine(text);
  if (!trimmed || trimmed.length > DISPUTE_TEXT_MAX) return false;
  if (trimmed === "其他" || trimmed === "請說明" || trimmed === DISPUTE_OTHER) return false;
  if ((DISPUTE_CHIPS as readonly string[]).includes(trimmed)) return false;
  return /[\p{L}\p{N}]/u.test(trimmed);
}

/** Chip is required. Short text is required for every chip. */
export function disputeReport(
  chip: string,
  text: string,
): { ok: true; reason: string } | { ok: false; error: "issue" } {
  if (!(DISPUTE_CHIPS as readonly string[]).includes(chip)) return { ok: false, error: "issue" };
  const trimmed = oneLine(text);
  if (!trimmed || trimmed.length > DISPUTE_TEXT_MAX) return { ok: false, error: "issue" };
  if (chip === DISPUTE_OTHER && !otherReasonClear(trimmed)) return { ok: false, error: "issue" };
  return { ok: true, reason: `${chip}：${trimmed}` };
}

export function disputeImageList(values: string[]): { ok: true; urls: string[] } | { ok: false; error: "photo_url" } {
  const urls = values.map((value) => value.trim()).filter(Boolean);
  if (urls.length > DISPUTE_IMAGE_MAX) return { ok: false, error: "photo_url" };
  if (urls.some((url) => !isAllowedMediaUrl(url))) return { ok: false, error: "photo_url" };
  return { ok: true, urls };
}
