import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/tables/data-table";

const doRows = [
  {
    doNumber: "DO0505202601",
    invoice: "TS-0001",
    customer: "ABC Hardware Trading",
    date: "2026-06-04",
    warehouse: "Main Warehouse",
    qty: 2,
    status: "Completed"
  },
  {
    doNumber: "DO0505202602",
    invoice: "TS-0001",
    customer: "ABC Hardware Trading",
    date: "2026-06-06",
    warehouse: "Main Warehouse",
    qty: 1,
    status: "Draft"
  }
];

export default function DeliveryOrdersPage() {
  return (
    <div>
      <PageHeader
        title="Delivery Orders"
        description="DO is generated from invoice. Stock is deducted only when DO status becomes completed."
      />
      <DataTable
        columns={[
          { key: "doNumber", label: "DO No" },
          { key: "invoice", label: "Invoice" },
          { key: "customer", label: "Customer" },
          { key: "date", label: "Date" },
          { key: "warehouse", label: "Warehouse" },
          { key: "qty", label: "Qty", align: "right" },
          { key: "status", label: "Status" }
        ]}
        rows={doRows}
      />
    </div>
  );
}
