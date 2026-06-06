import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/tables/data-table";
import { invoicePreviewItems, invoicePreviewSummary } from "@/lib/demo-data";

const invoiceRows = [
  {
    invoiceNumber: "TS-0001",
    customer: "ABC Hardware Trading",
    date: "2026-06-04",
    subtotal: invoicePreviewSummary.subtotal,
    gst: invoicePreviewSummary.gstAmount,
    total: invoicePreviewSummary.totalAmount,
    profit: invoicePreviewSummary.grossProfit,
    status: "Confirmed"
  }
];

export default function InvoicesPage() {
  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Create invoices, freeze cost snapshots, calculate GST/profit and auto-generate DO."
        action={<button className="rounded bg-brand px-4 py-2 text-sm font-medium text-white">Create Invoice</button>}
      />
      <div className="mb-5 rounded border border-line bg-white p-4">
        <h2 className="font-semibold">Invoice TS-0001 Items</h2>
        <div className="mt-3">
          <DataTable
            columns={[
              { key: "description", label: "Description" },
              { key: "quantity", label: "Qty", align: "right" },
              { key: "unitPrice", label: "Unit Price", align: "right" },
              { key: "costPriceSnapshot", label: "WAC Snapshot", align: "right" },
              { key: "amount", label: "Amount", align: "right" },
              { key: "gstAmount", label: "GST 9%", align: "right" },
              { key: "grossProfit", label: "Profit", align: "right" }
            ]}
            rows={invoicePreviewItems}
          />
        </div>
      </div>
      <DataTable
        columns={[
          { key: "invoiceNumber", label: "Invoice No" },
          { key: "customer", label: "Customer" },
          { key: "date", label: "Date" },
          { key: "subtotal", label: "Subtotal", align: "right" },
          { key: "gst", label: "GST", align: "right" },
          { key: "total", label: "Total", align: "right" },
          { key: "profit", label: "Profit", align: "right" },
          { key: "status", label: "Status" }
        ]}
        rows={invoiceRows}
      />
    </div>
  );
}
