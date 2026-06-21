import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "./db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "camp-creator-dev-secret-change-in-production"
);

const COOKIE_NAME = "camp_session";

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
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
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
  const key = await crypto.subtle.importKey(
    "raw",
    JWT_SECRET,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(password));
  const bytes = new Uint8Array(sig);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
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
    if (!payload?.email) return null;
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

// Keep prisma import used (suppress unused warning)
export { prisma };
