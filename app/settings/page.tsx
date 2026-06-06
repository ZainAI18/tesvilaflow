import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/tables/data-table";

const settingsRows = [
  { setting: "Warehouses", value: "Main Warehouse, Showroom" },
  { setting: "GST Rate", value: "9% exclusive" },
  { setting: "Invoice Number", value: "TS-0001 continuous sequence" },
  { setting: "DO Number", value: "DOddMMyyyyNN daily sequence" },
  { setting: "PO Number", value: "POddMMyyyyNN daily sequence" },
  { setting: "Payment Methods", value: "Taobao, International Bank, TNG, Bank Transfer, Cash, Other" },
  { setting: "Roles", value: "Admin, Staff, Viewer" }
];

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Company defaults, users, roles, warehouses, number sequences, currencies and payment methods."
      />
      <DataTable
        columns={[
          { key: "setting", label: "Setting" },
          { key: "value", label: "Value" }
        ]}
        rows={settingsRows}
      />
    </div>
  );
}
