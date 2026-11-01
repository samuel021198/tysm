-- Password login. Null until the account sets one.
-- The admin hash is applied from ADMIN_PASSWORD at seed or bootstrap, never stored in this file.
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
