import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { OAuth2Client } from "google-auth-library";
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

import { prisma } from "./db";

const derivePassword = (password: string, salt: Buffer) => new Promise<Buffer>((resolve, reject) => {
  scryptCallback(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, derived) => error ? reject(error) : resolve(derived));
});
const COOKIE_NAME = "camp_session";
const HASH_PREFIX = "scrypt:v1:16384:";
const encoder = new TextEncoder();
function signingKey() {
  const key = process.env.AUTH_SECRET || (process.env.NODE_ENV !== "production" ? process.env.JWT_SECRET : undefined);
  if (!key || key.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters");
  return encoder.encode(key);
}
function legacyKey() {
  const key = process.env.LEGACY_PASSWORD_SECRET || process.env.JWT_SECRET;
  if (!key) throw new Error("Legacy authentication secret is not configured");
  return key;
}

export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
  organizationId?: string;
  iat?: number;
  exp?: number;
}

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function signToken(payload: Omit<JWTPayload, "iat" | "exp">): Promise<string> {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(signingKey());
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey());
    return payload as unknown as JWTPayload;
  } catch {
    // Keep sessions signed with the previous key valid until their existing expiry.
    try {
      const { payload } = await jwtVerify(token, encoder.encode(legacyKey()), { algorithms: ["HS256"] });
      return payload as unknown as JWTPayload;
    } catch {
      return null;
    }
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(32);
  const derived = await derivePassword(password, salt);
  return `${HASH_PREFIX}${salt.toString("base64url")}:${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (hash.startsWith(HASH_PREFIX)) {
    const parts = hash.slice(HASH_PREFIX.length).split(":");
    if (parts.length !== 2 || !/^[A-Za-z0-9_-]{43}$/.test(parts[0]) || !/^[A-Za-z0-9_-]{86}$/.test(parts[1])) return false;
    const actual = Buffer.from(parts[1], "base64url");
    const derived = await derivePassword(password, Buffer.from(parts[0], "base64url"));
    return actual.length === derived.length && timingSafeEqual(actual, derived);
  }
  // Legacy HMAC was keyed with JWT_SECRET. Only use it to authenticate old accounts,
  // then upgrade the hash on successful login; never issue another legacy hash.
  if (!/^[A-Za-z0-9+/]{43}=$/.test(hash)) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = createHmac("sha256", legacyKey()).update(password).digest();
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function verifyGoogleToken(credential: string): Promise<{
  email: string;
  name: string;
  picture: string;
  sub: string;
} | null> {
  if (!process.env.GOOGLE_CLIENT_ID) return null;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified) return null;
    return {
      email: payload.email,
      name: payload.name || payload.email.split("@")[0],
      picture: payload.picture || "",
      sub: payload.sub,
    };
  } catch {
    return null;
  }
}

export { prisma };
