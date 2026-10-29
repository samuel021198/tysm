-- Chat reports target the thread. PostgreSQL 12+ allows ADD VALUE inside the migration transaction.
-- This value is not used in this file.

ALTER TYPE "ReportTarget" ADD VALUE IF NOT EXISTS 'THREAD';
