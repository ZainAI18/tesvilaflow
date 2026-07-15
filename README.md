# Tesvila Operations

Invoice, delivery order, sales reporting and inventory management for Tesvila Pte Ltd.

## Setup

1. Use Supabase project `fnkkeadpkjshsnjmoznl` and run every SQL file in `supabase/migrations` in filename order. Existing installations must run `202607150001_inventory_reporting.sql` before deploying this version.
2. Copy `.env.example` to `.env.local` and add the Supabase URL, publishable key, server-side service key, authentication email mappings, and a random `AUTH_SESSION_SECRET` of at least 32 characters.
3. Run `npm run dev`. Deploy the repository to Vercel and add the same environment variables.

The app uses Supabase as its source of truth. The migrations contain normalized tables, constraints, RLS policies, atomic numbering, transactional invoice-plus-DO creation and exactly-once delivery-order inventory posting.

## Authentication setup

Create three users in Supabase Authentication. Enter the authorized passwords directly in Supabase; never commit them to GitHub or expose them in browser environment variables. Set the corresponding server-only email address mappings in `AUTH_EMAIL_ZIJIAN8189`, `AUTH_EMAIL_WEIJIAN8189`, and `AUTH_EMAIL_DASHBOARD`. The visible login remains username-based. The first two mappings receive full application access; `AUTH_EMAIL_DASHBOARD` is restricted to Dashboard data and UI only.

Sessions are signed with `AUTH_SESSION_SECRET` and stored in a secure, HTTP-only cookie. All business-data API routes verify this cookie, and server APIs reject a Supabase URL that does not reference `fnkkeadpkjshsnjmoznl`.

## Document workflow

- Saving an invoice commits the invoice, its item rows, the linked delivery order and its item rows in one database transaction.
- Saving never generates a PDF.
- Saving a delivery order automatically creates negative stock movements. Editing reverses the old movements before applying the new rows; cancelling or deleting restores the stock.
- Inventory, movement history, and monthly sales reports use live Supabase records. Invoice item cost and discount snapshots are retained for gross-profit reporting.
- Invoice and delivery-order PDFs are generated on demand from saved table records, with wrapped rows, automatic pagination, repeated headers and `Page X of Y`.
- The generated filenames are `{invoice_number}-Invoice.pdf` and `{do_number}-Delivery-Order.pdf`.
