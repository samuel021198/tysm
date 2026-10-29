"use client";

import { useEffect, useState } from "react";
import { blockUser, reportAction } from "@/actions/social";
import { tx, type Locale } from "@/lib/i18n";
import { BLOCK_CONFIRM, REPORT_NOTE_MAX, REPORT_REASONS, type ReportReason } from "@/lib/safety";

const sheet =
  "w-full max-w-lg border border-line bg-card p-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:max-w-xs md:rounded-2xl md:pb-1.5";
const row = "flex h-11 w-full items-center px-3 text-left text-sm font-medium";

export function ReportSheet({
  locale,
  targetType,
  targetId,
  next,
  onClose,
}: {
  locale: Locale;
  targetType: "USER" | "POST" | "LISTING" | "THREAD";
  targetId: string;
  next: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | "">("");

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0F172A]/40 md:items-center" onClick={onClose}>
      <form
        action={reportAction}
        role="dialog"
        aria-label={tx(locale, "舉報", "Report")}
        className={sheet}
        onClick={(event) => event.stopPropagation()}
      >
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="next" value={next} />
        {REPORT_REASONS.map((label) => (
          <label key={label} className={`${row} gap-2`}>
            <input
              type="radio"
              name="reason"
              value={label}
              required
              checked={reason === label}
              onChange={() => setReason(label)}
            />
            {label}
          </label>
        ))}
        {reason === "其他" ? (
          <input
            name="note"
            maxLength={REPORT_NOTE_MAX}
            placeholder={tx(locale, "補充（可選）", "Optional note")}
            aria-label={tx(locale, "補充（可選）", "Optional note")}
            className="field mx-3 mb-2"
          />
        ) : null}
        <button type="submit" className={`${row} font-semibold`}>
          {tx(locale, "送出", "Send")}
        </button>
      </form>
    </div>
  );
}

export function BlockButton({
  locale,
  userId,
  away,
  className,
}: {
  locale: Locale;
  userId: string;
  away: string;
  className: string;
}) {
  const sentence = tx(locale, BLOCK_CONFIRM, "After you block them, their listings and messages stay hidden.");
  return (
    <form
      action={blockUser}
      onSubmit={(event) => {
        if (!window.confirm(sentence)) event.preventDefault();
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="away" value={away} />
      <button type="submit" role="menuitem" className={className}>
        {tx(locale, "封鎖", "Block")}
      </button>
    </form>
  );
}

/** ⋯ on a profile or a chat. 舉報 opens the reason sheet. 封鎖 confirms, then hides them. */
export function PersonMenu({
  locale,
  userId,
  reportType,
  reportId,
  next,
  away,
}: {
  locale: Locale;
  userId: string;
  reportType: "USER" | "POST" | "LISTING" | "THREAD";
  reportId: string;
  next: string;
  away: string;
}) {
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="grid h-8 w-8 shrink-0 place-items-center text-base leading-none text-ink"
        aria-label={tx(locale, "更多", "More")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        ⋯
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0F172A]/40 md:items-center" onClick={() => setOpen(false)}>
          <div
            role="menu"
            aria-label={tx(locale, "更多", "More")}
            className={sheet}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              className={row}
              onClick={() => {
                setOpen(false);
                setReportOpen(true);
              }}
            >
              {tx(locale, "舉報", "Report")}
            </button>
            <BlockButton locale={locale} userId={userId} away={away} className={row} />
          </div>
        </div>
      ) : null}
      {reportOpen ? (
        <ReportSheet locale={locale} targetType={reportType} targetId={reportId} next={next} onClose={() => setReportOpen(false)} />
      ) : null}
    </>
  );
}
