import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/tables/data-table";
import { stockMovements } from "@/lib/demo-data";

export default function InventoryPage() {
  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Every stock change creates a movement record. Warehouse stock is updated from movements."
        action={<button className="rounded bg-brand px-4 py-2 text-sm font-medium text-white">New Movement</button>}
      />
      <div className="mb-4 grid grid-cols-6 gap-3">
        {["Stock In", "Stock Out", "Adjustment", "Transfer", "Return", "Damage"].map((item) => (
          <button key={item} className="rounded border border-line bg-white px-3 py-3 text-sm hover:bg-panel">
            {item}
          </button>
        ))}
      </div>
      <DataTable
        columns={[
          { key: "date", label: "Date" },
          { key: "type", label: "Type" },
          { key: "product", label: "Product" },
          { key: "warehouse", label: "Warehouse" },
          { key: "qty", label: "Qty", align: "right" },
          { key: "related", label: "Related Document" }
        ]}
        rows={stockMovements}
      />
    </div>
  );
}
