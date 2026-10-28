-- One-time private handover ack on 提出要約. Signup terms stay on termsAcceptedAt.

ALTER TABLE "User" ADD COLUMN "p2pRiskAckAt" TIMESTAMP(3);
