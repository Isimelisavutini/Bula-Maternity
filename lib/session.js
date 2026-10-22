import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "carefiji_session";
const DEMO_SESSION_SECRET = "carefiji-bula-maternity-public-demo-v1";

function secret() {
  return process.env.SESSION_SECRET || DEMO_SESSION_SECRET;
}

function signature(payload) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export async function createSession(user) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, name: user.name, role: user.role, expires: Date.now() + 8 * 60 * 60 * 1000 })).toString("base64url");
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${signature(payload)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 8 * 60 * 60 });
}

export async function readSession() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const [payload, supplied] = value.split(".");
  if (!payload || !supplied) return null;
  const expected = signature(payload);
  if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString());
    return session.expires > Date.now() ? session : null;
  } catch {
    return null;
  }
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}
