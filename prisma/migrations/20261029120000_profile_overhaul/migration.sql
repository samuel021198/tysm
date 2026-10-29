-- Public profile: @username, handover area, links, interest tags.
-- UsernameChange is the 2-per-30-days history. Street addresses stay off these columns.

ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "handoverPlace" TEXT;
ALTER TABLE "User" ADD COLUMN "profileLinks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN "interestTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

CREATE TABLE "UsernameChange" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsernameChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UsernameChange_userId_createdAt_idx" ON "UsernameChange"("userId", "createdAt");

ALTER TABLE "UsernameChange" ADD CONSTRAINT "UsernameChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
