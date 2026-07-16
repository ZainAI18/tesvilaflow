import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, type SessionAccess } from "@/lib/auth-session";
import { createServerAuthClient, createServerDatabase } from "@/lib/supabase-server";

const accounts: Record<string, { emailVariable: string; displayName: string; access: SessionAccess }> = {
  zijian8189: { emailVariable: "AUTH_EMAIL_ZIJIAN8189", displayName: "Zi Jian", access: "full" },
  weijian8189: { emailVariable: "AUTH_EMAIL_WEIJIAN8189", displayName: "Wei Jian", access: "full" },
  "123456": { emailVariable: "AUTH_EMAIL_DASHBOARD", displayName: "123456", access: "warehouse" },
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
    const { data, error } = await auth.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }
    const db = createServerDatabase();
    if (!db) return NextResponse.json({ error: "Login is not configured. Please contact the administrator." }, { status: 503 });
    const { error: profileError } = await db.from("users").upsert({
      id: data.user.id,
      full_name: account.displayName,
      email,
      role: account.access === "warehouse" ? "warehouse" : "admin",
      active: true,
      updated_at: new Date().toISOString(),
    });
    if (profileError) return NextResponse.json({ error: "Unable to prepare this account." }, { status: 500 });
    const token = await createSessionToken(username, data.user.id, account.displayName, account.access);
    return NextResponse.json({
      token,
      username,
      userId: data.user.id,
      displayName: account.displayName,
      access: account.access,
    });
  } catch {
    return NextResponse.json({ error: "Unable to log in. Please try again." }, { status: 500 });
  }
}
