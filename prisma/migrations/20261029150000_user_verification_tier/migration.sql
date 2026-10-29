-- Profile verification pill. NORMAL is the quiet default (no badge).
-- Submission of HKID or business registration is not part of this column.

CREATE TYPE "VerificationTier" AS ENUM ('NORMAL', 'TRUSTED', 'MERCHANT');

ALTER TABLE "User" ADD COLUMN "verificationTier" "VerificationTier" NOT NULL DEFAULT 'NORMAL';
