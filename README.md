# Tesvila Inventory & Purchasing System

Desktop-first internal management system for Tesvila daily operations.

## What is implemented

- Static MVP prototype: `index.html`
- Next.js application scaffold
- Prisma database schema
- Core business calculation libraries
- Dashboard and module pages
- Landed cost preview API
- Invoice item profit/GST preview API
- Seed data skeleton

## Open the prototype now

Open this file in a browser:

```text
C:\Users\tesvi\Documents\Inventory & Purchasing\index.html
```

The prototype includes:

- Dashboard
- Products
- Inventory
- Purchasing landed cost calculator
- Costing
- Customers
- Suppliers
- Invoices
- Delivery Orders
- Reports
- Settings
- CSV export from visible tables

## Business rules implemented in code

- GST is 9% exclusive.
- Product cost uses weighted average cost.
- Purchase landed cost includes shipping, tax, other cost and payment fee.
- Landed cost can be allocated by quantity or by product value.
- Purchase payment supports supplier currency, payment currency, editable exchange rate and payment method.
- Invoice profit uses a frozen cost snapshot.
- Admin manual invoice cost override is represented in permissions and schema.
- Stock movement applies warehouse-level stock balance.
- Delivery order completion is the stock-out trigger.

## Formal app setup

After Node.js and npm are available:

```bash
npm install
copy .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Database URL example:

```text
postgresql://postgres:postgres@localhost:5432/tesvila_inventory
```

## Important files

- `prisma/schema.prisma` - database model
- `lib/costing.ts` - landed cost, WAC, invoice profit
- `lib/inventory.ts` - warehouse stock movement rules
- `lib/numbering.ts` - TS, DO and PO numbering
- `lib/permissions.ts` - Admin/Staff/Viewer permissions
- `app/` - Next.js pages and API routes
- `index.html` - no-install clickable MVP prototype

## Next implementation step

Install dependencies and connect PostgreSQL, then replace demo data with real database CRUD forms and actions.
