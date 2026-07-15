import { NextRequest, NextResponse } from "next/server";

export const SESSION_COOKIE = "tesvila_session";
export const SESSION_MAX_AGE = 60 * 60 * 12;

export type SessionAccess = "full" | "dashboard";

export type TesvilaSession = {
  username: string;
  access: SessionAccess;
  exp: number;
};

const encoder = new TextEncoder();

function base64UrlEncode(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signingKey() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SESSION_SECRET must contain at least 32 characters.");
  }
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createSessionToken(username: string, access: SessionAccess) {
  const payload: TesvilaSession = {
    username,
    access,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await crypto.subtle.sign("HMAC", await signingKey(), encoder.encode(encodedPayload));
  return `${encodedPayload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token?: string | null): Promise<TesvilaSession | null> {
  if (!token) return null;
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const valid = await crypto.subtle.verify(
      "HMAC",
      await signingKey(),
      base64UrlDecode(signature),
      encoder.encode(payload),
    );
    if (!valid) return null;
    const session = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as TesvilaSession;
    if (!session.username || !["full", "dashboard"].includes(session.access)) return null;
    if (session.exp <= Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export async function readRequestSession(request: NextRequest) {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
}

export async function requireApiSession(request: NextRequest, allowDashboard = false) {
  const session = await readRequestSession(request);
  if (!session) {
    return { response: NextResponse.json({ error: "Your session has expired. Please log in again." }, { status: 401 }) };
  }
  if (session.access === "dashboard" && !allowDashboard) {
    return { response: NextResponse.json({ error: "This account can only access the dashboard." }, { status: 403 }) };
  }
  return { session };
}

