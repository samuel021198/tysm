export const TEXT_COLORS = ["#ffffff", "#1b1418", "#c498b2", "#7cb9c8", "#f2c14e"] as const;

export const STORY_EMOJIS = ["🔥", "⭐", "❤️", "😭", "😍", "👍", "🃏", "✨", "💎", "🏆", "😎", "🫶", "💯", "😮", "🐉", "⚡"] as const;

export type StoryText = { id: string; kind: "text"; text: string; x: number; y: number; color: string };
export type StorySticker = { id: string; kind: "sticker"; emoji: string; x: number; y: number; scale: number };
export type StoryLayer = StoryText | StorySticker;

export function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(96, Math.max(4, value));
}

export function clampScale(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(2.6, Math.max(0.6, Math.round(value * 10) / 10));
}

/** Object-contain box inside a stage, so a drag maps onto the photo rather than the letterbox. */
export function containRect(stageW: number, stageH: number, imgW: number, imgH: number) {
  if (!(stageW > 0) || !(stageH > 0) || !(imgW > 0) || !(imgH > 0)) return { x: 0, y: 0, w: stageW, h: stageH };
  const scale = Math.min(stageW / imgW, stageH / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  return { x: (stageW - w) / 2, y: (stageH - h) / 2, w, h };
}
