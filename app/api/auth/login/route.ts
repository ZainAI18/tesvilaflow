import { NextRequest, NextResponse } from "next/server";
import { createSessionToken } from "@/lib/auth-session";
import { createServerAuthClient, createServerDatabase } from "@/lib/supabase-server";

const accounts: Record<string, { emailVariable: string; displayName: string }> = {
  zijian8189: { emailVariable: "AUTH_EMAIL_ZIJIAN8189", displayName: "Zi Jian" },
  weijian8189: { emailVariable: "AUTH_EMAIL_WEIJIAN8189", displayName: "Wei Jian" },
  "123456": { emailVariable: "AUTH_EMAIL_DASHBOARD", displayName: "123456" },
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
      role: "admin",
      active: true,
      updated_at: new Date().toISOString(),
    });
    if (profileError) return NextResponse.json({ error: "Unable to prepare this account." }, { status: 500 });
    const token = await createSessionToken(username, data.user.id, account.displayName);
    return NextResponse.json({
      token,
      username,
      userId: data.user.id,
      displayName: account.displayName,
      access: "full",
    });
  } catch {
    return NextResponse.json({ error: "Unable to log in. Please try again." }, { status: 500 });
  }
}
