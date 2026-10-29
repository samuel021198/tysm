"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PhotoStoreError, storeVerificationDocument } from "@/lib/r2";
import { privateDocKey, submitApplication } from "@/lib/verification";

const nextPath = "/me/settings/verify";

export async function applyVerification(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${nextPath}`);
  const pending = await prisma.verificationApplication.findFirst({
    where: { userId: viewer.id, status: "PENDING" },
    select: { id: true },
  });
  const parsed = submitApplication({
    pending: Boolean(pending),
    track: formData.get("track"),
    documentUrl: formData.get("documentUrl"),
    reason: formData.get("reason"),
  });
  if (!parsed.ok) redirect(`${nextPath}?err=${parsed.error}`);
  let stored: string;
  try {
    stored = await storeVerificationDocument(parsed.draft.documentUrl);
  } catch (error) {
    if (error instanceof PhotoStoreError) redirect(`${nextPath}?err=${error.code}`);
    throw error;
  }
  if (!privateDocKey(stored)) redirect(`${nextPath}?err=verify_photo`);
  try {
    await prisma.verificationApplication.create({
      data: {
        userId: viewer.id,
        track: parsed.draft.track,
        documentUrl: stored,
        reason: parsed.draft.reason,
        status: parsed.draft.status,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect(`${nextPath}?err=verify_pending`);
    }
    throw error;
  }
  revalidatePath(nextPath);
  redirect(`${nextPath}?ok=verify`);
}
