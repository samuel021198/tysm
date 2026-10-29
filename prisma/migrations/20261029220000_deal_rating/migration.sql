-- Post-deal ratings. One row per party, only after the handover is completed.

CREATE TABLE "DealRating" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealRating_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DealRating_orderId_authorId_key" ON "DealRating"("orderId", "authorId");
CREATE INDEX "DealRating_subjectId_idx" ON "DealRating"("subjectId");

ALTER TABLE "DealRating" ADD CONSTRAINT "DealRating_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealRating" ADD CONSTRAINT "DealRating_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealRating" ADD CONSTRAINT "DealRating_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
