import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/tables/data-table";
import { customers } from "@/lib/demo-data";

export default function CustomersPage() {
  return (
    <div>
      <PageHeader
        title="Customers / Dealers"
        description="Manage dealer profiles, payment terms, addresses and price levels."
        action={<button className="rounded bg-brand px-4 py-2 text-sm font-medium text-white">Add Customer</button>}
      />
      <DataTable
        columns={[
          { key: "companyName", label: "Company" },
          { key: "contact", label: "Contact" },
          { key: "dealerType", label: "Dealer Type" },
          { key: "priceLevel", label: "Price Level" },
          { key: "paymentTerm", label: "Payment Term" },
          { key: "phone", label: "Phone" }
        ]}
        rows={customers}
      />
    </div>
  );
}
