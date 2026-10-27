-- Wishlist saves for posts. Listing wishlist stays on Favorite.

CREATE TABLE "PostSave" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostSave_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PostSave_userId_postId_key" ON "PostSave"("userId", "postId");
CREATE INDEX "PostSave_postId_idx" ON "PostSave"("postId");

ALTER TABLE "PostSave" ADD CONSTRAINT "PostSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostSave" ADD CONSTRAINT "PostSave_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
