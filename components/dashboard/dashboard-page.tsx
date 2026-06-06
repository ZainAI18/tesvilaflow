import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/tables/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { invoicePreviewSummary, products, stockMovements } from "@/lib/demo-data";

const metrics = [
  { label: "Inventory Value", value: "$7,944.20", helper: "Weighted average cost x stock" },
  { label: "Today Sales", value: "$717.22", helper: "Confirmed invoices" },
  { label: "Monthly Cost", value: "$369.10", helper: "Cost snapshots" },
  { label: "Gross Profit", value: `$${invoicePreviewSummary.grossProfit.toFixed(2)}`, helper: "Before expenses" }
];

export function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Daily view of inventory value, sales, cost, profit, low stock and recent movements."
      />
      <div className="grid grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded border border-line bg-white p-4 shadow-soft">
            <div className="text-sm text-muted">{metric.label}</div>
            <div className="mt-2 text-2xl font-semibold">{metric.value}</div>
            <div className="mt-1 text-xs text-muted">{metric.helper}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <section className="col-span-2 rounded border border-line bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Recent Stock Movement</h2>
            <StatusPill label="DO completed stock-out" tone="good" />
          </div>
          <DataTable
            columns={[
              { key: "date", label: "Date" },
              { key: "type", label: "Type" },
              { key: "product", label: "Product" },
              { key: "warehouse", label: "Warehouse" },
              { key: "qty", label: "Qty", align: "right" },
              { key: "related", label: "Related" }
            ]}
            rows={stockMovements}
          />
        </section>

        <section className="rounded border border-line bg-white p-4">
          <h2 className="font-semibold">Low Stock Alert</h2>
          <div className="mt-3 space-y-3">
            {products
              .filter((product) => product.stock <= 12)
              .map((product) => (
                <div key={product.productCode} className="rounded border border-line p-3">
                  <div className="font-medium">{product.productCode}</div>
                  <div className="text-sm text-muted">{product.productName}</div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span>Stock</span>
                    <StatusPill label={String(product.stock)} tone="warn" />
                  </div>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
