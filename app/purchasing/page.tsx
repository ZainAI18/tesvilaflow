import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/tables/data-table";
import { landedCostPreview } from "@/lib/demo-data";

export default function PurchasingPage() {
  return (
    <div>
      <PageHeader
        title="Purchasing"
        description="Create POs, record currency/payment details, allocate fees into landed cost and post partial arrivals."
        action={<button className="rounded bg-brand px-4 py-2 text-sm font-medium text-white">Create PO</button>}
      />
      <div className="mb-5 grid grid-cols-4 gap-4">
        <div className="rounded border border-line bg-white p-4">
          <div className="text-sm text-muted">PO Number</div>
          <div className="mt-1 font-semibold">PO0505202601</div>
        </div>
        <div className="rounded border border-line bg-white p-4">
          <div className="text-sm text-muted">Payment</div>
          <div className="mt-1 font-semibold">RMB paid by SGD</div>
        </div>
        <div className="rounded border border-line bg-white p-4">
          <div className="text-sm text-muted">Method</div>
          <div className="mt-1 font-semibold">Taobao / Bank / TNG</div>
        </div>
        <div className="rounded border border-line bg-white p-4">
          <div className="text-sm text-muted">Total Landed</div>
          <div className="mt-1 font-semibold">${landedCostPreview.totalLandedCost.toFixed(2)}</div>
        </div>
      </div>
      <DataTable
        columns={[
          { key: "productCode", label: "Code" },
          { key: "productName", label: "Product" },
          { key: "quantity", label: "Qty", align: "right" },
          { key: "unitCost", label: "Supplier Unit Cost", align: "right" },
          { key: "allocatedExtraCost", label: "Allocated Fee", align: "right" },
          { key: "actualUnitLandedCost", label: "Actual Unit Cost SGD", align: "right" }
        ]}
        rows={landedCostPreview.items}
      />
    </div>
  );
}
