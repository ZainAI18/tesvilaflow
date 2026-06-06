import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/tables/data-table";

const reportRows = [
  { report: "Monthly Sales Report", source: "Confirmed invoices", export: "Excel" },
  { report: "Inventory Report", source: "Warehouse stock balances", export: "Excel" },
  { report: "Stock Movement Report", source: "Stock movements", export: "Excel" },
  { report: "Purchasing Report", source: "PO, payment and arrivals", export: "Excel" },
  { report: "Costing Report", source: "Landed cost and WAC", export: "Excel" },
  { report: "Profit Report", source: "Invoice item cost snapshots", export: "Excel" },
  { report: "Low Stock Report", source: "Product minimum alert", export: "Excel" }
];

export default function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Reports are generated from confirmed documents, stock movements and frozen cost snapshots."
      />
      <DataTable
        columns={[
          { key: "report", label: "Report" },
          { key: "source", label: "Data Source" },
          { key: "export", label: "Export" }
        ]}
        rows={reportRows}
      />
    </div>
  );
}
