import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/tables/data-table";
import { invoicePreviewItems } from "@/lib/demo-data";

export default function CostingPage() {
  return (
    <div>
      <PageHeader
        title="Costing"
        description="Review weighted average cost, landed cost, gross profit, margin and markup."
      />
      <DataTable
        columns={[
          { key: "description", label: "Product" },
          { key: "quantity", label: "Qty", align: "right" },
          { key: "unitPrice", label: "Selling Price", align: "right" },
          { key: "costPriceSnapshot", label: "Cost Snapshot", align: "right" },
          { key: "grossProfit", label: "Gross Profit", align: "right" },
          { key: "marginPercent", label: "Margin %", align: "right" },
          { key: "markupPercent", label: "Markup %", align: "right" }
        ]}
        rows={invoicePreviewItems}
      />
    </div>
  );
}
