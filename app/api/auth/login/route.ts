import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE, type SessionAccess } from "@/lib/auth-session";
import { createServerAuthClient } from "@/lib/supabase-server";

const accounts: Record<string, { emailVariable: string; access: SessionAccess }> = {
  zijian8189: { emailVariable: "AUTH_EMAIL_ZIJIAN8189", access: "full" },
  weijian8189: { emailVariable: "AUTH_EMAIL_WEIJIAN8189", access: "full" },
  "123456": { emailVariable: "AUTH_EMAIL_DASHBOARD", access: "dashboard" },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const account = accounts[username.toLowerCase()];
    if (!password || !account) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }
    const email = account ? process.env[account.emailVariable] : undefined;
    const auth = createServerAuthClient();
    if (!auth || !email) {
      return NextResponse.json({ error: "Login is not configured. Please contact the administrator." }, { status: 503 });
    }
    const { error } = await auth.auth.signInWithPassword({ email, password });
    if (error) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }
    const token = await createSessionToken(username, account.access);
    const response = NextResponse.json({ username, access: account.access });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Unable to log in. Please try again." }, { status: 500 });
  }
}
