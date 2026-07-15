import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("protects the application with a signed server session", async () => {
  const [proxy, session, login, loginPage] = await Promise.all([
    read("proxy.ts"),
    read("lib/auth-session.ts"),
    read("app/api/auth/login/route.ts"),
    read("app/login/page.tsx"),
  ]);

  assert.match(proxy, /SESSION_COOKIE/);
  assert.match(proxy, /redirect\(new URL\("\/login"/);
  assert.match(session, /HMAC/);
  assert.doesNotMatch(session, /1q2w3e4r/);
  assert.match(login, /signInWithPassword/);
  assert.match(login, /httpOnly:\s*true/);
  assert.match(login, /AUTH_EMAIL_DASHBOARD/);
  assert.match(login, /access:\s*"dashboard"/);
  assert.doesNotMatch(login, /1q2w3e4r/);
  assert.match(loginPage, /Invalid username or password/);
  assert.match(loginPage, /autoComplete="current-password"/);
});

test("uses the TESVILA blue theme and repository logo", async () => {
  const [css, shell] = await Promise.all([
    read("app/globals.css"),
    read("app/tesvila-app.tsx"),
  ]);

  assert.match(css, /--tesvila-blue:\s*#053a7c/i);
  assert.match(css, /background:\s*var\(--tesvila-blue\)/);
  assert.match(shell, /Logo original remove background\.png/);
  assert.match(shell, /> Invoice/);
  assert.doesNotMatch(shell, /> New document/);
});

test("dashboard reads real database records and product export is removed", async () => {
  const [dashboardApi, dashboard, productManager, database] = await Promise.all([
    read("app/api/dashboard/route.ts"),
    read("app/dashboard-manager.tsx"),
    read("app/product-manager.tsx"),
    read("lib/supabase-server.ts"),
  ]);

  assert.match(database, /fnkkeadpkjshsnjmoznl/);
  assert.match(dashboardApi, /from\("invoices"\)/);
  assert.match(dashboardApi, /from\("products"\)/);
  assert.match(dashboardApi, /unit_cost/);
  assert.match(dashboard, /Profit Guide/);
  assert.match(dashboard, /Monthly Sales/);
  assert.match(dashboard, /fill="#2e9d57"/);
  assert.match(dashboard, /fill="#e2b93b"/);
  assert.match(dashboard, /fill="#d9534f"/);
  assert.doesNotMatch(productManager, /tesvila-products\.csv|> Export/);
});
