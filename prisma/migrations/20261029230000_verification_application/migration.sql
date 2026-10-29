-- Seller verification applications. The name pill stays on User.verificationTier.
-- One PENDING row per user. Review is POST /api/internal/verification, not a public screen.
-- ponytail: documentUrl uses the public image store. A private bucket is the upgrade if the file must not be on the public base URL.

CREATE TYPE "VerificationTrack" AS ENUM ('TRUSTED', 'MERCHANT');

CREATE TYPE "VerificationApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "VerificationApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "track" "VerificationTrack" NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "VerificationApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "VerificationApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VerificationApplication_userId_status_idx" ON "VerificationApplication"("userId", "status");

CREATE INDEX "VerificationApplication_status_createdAt_idx" ON "VerificationApplication"("status", "createdAt");

CREATE UNIQUE INDEX "VerificationApplication_one_pending_per_user" ON "VerificationApplication"("userId") WHERE "status" = 'PENDING';

ALTER TABLE "VerificationApplication" ADD CONSTRAINT "VerificationApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
