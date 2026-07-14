# Tesvila Operations

Invoice, delivery order, sales reporting and inventory management for Tesvila Pte Ltd.

## Setup

1. Create a Supabase project and run both SQL files in `supabase/migrations` in filename order.
2. Copy `.env.example` to `.env.local` and add the Supabase and document extraction credentials.
3. Create a private Supabase Storage bucket named `documents` and folders for `invoices`, `delivery-orders`, `logos`, and `paynow`.
4. Run `npm run dev`. Deploy the repository to Vercel and add the same environment variables.

The app includes a fully interactive seeded preview. Database-backed document creation requires the environment variables above. The migrations contain normalized tables, constraints, RLS policies, atomic numbering, transactional invoice-plus-DO creation and exactly-once delivery-order inventory posting.

## Document workflow

- Saving an invoice commits the invoice, its item rows, the linked delivery order and its item rows in one database transaction.
- Saving never generates a PDF.
- Invoice and delivery-order PDFs are generated on demand from saved table records, with wrapped rows, automatic pagination, repeated headers and `Page X of Y`.
- The generated filenames are `{invoice_number}-Invoice.pdf` and `{do_number}-Delivery-Order.pdf`.
