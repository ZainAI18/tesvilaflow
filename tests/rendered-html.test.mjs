import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("uses an independent, non-persistent signed session for every tab", async () => {
  const [session, clientAuth, login, shell] = await Promise.all([
    read("lib/auth-session.ts"),
    read("lib/client-auth.ts"),
    read("app/api/auth/login/route.ts"),
    read("app/tesvila-app.tsx"),
  ]);

  assert.match(session, /HMAC/);
  assert.match(session, /Authorization|authorization/);
  assert.doesNotMatch(session, /document\.cookie|localStorage|sessionStorage/);
  assert.match(clientAuth, /let currentSession/);
  assert.doesNotMatch(clientAuth, /localStorage|sessionStorage|indexedDB/);
  assert.match(login, /signInWithPassword/);
  assert.match(login, /Zi Jian/);
  assert.match(login, /Wei Jian/);
  assert.match(login, /access:\s*"full"/);
  assert.doesNotMatch(login, /password:\s*["'][^"']+["']/);
  assert.match(shell, /setClientSession\(null\)/);
  assert.doesNotMatch(shell, /Caught Up|Bell/);
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

test("document workflow is database-backed, empty by default, and validates relationships", async () => {
  const [workflow, documentsApi, migration, database] = await Promise.all([
    read("app/document-workflow.tsx"),
    read("app/api/documents/route.ts"),
    read("supabase/migrations/202607160001_document_snapshots_and_issuers.sql"),
    read("lib/supabase-server.ts"),
  ]);
  assert.match(database, /fnkkeadpkjshsnjmoznl/);
  assert.match(workflow, /useState<DocumentItem\[\]>\(\[\]\)/);
  assert.match(workflow, /Billing Address/);
  assert.match(workflow, /Delivery Address/);
  assert.match(workflow, /Please select a valid SKU/);
  assert.match(workflow, /Issued By/);
  assert.match(documentsApi, /issuedByUserId:\s*auth\.session\.userId/);
  assert.match(migration, /client_request_id/);
  assert.match(migration, /where id=nullif\(item->>'productId'/);
  assert.match(migration, /next_invoice_number\(\)/);
  assert.match(migration, /next_do_number/);
});

test("dashboard reads real database records and product export is removed", async () => {
  const [dashboardApi, dashboard, productManager] = await Promise.all([
    read("app/api/dashboard/route.ts"),
    read("app/dashboard-manager.tsx"),
    read("app/product-manager.tsx"),
  ]);
  assert.match(dashboardApi, /from\("invoices"\)/);
  assert.match(dashboardApi, /from\("products"\)/);
  assert.match(dashboardApi, /unit_cost/);
  assert.match(dashboard, /Profit Guide/);
  assert.match(dashboard, /Monthly Sales/);
  assert.doesNotMatch(productManager, /tesvila-products\.csv|> Export/);
});
