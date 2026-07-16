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
  assert.match(documentsApi, /create_invoice_with_do_v6/);
  assert.match(documentsApi, /update_delivery_order_document_v6/);
  assert.match(migration, /item_collect_method in \('delivery','self_collect'\)/);
  assert.match(migration, /payment_method in \('paynow','cash','terms'\)/);
  assert.match(migration, /update public\.delivery_orders[\s\S]*invoice_id = p_id/);
});

test("item descriptions are editable document snapshots", async () => {
  const [workflow, documentsApi, migration] = await Promise.all([
    read("app/document-workflow.tsx"),
    read("app/api/documents/route.ts"),
    read("supabase/migrations/202607160003_editable_item_descriptions.sql"),
  ]);
  assert.match(workflow, /update\(row\.id, "description", e\.target\.value\)/);
  assert.match(workflow, /setItem\(i\.id, "description", e\.target\.value\)/);
  assert.doesNotMatch(workflow, /readOnly value=\{row\.description\}/);
  assert.match(documentsApi, /create_invoice_with_do_v6/);
  assert.match(documentsApi, /update_invoice_document_v6/);
  assert.match(migration, /update public\.invoice_items as stored_item/);
  assert.match(migration, /update public\.delivery_order_items as stored_item/);
  assert.match(migration, /with ordinality as payload_item/);
});

test("item brands are editable document snapshots", async () => {
  const [workflow, documentsApi, migration] = await Promise.all([
    read("app/document-workflow.tsx"),
    read("app/api/documents/route.ts"),
    read("supabase/migrations/202607160004_editable_item_brands.sql"),
  ]);
  assert.match(workflow, /update\(row\.id, "brand", e\.target\.value\)/);
  assert.match(workflow, /setItem\(i\.id, "brand", e\.target\.value\)/);
  assert.doesNotMatch(workflow, /updated\(row\.id, "brand"/);
  assert.match(documentsApi, /create_invoice_with_do_v6/);
  assert.match(documentsApi, /update_delivery_order_document_v6/);
  assert.match(migration, /set brand = coalesce\(payload_item\.value->>'brand', ''\)/);
  assert.match(migration, /update public\.invoice_items as stored_item/);
  assert.match(migration, /update public\.delivery_order_items as stored_item/);
});

test("delivery-order-only supports an optional saved Invoice selector", async () => {
  const [workflow, documentsApi, migration, css, database] = await Promise.all([
    read("app/document-workflow.tsx"),
    read("app/api/documents/route.ts"),
    read("supabase/migrations/202607160005_delivery_order_invoice_link.sql"),
    read("app/globals.css"),
    read("lib/supabase-server.ts"),
  ]);
  assert.match(database, /fnkkeadpkjshsnjmoznl/);
  assert.match(workflow, /<label>Selected Invoice<\/label>/);
  assert.match(workflow, /Select invoice, if applicable/);
  assert.match(workflow, /invoiceOptionLabel\(entry\)/);
  assert.match(workflow, /invoiceItemsForDeliveryOrder\(selected\)/);
  assert.match(workflow, /Changing the selected Invoice will replace the current customer and item details/);
  assert.match(workflow, /if \(!value\.trim\(\)\) \{\s+clearSelectedInvoice\(\)/);
  assert.match(workflow, /if \(!value\.trim\(\)\) \{\s+clearModalInvoice\(\)/);
  assert.match(workflow, /invoiceId: selectedInvoiceId \|\| undefined/);
  assert.match(workflow, /\["Invoice No\.", order\.invoiceNumber \|\|/);
  assert.match(documentsApi, /invoice_id,invoice_number/);
  assert.match(documentsApi, /create_delivery_order_only_v6/);
  assert.match(documentsApi, /update_delivery_order_document_v6/);
  assert.match(migration, /add column if not exists invoice_number text/);
  assert.match(migration, /set invoice_id = v_invoice_id/);
  assert.match(migration, /Selected Invoice was not found/);
  assert.match(css, /\.selected-invoice-field/);
  assert.match(css, /\.document-items-table \{ min-width: 900px/);
});

test("Invoice Only saves transactionally without creating a Delivery Order or stock movement", async () => {
  const [workflow, documentsApi, migration, inventoryMigration, database] = await Promise.all([
    read("app/document-workflow.tsx"),
    read("app/api/documents/route.ts"),
    read("supabase/migrations/202607160006_save_invoice_only.sql"),
    read("supabase/migrations/202607150001_inventory_reporting.sql"),
    read("lib/supabase-server.ts"),
  ]);
  const start = migration.indexOf("create or replace function public.create_invoice_only_v6");
  const end = migration.indexOf("create or replace function public.create_invoice_with_do_v6");
  const invoiceOnlyFunction = migration.slice(start, end);

  assert.match(database, /fnkkeadpkjshsnjmoznl/);
  assert.match(workflow, /Save Invoice & DO/);
  assert.match(workflow, /Save Invoice Only/);
  assert.match(workflow, /saveInvoiceOnly/);
  assert.match(workflow, /type: "invoice_only"/);
  assert.match(workflow, /saving === "invoice-only"/);
  assert.match(workflow, /\(!invoice \|\| !!inv\.doId\)/);
  assert.match(documentsApi, /"invoice_only"/);
  assert.match(documentsApi, /create_invoice_only_v6/);
  assert.match(migration, /delivery_orders_one_active_invoice_unique/);
  assert.match(migration, /This Invoice already has a linked Delivery Order\./);
  assert.match(invoiceOnlyFunction, /insert into public\.invoices/);
  assert.match(invoiceOnlyFunction, /insert into public\.invoice_items/);
  assert.doesNotMatch(invoiceOnlyFunction, /insert into public\.delivery_orders/);
  assert.doesNotMatch(invoiceOnlyFunction, /insert into public\.delivery_order_items/);
  assert.match(inventoryMigration, /delivery_order_items/);
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
