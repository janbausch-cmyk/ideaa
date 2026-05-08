import "server-only";

import { cookies } from "next/headers";

export const ADMIN_COOKIE = "ideaa_admin_session";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function getExpectedAdminToken(): string | null {
  const t = process.env.ADMIN_TOKEN;
  return t && t.length > 0 ? t : null;
}

export function isValidAdminToken(token: string | null | undefined): boolean {
  const expected = getExpectedAdminToken();
  if (!expected) return false;
  if (!token) return false;
  return timingSafeEqual(token, expected);
}

/**
 * Reads the admin session cookie and validates it against ADMIN_TOKEN.
 * Returns true only when ADMIN_TOKEN is set AND the cookie matches.
 * If ADMIN_TOKEN is not configured, the admin UI is locked closed.
 */
export async function isAdminAuthenticated(): Promise<boolean> {
  const expected = getExpectedAdminToken();
  if (!expected) return false;
  const store = await cookies();
  const cookie = store.get(ADMIN_COOKIE);
  return isValidAdminToken(cookie?.value);
}

/**
 * Validates a request that uses either the admin cookie OR an
 * `Authorization: Bearer <ADMIN_TOKEN>` header. Used by /api/admin/* routes.
 */
export async function isAdminRequestAuthorized(req: Request): Promise<boolean> {
  if (await isAdminAuthenticated()) return true;
  const header = req.headers.get("authorization");
  const presented = header?.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : null;
  return isValidAdminToken(presented);
}
