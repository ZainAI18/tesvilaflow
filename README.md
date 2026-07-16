# Tesvila Operations

Invoice, delivery order, sales reporting and inventory management for Tesvila Pte Ltd.

## Setup

1. Use Supabase project `fnkkeadpkjshsnjmoznl` and run every SQL file in `supabase/migrations` in filename order. Existing installations must run `202607150001_inventory_reporting.sql`, `202607160001_document_snapshots_and_issuers.sql`, `202607160002_document_methods.sql`, then `202607160003_editable_item_descriptions.sql` before deploying this version.
2. Copy `.env.example` to `.env.local` and add the Supabase URL, publishable key, server-side service key, authentication email mappings, and a random `AUTH_SESSION_SECRET` of at least 32 characters.
3. Run `npm run dev`. Deploy the repository to Vercel and add the same environment variables.

The app uses Supabase as its source of truth. The migrations contain normalized tables, constraints, RLS policies, atomic numbering, transactional invoice-plus-DO creation and exactly-once delivery-order inventory posting.

## Authentication setup

Create three users in Supabase Authentication. Enter the authorized passwords directly in Supabase; never commit them to GitHub or expose them in browser environment variables. Set the corresponding server-only email address mappings in `AUTH_EMAIL_ZIJIAN8189`, `AUTH_EMAIL_WEIJIAN8189`, and `AUTH_EMAIL_DASHBOARD`. The visible login remains username-based. ZiJian8189 and WeiJian8189 receive full application access; account 123456 can access only Dashboard, Inventory Stock, and Stock Movement History.

Each successful login receives a short-lived signed bearer token held only in the current page's JavaScript memory. It is never written to cookies, LocalStorage, SessionStorage, or IndexedDB, so refreshing, closing, or opening a new tab always returns to Login. Each browser tab has independent state, allowing all accounts to work simultaneously without logging one another out. All business-data API routes verify the signed token, and server APIs reject a Supabase URL that does not reference `fnkkeadpkjshsnjmoznl`.

## Document workflow

- Saving an invoice commits the invoice, its item rows, the linked delivery order and its item rows in one database transaction.
- Saving never generates a PDF.
- Saving a delivery order automatically creates negative stock movements. Editing reverses the old movements before applying the new rows; cancelling or deleting restores the stock.
- Inventory, movement history, and monthly sales reports use live Supabase records. Invoice item cost and discount snapshots are retained for gross-profit reporting.
- Invoice and delivery-order PDFs are generated on demand from saved table records, with wrapped rows, automatic pagination, repeated headers and `Page X of Y`.
- Customer and product details are stored as document snapshots. Existing customers auto-fill by customer ID, while manual one-off customers are not silently added to the master list. SKU selection is validated against product ID and SKU before every save.
- Issued By is derived from the authenticated account and preserved on later edits; editors are recorded separately.
- The generated filenames are `{invoice_number}-Invoice.pdf` and `{do_number}-Delivery-Order.pdf`.
