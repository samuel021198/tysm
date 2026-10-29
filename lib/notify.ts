export type NoticeKind =
  | "offer-new"
  | "offer-supersede"
  | "offer-accept"
  | "offer-decline"
  | "offer-withdraw"
  | "handover"
  | "message";

export type NoticeType = "bid" | "offer" | "order" | "message" | "review";

function line(detail: string | undefined, fallback: string): string {
  const text = detail?.replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > 80 ? `${text.slice(0, 79)}…` : text;
}

/** Inbox copy for the locked triggers. Category type drives the settings toggle. */
export function noticeCopy(kind: NoticeKind, detail?: string): { type: NoticeType; title: string; body: string } {
  switch (kind) {
    case "offer-new":
      return { type: "offer", title: "新要約", body: line(detail, "對方提出咗要約。") };
    case "offer-supersede":
      return { type: "offer", title: "改價覆蓋", body: line(detail, "對方改咗要約。") };
    case "offer-accept":
      return { type: "offer", title: "對方已接受", body: line(detail, "要約已接受。") };
    case "offer-decline":
      return { type: "offer", title: "對方已拒絕", body: line(detail, "要約已被拒絕。") };
    case "offer-withdraw":
      return { type: "offer", title: "對方已撤回", body: line(detail, "要約已撤回。") };
    case "handover":
      return { type: "order", title: "待交收提醒", body: line(detail, "可以安排交收。") };
    case "message":
      return { type: "message", title: "新訊息", body: line(detail, "新訊息") };
  }
}

/** Deal thread when one exists. Otherwise the footprint list. */
export function noticeHref(threadId: string | null | undefined): string {
  return threadId ? `/messages/${threadId}` : "/me/footprint";
}

/** Only same-app paths. A bad href stays on the inbox. */
export function notificationTarget(href: string | null | undefined): string {
  if (!href || !href.startsWith("/") || href.startsWith("//") || href.includes("\\") || href.includes("://")) return "/notifications";
  return href;
}
