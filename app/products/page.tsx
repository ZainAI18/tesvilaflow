import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/tables/data-table";
import { products } from "@/lib/demo-data";

export default function ProductsPage() {
  return (
    <div>
      <PageHeader
        title="Products"
        description="Manage sanitary ware and plumbing product master data, pricing, GST status and stock alerts."
        action={<button className="rounded bg-brand px-4 py-2 text-sm font-medium text-white">Add Product</button>}
      />
      <DataTable
        columns={[
          { key: "productCode", label: "Code" },
          { key: "productName", label: "Name" },
          { key: "brand", label: "Brand" },
          { key: "category", label: "Category" },
          { key: "supplier", label: "Supplier" },
          { key: "stock", label: "Stock", align: "right" },
          { key: "wac", label: "WAC", align: "right" },
          { key: "dealerPrice", label: "Dealer", align: "right" },
          { key: "retailPrice", label: "Retail", align: "right" },
          { key: "status", label: "Status" }
        ]}
        rows={products}
      />
    </div>
  );
}
