-- Account ban is separate from bidBanned. Reviewer notes stay on the application.
ALTER TABLE "User" ADD COLUMN "disabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "VerificationApplication" ADD COLUMN "reviewNote" TEXT;
