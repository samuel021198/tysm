"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { deletePost, hideFromFeed } from "@/actions/collect";
import { tx, type Locale } from "@/lib/i18n";
import { hideTarget, postEditHref, postMenuFlags, POST_MENU_ORDER, reportTarget, type PostMenuAction } from "@/lib/posts";
import { blockAway } from "@/lib/safety";
import { BlockButton, ReportSheet } from "./safety-menu";
import { ShareSheet } from "./share-button";
import { useHoldSwipe } from "./use-hold-swipe";

export function PostMenu({
  locale,
  postId,
  listingId,
  own,
  loggedIn,
  userId = null,
  sharePath,
  next,
  corner = "right",
  button = true,
  swipeRightFormId,
  children,
}: {
  locale: Locale;
  postId: string | null;
  listingId: string | null;
  own: boolean;
  loggedIn: boolean;
  /** Author to block. Omitted on a card that has no person. */
  userId?: string | null;
  sharePath: string;
  next: string;
  corner?: "left" | "right";
  button?: boolean;
  /** Existing like or favorite form. Swipe right submits it. */
  swipeRightFormId?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const flags = postMenuFlags({ own, loggedIn, postId, listingId, userId });
  const editHref = postEditHref(postId, listingId);
  const report = reportTarget(postId, listingId);
  const hide = hideTarget(postId, listingId);
  const labels: Record<PostMenuAction, string> = {
    delete: tx(locale, "剷除", "Remove"),
    share: tx(locale, "分享", "Share"),
    hide: tx(locale, "隱藏", "Hide"),
    report: tx(locale, "舉報", "Report"),
    block: tx(locale, "封鎖", "Block"),
    edit: tx(locale, "編輯", "Edit"),
  };
  const confirmLabel = tx(
    locale,
    "刪除這則貼文？留言同讚好會一併刪除。My Binder 同賣場會留低。",
    "Delete this post? Comments and likes are removed. My Binder and any listing stay.",
  );
  const row = "flex h-11 w-full items-center px-3 text-left text-sm font-medium disabled:text-muted";

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function openMenu() {
    setOpen(true);
  }

  const gesture = useHoldSwipe({
    onLongPress: openMenu,
    onSwipeLeft: openMenu,
    onSwipeRight: swipeRightFormId
      ? () => {
          const form = document.getElementById(swipeRightFormId);
          if (form instanceof HTMLFormElement) form.requestSubmit();
        }
      : undefined,
    edgeGuard: true,
  });

  function item(action: PostMenuAction) {
    if (action === "share") {
      return (
        <button
          key={action}
          type="button"
          role="menuitem"
          className={row}
          onClick={() => {
            setOpen(false);
            setShareOpen(true);
          }}
        >
          {labels.share}
        </button>
      );
    }
    if (action === "delete") {
      if (!flags.delete || !postId) return <button key={action} type="button" role="menuitem" className={row} disabled>{labels.delete}</button>;
      return (
        <form
          key={action}
          action={deletePost}
          onSubmit={(event) => {
            if (!window.confirm(confirmLabel)) event.preventDefault();
          }}
        >
          <input type="hidden" name="postId" value={postId} />
          <button type="submit" role="menuitem" className={`${row} text-danger`}>
            {labels.delete}
          </button>
        </form>
      );
    }
    if (action === "hide") {
      if (!flags.hide || !hide) return <button key={action} type="button" role="menuitem" className={row} disabled>{labels.hide}</button>;
      return (
        <form key={action} action={hideFromFeed}>
          <input type="hidden" name="targetType" value={hide.type} />
          <input type="hidden" name="targetId" value={hide.id} />
          <input type="hidden" name="next" value={next} />
          <button type="submit" role="menuitem" className={row}>
            {labels.hide}
          </button>
        </form>
      );
    }
    if (action === "report" || action === "block") {
      if (own) return null;
    }
    if (action === "report") {
      if (!flags.report || !report) return <button key={action} type="button" role="menuitem" className={row} disabled>{labels.report}</button>;
      return (
        <button
          key={action}
          type="button"
          role="menuitem"
          className={row}
          onClick={() => {
            setOpen(false);
            setReportOpen(true);
          }}
        >
          {labels.report}
        </button>
      );
    }
    if (action === "block") {
      if (!flags.block || !userId) return <button key={action} type="button" role="menuitem" className={row} disabled>{labels.block}</button>;
      return <BlockButton key={action} locale={locale} userId={userId} away={blockAway(next, userId)} className={row} />;
    }
    if (!flags.edit || !editHref) return <button key={action} type="button" role="menuitem" className={row} disabled>{labels.edit}</button>;
    return (
      <Link key={action} href={editHref} role="menuitem" className={row}>
        {labels.edit}
      </Link>
    );
  }

  const trigger =
    corner === "left"
      ? "absolute left-1 top-1 z-10 grid h-6 w-6 place-items-center bg-card text-sm leading-none text-ink"
      : "absolute right-1.5 top-2 z-10 grid h-7 w-7 place-items-center text-base leading-none text-ink";

  return (
    <div
      className="relative w-full min-w-0 max-w-full"
      data-card-swipe=""
      {...gesture}
      onContextMenu={(event) => {
        event.preventDefault();
        openMenu();
      }}
    >
      {children}
      {button ? (
        <button
          type="button"
          className={trigger}
          aria-label={tx(locale, "更多", "More")}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen(true);
          }}
        >
          ⋯
        </button>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0F172A]/40 md:items-center" onClick={() => setOpen(false)}>
          <div
            role="menu"
            aria-label={tx(locale, "更多", "More")}
            className="w-full max-w-lg border border-line bg-card p-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:max-w-xs md:rounded-2xl md:pb-1.5"
            onClick={(event) => event.stopPropagation()}
          >
            {POST_MENU_ORDER.map(item)}
          </div>
        </div>
      ) : null}
      {reportOpen && report ? (
        <ReportSheet locale={locale} targetType={report.type} targetId={report.id} next={next} onClose={() => setReportOpen(false)} />
      ) : null}
      {shareOpen ? (
        <ShareSheet
          path={sharePath}
          label={tx(locale, "分享", "Share")}
          copiedLabel={tx(locale, "已複製", "Copied")}
          internalLabel={tx(locale, "內部分享", "In TYSM")}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
    </div>
  );
}
