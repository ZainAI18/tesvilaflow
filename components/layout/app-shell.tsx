import Link from "next/link";
import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  FileText,
  Home,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/products", label: "Products", icon: Package },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/purchasing", label: "Purchasing", icon: ShoppingCart },
  { href: "/costing", label: "Costing", icon: ClipboardList },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/suppliers", label: "Suppliers", icon: Building2 },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/delivery-orders", label: "Delivery Orders", icon: Truck },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-panel text-ink">
      <aside className="fixed left-0 top-0 h-screen w-64 border-r border-line bg-white">
        <div className="border-b border-line px-5 py-5">
          <div className="text-lg font-semibold">Tesvila</div>
          <div className="text-xs text-muted">Inventory & Purchasing</div>
        </div>
        <nav className="space-y-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded px-3 py-2 text-sm text-ink hover:bg-panel"
              >
                <Icon className="h-4 w-4 text-muted" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="ml-64 min-h-screen flex-1">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-line bg-white px-6">
          <div>
            <div className="text-sm font-medium">Internal Management System</div>
            <div className="text-xs text-muted">DO completed stock-out, WAC costing, partial delivery ready</div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded bg-panel px-3 py-1">Admin</span>
            <FileText className="h-4 w-4 text-muted" />
          </div>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
