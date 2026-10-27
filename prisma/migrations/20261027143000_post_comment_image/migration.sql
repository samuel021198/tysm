-- Optional photo or GIF on a comment. Null keeps older text-only rows.

ALTER TABLE "PostComment" ADD COLUMN "imageUrl" TEXT;
