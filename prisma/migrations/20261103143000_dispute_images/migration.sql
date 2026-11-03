-- Photos attached when a buyer or seller taps 有問題. Older rows stay empty.

ALTER TABLE "Dispute" ADD COLUMN "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
