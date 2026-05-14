/**
 * Self-hosted auth helpers — replaces the Manus OAuth SDK.
 * Provides JWT session signing and verification only.
 */
import { ONE_YEAR_MS } from "@shared/const";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env";

const SESSION_COOKIE = "aegis_session";

function getSecret() {
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function signSession(userId: number, username: string): Promise<string> {
  const issuedAt = Date.now();
  const expiresInMs = ONE_YEAR_MS;
  const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
  return new SignJWT({ username })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(userId))
    .setExpirationTime(expirationSeconds)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<{ userId: number; username: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    const userId = payload.sub ? parseInt(payload.sub, 10) : null;
    const username = typeof payload.username === "string" ? payload.username : null;
    if (!userId || !username) return null;
    return { userId, username };
  } catch {
    return null;
  }
}

export { SESSION_COOKIE };
