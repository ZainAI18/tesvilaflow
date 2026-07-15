"use client";

import Image from "next/image";
import { Eye, EyeOff, LockKeyhole, User } from "lucide-react";
import { FormEvent, useState } from "react";
import logo from "../../Logo original remove background.png";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Invalid username or password.");
      window.location.replace("/");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Invalid username or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand">
          <Image src={logo} alt="TESVILA" priority />
          <div><strong>TESVILA</strong><span>Operations Suite</span></div>
        </div>
        <div className="login-copy">
          <h1 id="login-title">Welcome back</h1>
          <p>Sign in to continue to the operations suite.</p>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="username">Username</label>
          <div className="login-input"><User size={17} /><input id="username" autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} /></div>
          <label htmlFor="password">Password</label>
          <div className="login-input"><LockKeyhole size={17} /><input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button className="btn primary login-submit" type="submit" disabled={loading}>{loading ? "Signing in..." : "Log in"}</button>
        </form>
      </section>
    </main>
  );
}
