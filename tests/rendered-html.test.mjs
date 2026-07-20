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
  const [workflow, documentsApi, migration, report] = await Promise.all([
    read("app/document-workflow.tsx"),
    read("app/api/documents/route.ts"),
    read("supabase/migrations/202607160002_document_methods.sql"),
    read("lib/invoice-report.ts"),
  ]);
  assert.match(workflow, /Item Collect Method/);
  assert.match(workflow, /Select method/);
  assert.match(workflow, /Select payment method/);
  assert.match(workflow, /value="self_collect"/);
  assert.match(workflow, /value="paynow"/);
  assert.match(workflow, /Please select an item collect method/);
  assert.match(workflow, /Please select a payment method/);
  assert.match(workflow, /itemCollectLabel\(order\.itemCollectMethod\)/);
  assert.match(report, /invoice\.paymentMethod === "paynow"/);
  assert.match(report, /invoice\.paymentMethod === "terms"/);
  assert.match(documentsApi, /create_invoice_with_do_v9/);
  assert.match(documentsApi, /update_delivery_order_document_v9/);
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
  assert.match(documentsApi, /create_invoice_with_do_v9/);
  assert.match(documentsApi, /update_invoice_document_v8/);
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
  assert.match(documentsApi, /create_invoice_with_do_v9/);
  assert.match(documentsApi, /update_delivery_order_document_v9/);
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
  assert.match(workflow, /applySelectedInvoice[\s\S]*setItems\(\[\]\)/);
  assert.match(workflow, /Changing the selected Invoice will replace the current customer and item details/);
  assert.match(workflow, /if \(!value\.trim\(\)\) \{\s+clearSelectedInvoice\(\)/);
  assert.match(workflow, /if \(!value\.trim\(\)\) \{\s+clearModalInvoice\(\)/);
  assert.match(workflow, /invoiceId: selectedInvoiceId \|\| undefined/);
  assert.match(workflow, /Invoice No\.: \$\{order\.invoiceNumber \|\|/);
  assert.match(documentsApi, /invoice_id,invoice_number/);
  assert.match(documentsApi, /create_delivery_order_only_v9/);
  assert.match(documentsApi, /update_delivery_order_document_v9/);
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
  assert.match(documentsApi, /create_invoice_only_v8/);
  assert.match(migration, /delivery_orders_one_active_invoice_unique/);
  assert.match(migration, /This Invoice already has a linked Delivery Order\./);
  assert.match(invoiceOnlyFunction, /insert into public\.invoices/);
  assert.match(invoiceOnlyFunction, /insert into public\.invoice_items/);
  assert.doesNotMatch(invoiceOnlyFunction, /insert into public\.delivery_orders/);
  assert.doesNotMatch(invoiceOnlyFunction, /insert into public\.delivery_order_items/);
  assert.match(inventoryMigration, /delivery_order_items/);
});

test("one Invoice supports multiple partial Delivery Orders without over-delivery", async () => {
  const [workflow, documentsApi, migration, database] = await Promise.all([
    read("app/document-workflow.tsx"),
    read("app/api/documents/route.ts"),
    read("supabase/migrations/202607160007_invoice_partial_deliveries.sql"),
    read("lib/supabase-server.ts"),
  ]);
  assert.match(database, /fnkkeadpkjshsnjmoznl/);
  assert.match(documentsApi, /invoice_item_id/);
  assert.match(documentsApi, /related_delivery_orders:delivery_orders/);
  assert.match(documentsApi, /create_delivery_order_only_v9/);
  assert.match(workflow, /Invoice Qty/);
  assert.match(workflow, /Previously Delivered/);
  assert.match(workflow, /Remaining/);
  assert.match(workflow, /Current Delivery Qty/);
  assert.match(workflow, /Fully Delivered/);
  assert.match(workflow, /Related Delivery Orders/);
  assert.match(migration, /drop index if exists public\.delivery_orders_one_active_invoice_unique/);
  assert.match(migration, /add column if not exists invoice_item_id uuid/);
  assert.match(migration, /validate_invoice_delivery_quantities/);
  assert.match(migration, /for update/);
  assert.match(migration, /Delivery quantity % exceeds Invoice quantity %/);
  assert.match(migration, /delivery_order\.status <> 'cancelled'/);
  assert.doesNotMatch(migration, /This Invoice already has a linked Delivery Order/);
});

test("linked Delivery Orders are deleted only through their parent Invoice", async () => {
  const [workflow, migration] = await Promise.all([
    read("app/document-workflow.tsx"),
    read("supabase/migrations/202607160007_invoice_partial_deliveries.sql"),
  ]);
  assert.match(workflow, /This Invoice has \$\{inv\.relatedDeliveryOrders\.length\} related Delivery Orders/);
  assert.match(workflow, /Delete this Delivery Order\? Its inventory movement will be reversed\./);
  assert.match(workflow, /This Delivery Order is linked to an Invoice and cannot be deleted separately/);
  assert.match(workflow, /!\(!invoice && dor\.invoiceId\)/);
  assert.match(migration, /if linked_invoice_id is not null then/);
  assert.match(migration, /Parent Invoice deleted/);
  assert.match(migration, /for linked_do in/);
  assert.match(migration, /reverse_delivery_order_item_stock/);
  assert.match(migration, /deleted_with_parent_invoice/);
});

test("Invoice hard deletion cascades in Supabase and restores saved physical stock once", async () => {
  const [workflow, documentsApi, operationsPage, dashboard, migration, database] =
    await Promise.all([
      read("app/document-workflow.tsx"),
      read("app/api/documents/route.ts"),
      read("app/operations-dashboard.tsx"),
      read("app/dashboard-manager.tsx"),
      read("supabase/migrations/202607200002_invoice_hard_delete.sql"),
      read("lib/supabase-server.ts"),
    ]);

  assert.match(database, /fnkkeadpkjshsnjmoznl/);
  assert.match(documentsApi, /delete_invoice_with_dependencies/);
  assert.match(documentsApi, /Unable to delete the Invoice and its related records/);
  assert.match(workflow, /permanently delete all related Delivery Orders, Delivery Order Items and Stock Movement records/);
  assert.match(workflow, /window\.addEventListener\("focus", refetch\)/);
  assert.match(workflow, /This record no longer exists\./);
  assert.match(operationsPage, /window\.addEventListener\("focus", refetch\)/);
  assert.match(dashboard, /window\.addEventListener\("focus", refetch\)/);
  assert.match(migration, /create or replace function public\.delete_invoice_with_dependencies/);
  assert.match(migration, /create or replace function public\.restore_invoice_inventory_before_delete/);
  assert.match(migration, /before delete on public\.invoices/);
  assert.match(migration, /before delete on public\.delivery_orders/);
  assert.match(migration, /coalesce\(stock_movement\.stock_product_id, stock_movement\.product_id\)/);
  assert.match(migration, /current_stock = current_stock \+ abs\(movement\.quantity\)/);
  assert.match(migration, /stock_movement\.active/);
  assert.match(migration, /stock_movement\.reversed_at is null/);
  assert.match(migration, /foreign key\(invoice_id\) references public\.invoices\(id\) on delete cascade/);
  assert.match(migration, /foreign key\(delivery_order_id\) references public\.delivery_orders\(id\) on delete cascade/);
  assert.match(migration, /foreign key\(source_item_id\) references public\.delivery_order_items\(id\) on delete cascade/);
  assert.match(migration, /foreign key\(reversal_of\) references public\.stock_movements\(id\) on delete cascade/);
  assert.match(migration, /delete from public\.invoices where id = p_invoice_id/);
  assert.match(migration, /invoice_hard_deleted/);
});

test("Delivery Order view separates Brand and protects linked quantity columns", async () => {
  const [workflow, styles] = await Promise.all([
    read("app/document-workflow.tsx"),
    read("app/globals.css"),
  ]);

  assert.match(workflow, /delivery-view-items/);
  assert.match(workflow, /\{!invoice && <th>Brand<\/th>\}/);
  assert.match(workflow, /<th>Invoice Qty<\/th>/);
  assert.match(workflow, /className="document-item-amount"/);
  assert.match(styles, /delivery-view-items\.partial-delivery \{ min-width: 1430px; \}/);
  assert.match(styles, /nth-child\(5\)[\s\S]*width: 110px/);
  assert.match(styles, /nth-child\(6\)[\s\S]*width: 95px; text-align: center/);
  assert.match(styles, /document-item-amount \{ white-space: nowrap; \}/);
});

test("administration pages are removed without changing authentication or company document details", async () => {
  const [shell, login, workflow] = await Promise.all([
    read("app/tesvila-app.tsx"),
    read("app/api/auth/login/route.ts"),
    read("app/document-workflow.tsx"),
  ]);
  const activeShell = shell.slice(0, shell.indexOf("/* The user-facing User Management"));
  assert.doesNotMatch(activeShell, /User Management|Company Settings|ShieldCheck/);
  assert.doesNotMatch(activeShell, /case "User Management"|case "Company Settings"/);
  assert.match(login, /Zi Jian/);
  assert.match(login, /Wei Jian/);
  assert.match(login, /123456/);
  assert.match(workflow, /TESVILA PTE LTD/);
  assert.match(workflow, /tesvilaLogo/);
  assert.match(workflow, /UEN/);
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

test("Invoice View and PDF share the redesigned A4 report data and repository assets", async () => {
  const [workflow, report, pdf, documentsApi, css, database] = await Promise.all([
    read("app/document-workflow.tsx"),
    read("lib/invoice-report.ts"),
    read("lib/invoice-pdf.ts"),
    read("app/api/documents/route.ts"),
    read("app/globals.css"),
    read("lib/supabase-server.ts"),
  ]);
  assert.match(database, /fnkkeadpkjshsnjmoznl/);
  assert.match(workflow, /function InvoiceReportPreview/);
  assert.match(workflow, /buildInvoiceReportData\(invoice\)/);
  assert.match(workflow, /createInvoicePdf\(/);
  assert.match(workflow, /tesvilaLogo from "\.\.\/Logo original remove background\.png"/);
  assert.match(workflow, /payNowQr from "\.\.\/PayNow_QR\.png"/);
  assert.match(workflow, /className="invoice-report-logo"/);
  assert.match(workflow, /className="invoice-qr"/);
  assert.match(workflow, /\[item\.brand, item\.description\]\.filter\(Boolean\)\.join\(" "\)/);
  assert.match(report, /BLOCK 4001 ANG MO KIO INDUSTRIAL PARK1/);
  assert.match(report, /Please note that the pricing provided in this invoice is a special price/);
  assert.match(report, /Bank transfer to: OCBC Bank 526 228 440 001/);
  assert.match(report, /new Map\(/);
  assert.match(report, /Math\.max\(3, items\.length\)/);
  assert.match(report, /const firstPageSize = 8/);
  assert.match(pdf, /forceContinuation = data\.items\.length > 8 && index === 8/);
  assert.match(pdf, /\[item\.brand, item\.description\]\.filter\(Boolean\)\.join\(" "\)/);
  assert.doesNotMatch(pdf, /Invoice Continued|Page \$\{index/);
  assert.match(pdf, /function drawSectionTitle/);
  assert.match(pdf, /Math\.max\(3, remarkLines\.length\)/);
  assert.match(documentsApi, /subtotal,gst_amount,grand_total,deposit,balance/);
  assert.match(css, /@page \{ size: A4 portrait; margin: 0; \}/);
  assert.match(css, /page-break-inside: avoid/);
  assert.match(css, /body \* \{ visibility: hidden !important; \}/);
});

test("Delivery Order contacts remain separate from Invoice and customer contacts", async () => {
  const [workflow, documentsApi, migration, css, invoiceReport, database] = await Promise.all([
    read("app/document-workflow.tsx"),
    read("app/api/documents/route.ts"),
    read("supabase/migrations/202607170001_delivery_contacts.sql"),
    read("app/globals.css"),
    read("lib/invoice-report.ts"),
    read("lib/supabase-server.ts"),
  ]);

  assert.match(database, /fnkkeadpkjshsnjmoznl/);
  assert.match(workflow, /Delivery Contact Person/);
  assert.match(workflow, /Delivery Contact Number/);
  assert.match(workflow, /deliveryContact,/);
  assert.match(workflow, /deliveryPhone,/);
  assert.match(workflow, /order\.deliveryContact \|\| order\.customer\.attention/);
  assert.match(workflow, /order\.deliveryPhone \|\| order\.customer\.phone/);
  assert.match(workflow, /\["Delivery Address", wrap\(regular, 8, order\.deliveryAddress/);
  assert.match(workflow, /\["Contact Person", wrap\(regular, 8, reportDeliveryContact/);
  assert.match(workflow, /\["Contact Number", wrap\(regular, 8, reportDeliveryPhone/);
  assert.match(workflow, /\["DO Date", \[date\(order\.deliveryDate\)\]\]/);
  assert.match(css, /\.document-delivery-contact-row/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(documentsApi, /delivery_contact_person,delivery_contact_number/);
  assert.match(documentsApi, /create_invoice_with_do_v9/);
  assert.match(documentsApi, /create_delivery_order_only_v9/);
  assert.match(documentsApi, /update_delivery_order_document_v9/);
  assert.match(migration, /add column if not exists delivery_contact_person text/);
  assert.match(migration, /add column if not exists delivery_contact_number text/);
  assert.match(migration, /create_invoice_with_do_v7\(p_payload\)/);
  assert.match(migration, /create_delivery_order_only_v7\(p_payload\)/);
  assert.match(migration, /update_delivery_order_document_v7\(p_id, p_payload\)/);
  assert.doesNotMatch(invoiceReport, /deliveryContact|deliveryPhone|Delivery Contact/);
});

test("Delivery Order terms and signatures stay in a static final-page footer", async () => {
  const workflow = await read("app/document-workflow.tsx");
  const terms = [
    "All goods listed above are received in good condition unless otherwise stated at the time of delivery.",
    "Any claim of damaged or missing goods must be made in writing within 24 hours upon receipt of goods. Claims made after this period may not be entertained.",
    "Ownership of the goods remains with TESVILA PTE LTD until full payment is received.",
    "Delivery is considered complete once the goods are handed over to the stated delivery address or an authorized representative.",
    "Additional delivery charges may apply if no one is present to receive the goods at the delivery location during the scheduled delivery time.",
    "The customer is responsible for inspecting the goods immediately upon delivery. Any discrepancy should be noted on this delivery order.",
    "Goods sold and delivered are not returnable unless prior agreement is made in writing.",
    "If installation is not included, TESVILA PTE LTD is not responsible for any damage or defect arising from improper installation by third parties.",
    "By signing this delivery order, the customer acknowledges that the goods are delivered as listed and agrees to the terms stated above.",
  ];

  terms.forEach((term) => assert.match(workflow, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));
  assert.match(workflow, /const DELIVERY_ORDER_STATIC_FOOTER_TOP = 270/);
  assert.match(workflow, /function drawDeliveryOrderStaticFooter/);
  assert.match(workflow, /const reserve = DELIVERY_ORDER_STATIC_FOOTER_TOP \+ 78/);
  assert.match(workflow, /y - dynamicFooterHeight < DELIVERY_ORDER_STATIC_FOOTER_TOP \+ 12/);
  assert.match(workflow, /drawDeliveryOrderStaticFooter\(kit, page, order\)/);
  assert.match(workflow, /Driver \/ Delivery Personnel/);
  assert.match(workflow, /Customer Signature/);
  assert.match(workflow, /Received Date:/);
  assert.doesNotMatch(workflow, /Goods Checked & Received In Good Condition|CUSTOMER STAMP|Customer Signature & Stamp|Company Stamp/);
});

test("Delivery Order PDF uses the Invoice blue theme and Invoice title is editable and persisted", async () => {
  const [workflow, report, documentsApi, migration, database] = await Promise.all([
    read("app/document-workflow.tsx"),
    read("lib/invoice-report.ts"),
    read("app/api/documents/route.ts"),
    read("supabase/migrations/202607170002_invoice_title.sql"),
    read("lib/supabase-server.ts"),
  ]);

  assert.match(database, /fnkkeadpkjshsnjmoznl/);
  assert.match(workflow, /TESVILA_BLUE = rgb\(0\.02, 0\.23, 0\.49\)/);
  assert.doesNotMatch(workflow, /page\.drawRectangle\(\{ x: 0, y: 790/);
  assert.match(workflow, /Email: sales@tesvila\.com\.sg/);
  assert.match(workflow, /Web: www\.tesvila\.com\.sg/);
  assert.match(workflow, /start: \{ x: 36, y: 785 \}[\s\S]*color: TESVILA_BLUE/);
  assert.match(workflow, /function doTableHead[\s\S]*color: TESVILA_BLUE/);
  assert.match(workflow, /useState\("Supply Sanitary Ware"\)/);
  assert.match(workflow, /<label>Title of Invoice<\/label>/);
  assert.match(workflow, /titleOfInvoice: titleOfInvoice\.trim\(\) \|\| "Supply Sanitary Ware"/);
  assert.match(report, /sectionTitle: safeText\(invoice\.titleOfInvoice, "Supply Sanitary Ware"\)/);
  assert.match(documentsApi, /invoice_title/);
  assert.match(documentsApi, /create_invoice_with_do_v9/);
  assert.match(documentsApi, /create_invoice_only_v8/);
  assert.match(documentsApi, /update_invoice_document_v8/);
  assert.match(migration, /add column if not exists invoice_title text/);
  assert.match(migration, /create_invoice_with_do_v8\(p_payload\)/);
  assert.match(migration, /create_invoice_only_v7\(p_payload\)/);
  assert.match(migration, /update_invoice_document_v7\(p_id, p_payload\)/);
});

test("Delivery Order Only separates read-only history from current Invoice and Extra items", async () => {
  const [workflow, css, documentsApi, migration, invoiceReport, invoicePdf, database] = await Promise.all([
    read("app/document-workflow.tsx"),
    read("app/globals.css"),
    read("app/api/documents/route.ts"),
    read("supabase/migrations/202607170003_delivery_order_linked_items.sql"),
    read("lib/invoice-report.ts"),
    read("lib/invoice-pdf.ts"),
    read("lib/supabase-server.ts"),
  ]);

  assert.match(database, /fnkkeadpkjshsnjmoznl/);
  assert.match(workflow, /function PreviouslyDeliveredItems/);
  assert.match(workflow, /Previously Delivered Items/);
  assert.match(workflow, /Read-only history/);
  assert.match(workflow, /No previously delivered items\./);
  assert.match(workflow, /setItems\(\[\]\)/);
  assert.match(workflow, /No new delivery items added\./);
  assert.match(workflow, /selectDeliveryProduct/);
  assert.match(workflow, /itemSource: "invoice"/);
  assert.match(workflow, /itemSource: linkedInvoice \? "extra"/);
  assert.match(workflow, /Not in Invoice/);
  assert.match(workflow, /Delivery quantity cannot exceed the remaining quantity of/);
  assert.match(workflow, /This Child SKU has already been added for the same Invoice item\./);
  assert.match(workflow, /This Extra Item has already been added to the current Delivery Order\./);
  assert.match(workflow, /previouslyDeliveredItems\(activeModalInvoice, savedDelivery\)/);
  assert.match(css, /\.previously-delivered-section/);
  assert.match(css, /background: #eef0f2/);
  assert.match(documentsApi, /item_source/);
  assert.match(documentsApi, /if \(!item\.invoice_item_id\) return/);
  assert.match(documentsApi, /create_delivery_order_only_v9/);
  assert.match(documentsApi, /update_delivery_order_document_v9/);
  assert.match(migration, /add column if not exists item_source text/);
  assert.match(migration, /new\.item_source := case when new\.invoice_item_id is null then 'extra' else 'invoice' end/);
  assert.match(migration, /delivery_item\.invoice_item_id is not null/);
  assert.match(migration, /group by invoice_item_id having count\(\*\) > 1/);
  assert.match(migration, /group by product_id having count\(\*\) > 1/);
  assert.match(migration, /create_delivery_order_only_v8\(p_payload\)/);
  assert.match(migration, /update_delivery_order_document_v8\(p_id, p_payload\)/);
  assert.match(workflow, /for \(const item of order\.items\)/);
  assert.doesNotMatch(invoiceReport, /Previously Delivered Items|item_source|itemSource/);
  assert.doesNotMatch(invoicePdf, /Previously Delivered Items|item_source|itemSource/);
});

test("Parent SKUs map Invoice items to independent Child inventory without combining stock", async () => {
  const [workflow, productManager, productsApi, parentMigration, inventoryMigration, database] = await Promise.all([
    read("app/document-workflow.tsx"),
    read("app/product-manager.tsx"),
    read("app/api/products/route.ts"),
    read("supabase/migrations/202607170004_product_parent_skus.sql"),
    read("supabase/migrations/202607150001_inventory_reporting.sql"),
    read("lib/supabase-server.ts"),
  ]);

  assert.match(database, /fnkkeadpkjshsnjmoznl/);
  assert.match(productManager, /Parent SKU \(optional\)/);
  assert.match(productManager, /No Parent SKU/);
  assert.match(productManager, /updateParentSku/);
  assert.match(productsApi, /parent_product_id: parentProductId/);
  assert.match(productsApi, /export async function PATCH/);
  assert.match(workflow, /product\.parent_product_id === item\.productId/);
  assert.match(workflow, /Please select a Child SKU for Parent SKU/);
  assert.match(workflow, /This Child SKU has already been added for the same Invoice item\./);
  assert.match(workflow, /group\.quantity > group\.remaining/);
  assert.match(parentMigration, /add column if not exists parent_product_id uuid/);
  assert.match(parentMigration, /Every Child Product keeps its own independent opening\/current\/reserved stock/);
  assert.match(parentMigration, /delivered_product\.parent_product_id = invoice_item\.product_id/);
  assert.match(parentMigration, /child\.parent_product_id = invoice_item\.product_id/);
  assert.match(parentMigration, /group by invoice_item_id, product_id having count\(\*\) > 1/);
  assert.doesNotMatch(parentMigration, /update public\.products[\s\S]*current_stock/);
  assert.match(inventoryMigration, /where id=i\.product_id/);
});

test("Linked Stock Products share physical inventory without merging document SKUs", async () => {
  const [productManager, productsApi, operationsApi, operationsPage, migration, workflow, database] =
    await Promise.all([
      read("app/product-manager.tsx"),
      read("app/api/products/route.ts"),
      read("app/api/operations/route.ts"),
      read("app/operations-dashboard.tsx"),
      read("supabase/migrations/202607200001_linked_stock_products.sql"),
      read("app/document-workflow.tsx"),
      read("lib/supabase-server.ts"),
    ]);

  assert.match(database, /fnkkeadpkjshsnjmoznl/);
  assert.match(productManager, /Linked Stock Product/);
  assert.match(productManager, /Use own stock/);
  assert.match(productManager, /Shared Stock/);
  assert.match(productManager, /Changing the Linked Stock Product will affect future inventory movements/);
  assert.match(productsApi, /linked_stock_product_id: linkedStockProductId/);
  assert.match(productsApi, /A product cannot be linked to itself/);
  assert.match(productsApi, /main stock product that is not linked to another product/);
  assert.match(operationsApi, /effective_current_stock/);
  assert.match(operationsApi, /source_product:products!stock_movements_source_product_id_fkey/);
  assert.match(operationsPage, /new Map\(selected\.map\(\(p\) => \[p\.stock_owner_id, p\]\)\)/);
  assert.match(operationsPage, /Stock will be applied to/);
  assert.match(operationsPage, /Source Product \/ SKU/);
  assert.match(operationsPage, /Stock Product \/ SKU/);
  assert.match(migration, /add column if not exists linked_stock_product_id uuid/);
  assert.match(migration, /foreign key \(linked_stock_product_id\)[\s\S]*on delete restrict/);
  assert.match(migration, /create or replace function public\.resolve_stock_product_id/);
  assert.match(migration, /stock_id := public\.resolve_stock_product_id\(source_product\.id\)/);
  assert.match(migration, /source_product_id,stock_product_id,source_sku,stock_sku/);
  assert.match(migration, /A main stock product used by linked products cannot itself be linked/);
  assert.match(migration, /Remove or change those links before deleting it/);
  assert.doesNotMatch(workflow, /linked_stock_product_id/);
});

test("Monthly Sales Report combines item-level filters with a formatted XLSX export", async () => {
  const [page, route, exportRoute, reportLogic, workbook] = await Promise.all([
    read("app/operations-dashboard.tsx"),
    read("app/api/sales-report/route.ts"),
    read("app/api/sales-report/export/route.ts"),
    read("lib/sales-report.ts"),
    read("lib/sales-report-workbook.ts"),
  ]);

  assert.match(page, /ReportSearchFilter/);
  assert.match(page, /Custom date range/);
  assert.match(page, /Exporting\.\.\./);
  assert.match(page, /No sales records found for the selected filters\./);
  assert.match(page, /\/api\/sales-report\/export/);
  assert.match(route, /loadSalesReport/);
  assert.match(exportRoute, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  assert.match(reportLogic, /filters\.productId !== "all" && productId !== filters\.productId/);
  assert.match(reportLogic, /quantity \* unitPrice - discount/);
  assert.match(reportLogic, /savedCost === null \|\| savedCost === undefined/);
  assert.match(reportLogic, /summary\.margin =/);
  assert.match(workbook, /addWorksheet\("Summary"/);
  assert.match(workbook, /addWorksheet\("Sales Details"/);
  assert.match(workbook, /state: "frozen", ySplit: 1/);
  assert.match(workbook, /detailSheet\.autoFilter/);
  assert.match(workbook, /"S\$" #,##0\.00/);
  assert.match(workbook, /Gross Profit Margin/);
  assert.match(workbook, /TESVILA_Monthly_Sales_Report_/);
  assert.match(workbook, /TESVILA_Sales_Report_/);
});
