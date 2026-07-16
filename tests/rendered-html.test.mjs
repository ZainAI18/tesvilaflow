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
  assert.match(login, /access:\s*"warehouse"/);
  assert.match(login, /account\.access === "warehouse" \? "warehouse" : "admin"/);
  assert.doesNotMatch(login, /password:\s*["'][^"']+["']/);
  assert.match(shell, /setClientSession\(null\)/);
  assert.match(shell, /warehouseNavGroups/);
  assert.match(shell, /"Inventory Stock"/);
  assert.match(shell, /"Stock Movement History"/);
  assert.match(shell, /session\.access === "full"/);
  assert.doesNotMatch(shell, /Caught Up|Bell/);
});

test("warehouse account is enforced by server APIs, not only hidden navigation", async () => {
  const [session, dashboardApi, operationsApi, documentApi] = await Promise.all([
    read("lib/auth-session.ts"),
    read("app/api/dashboard/route.ts"),
    read("app/api/operations/route.ts"),
    read("app/api/documents/route.ts"),
  ]);
  assert.match(session, /allowedAccess:\s*SessionAccess\[\]/);
  assert.match(session, /status:\s*403/);
  assert.match(dashboardApi, /\["full", "warehouse"\]/);
  assert.match(operationsApi, /\["full", "warehouse"\]/);
  assert.doesNotMatch(documentApi, /\["full", "warehouse"\]/);
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

test("invoice and delivery-order method dropdowns persist through constrained database wrappers", async () => {
  const [workflow, documentsApi, migration] = await Promise.all([
    read("app/document-workflow.tsx"),
    read("app/api/documents/route.ts"),
    read("supabase/migrations/202607160002_document_methods.sql"),
  ]);
  assert.match(workflow, /Item Collect Method/);
  assert.match(workflow, /Select method/);
  assert.match(workflow, /Select payment method/);
  assert.match(workflow, /value="self_collect"/);
  assert.match(workflow, /value="paynow"/);
  assert.match(workflow, /Please select an item collect method/);
  assert.match(workflow, /Please select a payment method/);
  assert.match(workflow, /itemCollectLabel\(order\.itemCollectMethod\)/);
  assert.match(workflow, /paymentMethodLabel\(inv\.paymentMethod\)/);
  assert.match(documentsApi, /create_invoice_with_do_v2/);
  assert.match(documentsApi, /update_delivery_order_document_v2/);
  assert.match(migration, /item_collect_method in \('delivery','self_collect'\)/);
  assert.match(migration, /payment_method in \('paynow','cash','terms'\)/);
  assert.match(migration, /update public\.delivery_orders[\s\S]*invoice_id = p_id/);
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
