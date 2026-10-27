-- Topics on a post. Empty array keeps older posts valid.

ALTER TABLE "Post" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "Post_tags_idx" ON "Post" USING GIN ("tags");
