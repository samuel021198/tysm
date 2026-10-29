-- Buyer entry on a pinned thread. Null until 查詢 or 直接購買.
-- A price offer stays on the order, so 議價 does not write this column.

CREATE TYPE "ThreadIntent" AS ENUM ('INQUIRY', 'DIRECT');

ALTER TABLE "MessageThread" ADD COLUMN "intent" "ThreadIntent";
