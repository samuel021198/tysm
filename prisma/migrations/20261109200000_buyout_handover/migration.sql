-- Preview deploy applied 20261109120000_buyout before that file was
-- rewritten to store handover. migrate deploy then skipped it, so the
-- live table has no handover column. Fresh databases already create it.

ALTER TABLE "Buyout" ADD COLUMN IF NOT EXISTS "handover" TEXT;
