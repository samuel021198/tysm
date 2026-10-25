export const SHIP_METHODS = ["SF_COD", "MEET", "PICKUP"] as const;
export type ShipMethod = (typeof SHIP_METHODS)[number];

export type ShipChoice = {
  shipSfCod: boolean;
  shipMeetup: boolean;
  shipPickup: boolean;
};

export type MeetupSnap = {
  listingId: string;
  title: string;
  district: string;
  window: string | null;
  notes: string | null;
};

export type StoreSnap = {
  name: string | null;
  district: string;
  line1: string;
  hours: string | null;
};

export type FulfillmentSnap = {
  method: ShipMethod;
  meetups: MeetupSnap[];
  store: StoreSnap | null;
};

type StoreSource = {
  storeName?: string | null;
  storeDistrict?: string | null;
  storeLine1?: string | null;
  storeHours?: string | null;
};

export function hasStoreAddress(user: StoreSource | null | undefined): boolean {
  return Boolean(user?.storeDistrict?.trim() && user?.storeLine1?.trim());
}

export function enabledMethods(listing: ShipChoice): ShipMethod[] {
  const methods: ShipMethod[] = [];
  if (listing.shipSfCod) methods.push("SF_COD");
  if (listing.shipMeetup) methods.push("MEET");
  if (listing.shipPickup) methods.push("PICKUP");
  return methods;
}

/** Pickup is offered only while the seller profile still has a shop address. */
export function offeredMethods(listing: ShipChoice, storeReady: boolean): ShipMethod[] {
  return enabledMethods(listing).filter((method) => method !== "PICKUP" || storeReady);
}

/** Same-seller checkout can use only methods every listing in the group offers. */
export function intersectOffered(rows: { choice: ShipChoice; storeReady: boolean }[]): ShipMethod[] {
  if (!rows.length) return [];
  const sets = rows.map((row) => new Set(offeredMethods(row.choice, row.storeReady)));
  return SHIP_METHODS.filter((method) => sets.every((set) => set.has(method)));
}

export function parseShipMethod(value: string | null | undefined): ShipMethod | null {
  if (value === "SF_COD" || value === "MEET" || value === "PICKUP") return value;
  return null;
}

export function needsBuyerAddress(method: string | null | undefined): boolean {
  return method === "SF_COD" || method === "SF" || method === "LOCKER";
}

/** Platform fee is always HK$0. Prepaid SF / locker amounts are not collected. */
export function shipFee(_listing?: unknown, _method?: string): number {
  return 0;
}

export function shipDays(
  listing: { shippingDays: number; stockType?: string | null; preorderShipDate?: Date | null },
  method: string,
  now = new Date(),
): number {
  if (method === "MEET" || method === "PICKUP") return 1;
  if (listing.stockType === "PREORDER" && listing.preorderShipDate) {
    const days = Math.ceil((listing.preorderShipDate.getTime() - now.getTime()) / 86400000);
    return Math.max(1, days);
  }
  if (method === "LOCKER") return Math.min(30, Math.max(1, listing.shippingDays + 1));
  return Math.max(1, listing.shippingDays || 1);
}

export function shipMethodLabel(method: string, locale: "zh-HK" | "en"): string {
  const zh: Record<string, string> = {
    SF_COD: "順豐到付",
    MEET: "面交",
    PICKUP: "店舖自取",
    SF: "順豐速運",
    LOCKER: "順豐智能櫃",
  };
  const en: Record<string, string> = {
    SF_COD: "SF cash on delivery",
    MEET: "Meet-up",
    PICKUP: "Store pickup",
    SF: "SF Express",
    LOCKER: "SF locker",
  };
  const table = locale === "en" ? en : zh;
  return table[method] ?? (locale === "en" ? "Shipping" : "運送");
}

export function methodHint(method: ShipMethod, locale: "zh-HK" | "en"): string {
  if (method === "SF_COD") {
    return locale === "en"
      ? "Platform fee HK$0. You pay SF Express when the parcel arrives."
      : "平台運費 HK$0。貨到時先向順豐付款。";
  }
  if (method === "MEET") {
    return locale === "en" ? "Meet in the seller's district. Platform fee HK$0." : "喺賣家指定地區面交。平台運費 HK$0。";
  }
  return locale === "en" ? "Pick up at the seller's shop. Platform fee HK$0." : "到賣家店舖取貨。平台運費 HK$0。";
}

export function courierFor(method: string): string {
  if (method === "MEET") return "面交";
  if (method === "PICKUP") return "店舖自取";
  if (method === "LOCKER") return "順豐智能櫃";
  if (method === "SF_COD") return "順豐到付";
  return "順豐速運";
}

export function mockTracking(orderId: string, method: string): string {
  if (method === "MEET") return "MEETUP";
  if (method === "PICKUP") return "PICKUP";
  let n = 0;
  for (const char of orderId) n = (n * 33 + char.charCodeAt(0)) % 100000000;
  const digits = String(n).padStart(8, "0");
  return method === "LOCKER" ? `EF${digits}HK` : `SF${digits}HK`;
}

export function buildFulfillment(
  method: ShipMethod,
  lines: { id: string; title: string; meetupDistrict: string | null; meetupWindow: string | null; meetupNotes: string | null }[],
  store: StoreSource | null,
): FulfillmentSnap | null {
  if (method === "SF_COD") return { method, meetups: [], store: null };
  if (method === "MEET") {
    const meetups: MeetupSnap[] = lines.map((line) => ({
      listingId: line.id,
      title: line.title,
      district: line.meetupDistrict?.trim() || "",
      window: line.meetupWindow?.trim() || null,
      notes: line.meetupNotes?.trim() || null,
    }));
    if (meetups.some((row) => !row.district)) return null;
    return { method, meetups, store: null };
  }
  const district = store?.storeDistrict?.trim() || "";
  const line1 = store?.storeLine1?.trim() || "";
  if (!district || !line1) return null;
  return {
    method,
    meetups: [],
    store: {
      name: store?.storeName?.trim() || null,
      district,
      line1,
      hours: store?.storeHours?.trim() || null,
    },
  };
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function readFulfillment(value: unknown): FulfillmentSnap | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { method?: unknown; meetups?: unknown; store?: unknown };
  const method = parseShipMethod(typeof row.method === "string" ? row.method : null);
  if (!method) return null;
  const meetups: MeetupSnap[] = [];
  if (Array.isArray(row.meetups)) {
    for (const item of row.meetups) {
      if (!item || typeof item !== "object") continue;
      const meetup = item as Record<string, unknown>;
      const district = text(meetup.district);
      if (!district) continue;
      meetups.push({
        listingId: text(meetup.listingId) || "",
        title: text(meetup.title) || "",
        district,
        window: text(meetup.window),
        notes: text(meetup.notes),
      });
    }
  }
  let shop: StoreSnap | null = null;
  if (row.store && typeof row.store === "object") {
    const source = row.store as Record<string, unknown>;
    const district = text(source.district);
    const line1 = text(source.line1);
    if (district && line1) shop = { name: text(source.name), district, line1, hours: text(source.hours) };
  }
  return { method, meetups, store: shop };
}

export function describeShip(locale: "zh-HK" | "en", method: string | null, fulfillment: unknown): string[] {
  const snap = readFulfillment(fulfillment);
  const chosen = method || snap?.method || "";
  if (!chosen) return [locale === "en" ? "No shipping method yet." : "未選擇運送方式。"];
  const lines = [shipMethodLabel(chosen, locale)];
  if (chosen === "SF_COD") {
    lines.push(
      locale === "en"
        ? "Platform shipping is HK$0. Pay SF Express when the parcel arrives."
        : "平台運費 HK$0。買家收貨時向順豐支付運費，平台不會代收。",
    );
    return lines;
  }
  if (chosen === "MEET") {
    const meetups = snap?.meetups ?? [];
    if (!meetups.length) {
      lines.push(locale === "en" ? "Arrange the handover with the seller. Platform fee HK$0." : "請同賣家約面交。平台運費 HK$0。");
      return lines;
    }
    const seen = new Set<string>();
    for (const meetup of meetups) {
      const key = `${meetup.district}|${meetup.window || ""}|${meetup.notes || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const extra = [meetup.window, meetup.notes].filter(Boolean).join(" · ");
      const place = extra ? `${meetup.district} · ${extra}` : meetup.district;
      lines.push(meetups.length > 1 && meetup.title ? `${meetup.title}：${place}` : place);
    }
    lines.push(locale === "en" ? "Platform shipping is HK$0." : "平台運費 HK$0。");
    return lines;
  }
  if (chosen === "PICKUP") {
    if (snap?.store) {
      const shop = snap.store;
      lines.push([shop.name, `${shop.district} ${shop.line1}`].filter(Boolean).join(" · "));
      if (shop.hours) lines.push(shop.hours);
    }
    lines.push(locale === "en" ? "Platform shipping is HK$0. Collect the card at the shop." : "平台運費 HK$0。請到店舖取貨。");
    return lines;
  }
  if (chosen === "SF" || chosen === "LOCKER") {
    lines.push(locale === "en" ? "This order used the old prepaid courier fee." : "此訂單沿用舊有預付運費。");
  }
  return lines;
}

export function onTimePercent(orders: { shippedAt: Date | null; shipBy: Date | null }[]): number | null {
  const judged = orders.filter((order) => order.shippedAt && order.shipBy);
  if (!judged.length) return null;
  const onTime = judged.filter((order) => order.shippedAt! <= order.shipBy!).length;
  return Math.round((onTime / judged.length) * 100);
}
