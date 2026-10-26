-- Post reports, and a viewer-only hide that does not delete the post or listing.

ALTER TYPE "ReportTarget" ADD VALUE 'POST';

CREATE TABLE "FeedHide" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedHide_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeedHide_userId_targetType_targetId_key" ON "FeedHide"("userId", "targetType", "targetId");
CREATE INDEX "FeedHide_userId_targetType_idx" ON "FeedHide"("userId", "targetType");

ALTER TABLE "FeedHide" ADD CONSTRAINT "FeedHide_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
