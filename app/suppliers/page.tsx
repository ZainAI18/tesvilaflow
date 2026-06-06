import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/tables/data-table";
import { suppliers } from "@/lib/demo-data";

export default function SuppliersPage() {
  return (
    <div>
      <PageHeader
        title="Suppliers"
        description="Supplier contacts, currencies, payment terms and purchase history."
        action={<button className="rounded bg-brand px-4 py-2 text-sm font-medium text-white">Add Supplier</button>}
      />
      <DataTable
        columns={[
          { key: "supplierName", label: "Supplier" },
          { key: "contact", label: "Contact" },
          { key: "currency", label: "Currency" },
          { key: "paymentTerm", label: "Payment Term" },
          { key: "phone", label: "Phone" }
        ]}
        rows={suppliers}
      />
    </div>
  );
}
