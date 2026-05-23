// IDEAA-72 Phase A: device-bound unlock cookies for the asymmetric paywall.
//
// One cookie per idea (`ideaa_unlock_<ideaId>=1`). Set on two paths:
//  - submit flow (`submitIdea` server action) — the submitter's device gets
//    instant access without payment.
//  - `/api/unlock/success` route handler — after a Stripe payment the success
//    redirect lands on the buyer's device and we mint the unlock cookie there.
//
// HttpOnly so client JS can't forge it; SameSite=Lax so the cross-site Stripe
// → success-URL redirect still sends the cookie back when set. Cookie is the
// device-side visibility gate. The `idea_unlocks` DB row is the audit /
// conversion ground truth; multi-device unlock is Phase B.

import "server-only";

import { cookies } from "next/headers";

import { isValidIdeaId } from "@/lib/db";

const PREFIX = "ideaa_unlock_";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function unlockCookieName(ideaId: string): string {
  return `${PREFIX}${ideaId}`;
}

export async function setUnlockCookie(ideaId: string): Promise<void> {
  if (!isValidIdeaId(ideaId)) return;
  const store = await cookies();
  store.set(unlockCookieName(ideaId), "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
}

export async function hasUnlockCookie(ideaId: string): Promise<boolean> {
  if (!isValidIdeaId(ideaId)) return false;
  const store = await cookies();
  return store.get(unlockCookieName(ideaId))?.value === "1";
}
