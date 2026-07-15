/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const */
"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as XLSX from "xlsx";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  Archive,
  BarChart3,
  Bell,
  Boxes,
  Check,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Copy,
  Download,
  FileDown,
  FilePlus2,
  FileText,
  GripVertical,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
  Upload,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import { DocumentProvider, DocumentWorkflow } from "./document-workflow";
import { ProductManager } from "./product-manager";
import { CustomerManager } from "./customer-manager";
import { DashboardManager } from "./dashboard-manager";
import tesvilaLogo from "../Logo original remove background.png";
import {
  InventoryOperations,
  SalesReport,
  StockMovementHistory,
} from "./operations-dashboard";

type Item = {
  id: number;
  model: string;
  sku: string;
  type: string;
  description: string;
  brand: string;
  qty: number;
  price: number;
  remarks: string;
};
type NavKey =
  | "Dashboard"
  | "Customers"
  | "Products"
  | "Create Invoice & DO"
  | "Delivery Order Only"
  | "Invoice History"
  | "Delivery Order History"
  | "Monthly Sales Report"
  | "Inventory Stock"
  | "Stock Movement History"
  | "User Management"
  | "Company Settings";
const money = (n: number) =>
  new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(
    n,
  );
const products = [
  {
    sku: "TV-WC-8801",
    model: "Aurelia WC-8801",
    category: "Water Closet",
    brand: "Tesvila",
    desc: "Rimless one-piece water closet",
    stock: 18,
    incoming: 12,
    outgoing: 22,
    reserved: 3,
    min: 10,
    cost: 245,
    price: 488,
  },
  {
    sku: "TV-BS-2210",
    model: "Luna BS-2210",
    category: "Basin",
    brand: "Tesvila",
    desc: "Counter-top ceramic basin",
    stock: 7,
    incoming: 5,
    outgoing: 14,
    reserved: 2,
    min: 8,
    cost: 98,
    price: 218,
  },
  {
    sku: "GR-FA-310",
    model: "Eurosmart 310",
    category: "Faucet",
    brand: "Grohe",
    desc: "Single lever basin mixer",
    stock: 25,
    incoming: 10,
    outgoing: 19,
    reserved: 4,
    min: 10,
    cost: 165,
    price: 329,
  },
  {
    sku: "TV-SH-908",
    model: "Verde SH-908",
    category: "Shower",
    brand: "Tesvila",
    desc: "Thermostatic rain shower set",
    stock: 12,
    incoming: 8,
    outgoing: 9,
    reserved: 1,
    min: 6,
    cost: 288,
    price: 568,
  },
  {
    sku: "KO-BT-442",
    model: "Evok BT-442",
    category: "Bathtub",
    brand: "Kohler",
    desc: "Freestanding acrylic bathtub",
    stock: 3,
    incoming: 2,
    outgoing: 4,
    reserved: 1,
    min: 3,
    cost: 920,
    price: 1680,
  },
];
const customers = [
  {
    name: "Meridian Build Pte Ltd",
    code: "CUS-001",
    contact: "Rachel Lim",
    phone: "+65 9123 4567",
    email: "accounts@meridianbuild.sg",
    credit: "30 days",
    sales: 68420,
  },
  {
    name: "Northstar Renovation",
    code: "CUS-002",
    contact: "Jason Ong",
    phone: "+65 8772 1901",
    email: "jason@northstar.sg",
    credit: "COD",
    sales: 31780,
  },
  {
    name: "Atelier Habitat Pte Ltd",
    code: "CUS-003",
    contact: "Mei Tan",
    phone: "+65 9231 0844",
    email: "finance@atelierhabitat.sg",
    credit: "30 days",
    sales: 26630,
  },
  {
    name: "Living Form Studio",
    code: "CUS-004",
    contact: "Amir Rahman",
    phone: "+65 8114 7210",
    email: "amir@livingform.sg",
    credit: "14 days",
    sales: 18450,
  },
];
const invoices = [
  {
    no: "TS-1387",
    date: "14 Jul 2026",
    customer: "Meridian Build Pte Ltd",
    po: "PO-MB-0714",
    doNo: "DO1407202601",
    total: 9461.7,
    balance: 4461.7,
    status: "Partially Paid",
  },
  {
    no: "TS-1386",
    date: "12 Jul 2026",
    customer: "Northstar Renovation",
    po: "PO-99120",
    doNo: "DO1207202602",
    total: 3727.78,
    balance: 0,
    status: "Paid",
  },
  {
    no: "TS-1385",
    date: "10 Jul 2026",
    customer: "Atelier Habitat Pte Ltd",
    po: "AH-260710",
    doNo: "DO1007202601",
    total: 6180.4,
    balance: 6180.4,
    status: "Overdue",
  },
  {
    no: "TS-1384",
    date: "08 Jul 2026",
    customer: "Living Form Studio",
    po: "LFS-447",
    doNo: "DO0807202601",
    total: 2316.84,
    balance: 0,
    status: "Paid",
  },
];
const dos = [
  {
    no: "DO1407202601",
    date: "14 Jul 2026",
    customer: "Meridian Build Pte Ltd",
    invoice: "TS-1387",
    items: 8,
    status: "Delivered",
  },
  {
    no: "DO1207202602",
    date: "12 Jul 2026",
    customer: "Northstar Renovation",
    invoice: "TS-1386",
    items: 5,
    status: "Delivered",
  },
  {
    no: "DO1207202601",
    date: "12 Jul 2026",
    customer: "Site Concepts Asia",
    invoice: "—",
    items: 3,
    status: "In Transit",
  },
  {
    no: "DO1007202601",
    date: "10 Jul 2026",
    customer: "Atelier Habitat Pte Ltd",
    invoice: "TS-1385",
    items: 12,
    status: "Delivered",
  },
];
const movements = [
  {
    date: "14 Jul 2026, 09:42",
    sku: "TV-WC-8801",
    model: "Aurelia WC-8801",
    type: "Outgoing",
    qty: -4,
    ref: "DO1407202601",
    by: "Marcus Lee",
  },
  {
    date: "14 Jul 2026, 09:41",
    sku: "TV-BS-2210",
    model: "Luna BS-2210",
    type: "Outgoing",
    qty: -4,
    ref: "DO1407202601",
    by: "Marcus Lee",
  },
  {
    date: "13 Jul 2026, 15:20",
    sku: "GR-FA-310",
    model: "Eurosmart 310",
    type: "Incoming",
    qty: 10,
    ref: "PO-IN-0261",
    by: "Marcus Lee",
  },
  {
    date: "12 Jul 2026, 16:08",
    sku: "KO-BT-442",
    model: "Evok BT-442",
    type: "Damaged",
    qty: -1,
    ref: "ADJ-0042",
    by: "Sarah Tan",
  },
  {
    date: "11 Jul 2026, 10:14",
    sku: "TV-SH-908",
    model: "Verde SH-908",
    type: "Returned",
    qty: 1,
    ref: "RTN-0018",
    by: "Marcus Lee",
  },
];
const salesTrend = [
  { m: "Feb", sales: 48200, cost: 29600 },
  { m: "Mar", sales: 56100, cost: 33100 },
  { m: "Apr", sales: 51400, cost: 30900 },
  { m: "May", sales: 68200, cost: 40100 },
  { m: "Jun", sales: 73800, cost: 42900 },
  { m: "Jul", sales: 86420, cost: 49200 },
];
const defaultItems: Item[] = [
  {
    id: 1,
    model: "Aurelia WC-8801",
    sku: "TV-WC-8801",
    type: "Water Closet",
    description: "Rimless one-piece water closet",
    brand: "Tesvila",
    qty: 4,
    price: 488,
    remarks: "S-trap 250mm",
  },
  {
    id: 2,
    model: "Eurosmart 310",
    sku: "GR-FA-310",
    type: "Faucet",
    description: "Single lever basin mixer",
    brand: "Grohe",
    qty: 4,
    price: 329,
    remarks: "Chrome finish",
  },
];
const navGroups = [
  ["Overview", [["Dashboard", LayoutDashboard]]],
  [
    "Sales",
    [
      ["Customers", Users],
      ["Products", Package],
      ["Create Invoice & DO", FilePlus2],
      ["Delivery Order Only", ClipboardList],
      ["Invoice History", ReceiptText],
      ["Delivery Order History", History],
      ["Monthly Sales Report", BarChart3],
    ],
  ],
  [
    "Warehouse",
    [
      ["Inventory Stock", Boxes],
      ["Stock Movement History", Activity],
    ],
  ],
  [
    "Administration",
    [
      ["User Management", ShieldCheck],
      ["Company Settings", Settings],
    ],
  ],
] as const;

function TesvilaShell() {
  const [page, setPage] = useState<NavKey>("Dashboard");
  const [menu, setMenu] = useState(false);
  const [accountMenu, setAccountMenu] = useState(false);
  const [session, setSession] = useState<{ username: string; access: "full" | "dashboard" } | null>(null);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<string | null>(null);
  const [gst, setGst] = useState(9);
  const [search, setSearch] = useState("");
  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 2600);
  };
  useEffect(() => {
    const handle = (e: Event) => notify((e as CustomEvent<string>).detail);
    window.addEventListener("tesvila-toast", handle);
    return () => window.removeEventListener("tesvila-toast", handle);
  }, []);
  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          window.location.replace("/login");
          return null;
        }
        return response.json();
      })
      .then((result) => result && setSession(result))
      .catch(() => window.location.replace("/login"));
  }, []);
  async function logOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.replace("/login");
  }
  const title = page;
  const today = new Intl.DateTimeFormat("en-SG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  const visibleNavGroups = session?.access === "dashboard" ? [navGroups[0]] : navGroups;
  const initials = session?.username.slice(0, 2).toUpperCase() || "TV";
  return (
    <div className="shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <div className="brand">
          <div className="sidebar-logo"><Image src={tesvilaLogo} alt="TESVILA logo" priority /></div>
          <div>
            <strong>TESVILA</strong>
            <span>Operations Suite</span>
          </div>
        </div>
        <div className="nav">
          {visibleNavGroups.map(([group, items]) => (
            <div key={group}>
              <div className="nav-section">{group}</div>
              {items.map(([n, I]) => (
                <button
                  key={n}
                  className={page === n ? "active" : ""}
                  onClick={() => {
                    setPage(n as NavKey);
                    setMenu(false);
                  }}
                >
                  <I />
                  {n}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="profile-wrap">
        {accountMenu && <div className="account-menu"><button onClick={() => void logOut()}><LogOut size={14} /> Log Out</button></div>}
        <button className="profile" onClick={() => setAccountMenu((value) => !value)} aria-expanded={accountMenu}>
          <div className="avatar">{initials}</div>
          <div>
            <b>{session?.username || "Loading..."}</b>
            <span>{session?.access === "dashboard" ? "Dashboard viewer" : "Administrator"}</span>
          </div>
          <ChevronDown size={13} />
        </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="row">
            <button
              className="icon-btn mobile-menu"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={17} />
            </button>
            <div>
              <h1>{title}</h1>
              <p>{today}</p>
            </div>
          </div>
          <div className="top-actions">
            <button
              className="icon-btn"
              onClick={() => notify("You’re all caught up")}
            >
              <Bell size={16} />
            </button>
            {session?.access !== "dashboard" && <button
              className="btn primary"
              onClick={() => setPage("Create Invoice & DO")}
            >
              <Plus size={14} /> Invoice
            </button>}
          </div>
        </header>
        <div className="content">
          {renderPage(page, {
            search,
            setSearch,
            notify,
            setPage,
            modal,
            setModal,
            gst,
            setGst,
          })}
        </div>
      </main>
      {menu && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 20 }}
          onClick={() => setMenu(false)}
        />
      )}{" "}
      {toast && (
        <div className="toast">
          <Check size={15} />
          {toast}
        </div>
      )}
    </div>
  );
}
export default function TesvilaApp() {
  return (
    <DocumentProvider>
      <TesvilaShell />
    </DocumentProvider>
  );
}
type Ctx = {
  search: string;
  setSearch: (s: string) => void;
  notify: (s: string) => void;
  setPage: (p: NavKey) => void;
  modal: string | null;
  setModal: (m: string | null) => void;
  gst: number;
  setGst: (n: number) => void;
};
function renderPage(page: NavKey, c: Ctx) {
  switch (page) {
    case "Dashboard":
      return <DashboardManager />;
    case "Customers":
  return <CustomerManager notify={c.notify} />;
    case "Products":
      return (
        <ProductManager
          search={c.search}
          setSearch={c.setSearch}
          notify={c.notify}
        />
      );
    case "Create Invoice & DO":
      return (
        <DocumentWorkflow
          mode="create-invoice"
          onNavigate={(p) => c.setPage(p as NavKey)}
        />
      );
    case "Delivery Order Only":
      return (
        <DocumentWorkflow
          mode="create-do"
          onNavigate={(p) => c.setPage(p as NavKey)}
        />
      );
    case "Invoice History":
      return <DocumentWorkflow mode="invoice-table" />;
    case "Delivery Order History":
      return <DocumentWorkflow mode="do-table" />;
    case "Monthly Sales Report":
      return <SalesReport />;
    case "Inventory Stock":
      return <InventoryOperations notify={c.notify} />;
    case "Stock Movement History":
      return <StockMovementHistory />;
    case "User Management":
      return <UsersPage c={c} />;
    case "Company Settings":
      return <SettingsPage c={c} />;
  }
}
function PageHead({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-head row between">
      <div>
        <h2>{title}</h2>
        <p>{sub}</p>
      </div>
      {children}
    </div>
  );
}
function Metric({
  label,
  value,
  delta,
  icon: I,
}: {
  label: string;
  value: string;
  delta: string;
  icon: any;
}) {
  return (
    <div className="card metric">
      <div className="row between">
        <span className="metric-label">{label}</span>
        <span className="kpi-icon">
          <I size={15} />
        </span>
      </div>
      <div className="metric-value number">{value}</div>
      <div className="delta">{delta}</div>
    </div>
  );
}
function Dashboard({ c }: { c: Ctx }) {
  return (
    <>
      <PageHead
        title="Good morning, Sarah"
        sub="Here’s what’s happening across Tesvila today."
      >
        <button
          className="btn"
          onClick={() => c.setPage("Monthly Sales Report")}
        >
          <FileDown size={13} /> Export report
        </button>
      </PageHead>
      <div className="grid-4">
        <Metric
          label="July sales"
          value="$86,420"
          delta="↑ 17.1% vs June"
          icon={CircleDollarSign}
        />
        <Metric
          label="Outstanding"
          value="$18,742"
          delta="6 invoices pending"
          icon={ReceiptText}
        />
        <Metric
          label="Orders this month"
          value="34"
          delta="↑ 8 from last month"
          icon={ShoppingBag}
        />
        <Metric
          label="Low stock items"
          value="4"
          delta="2 require attention"
          icon={AlertTriangle}
        />
      </div>
      <div className="grid-3 mt">
        <div className="card pad" style={{ gridColumn: "span 2" }}>
          <div className="row between mb">
            <div>
              <h3 className="section-title">Sales performance</h3>
              <p className="section-sub">Revenue and cost, last 6 months</p>
            </div>
            <span className="status">+17.1%</span>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesTrend}>
                <defs>
                  <linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#397b59" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#397b59" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#edf0ee" vertical={false} />
                <XAxis
                  dataKey="m"
                  axisLine={false}
                  tickLine={false}
                  fontSize={9}
                />
                <YAxis axisLine={false} tickLine={false} fontSize={9} />
                <Tooltip formatter={(v) => money(Number(v))} />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#397b59"
                  fill="url(#s)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card pad">
          <h3 className="section-title">Stock health</h3>
          <p className="section-sub">Inventory availability</p>
          <div style={{ height: 185 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={[
                    { n: "Healthy", v: 71 },
                    { n: "Low", v: 21 },
                    { n: "Out", v: 8 },
                  ]}
                  dataKey="v"
                  innerRadius={48}
                  outerRadius={69}
                  paddingAngle={3}
                >
                  <Cell fill="#347756" />
                  <Cell fill="#d9b66f" />
                  <Cell fill="#b9584f" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {[
            ["Healthy", "71%", "#347756"],
            ["Low stock", "21%", "#d9b66f"],
            ["Out of stock", "8%", "#b9584f"],
          ].map((x) => (
            <div
              className="row between"
              style={{ fontSize: 10, marginTop: 7 }}
              key={x[0]}
            >
              <span>
                <i
                  style={{
                    display: "inline-block",
                    width: 7,
                    height: 7,
                    borderRadius: 9,
                    background: x[2],
                    marginRight: 7,
                  }}
                />
                {x[0]}
              </span>
              <b>{x[1]}</b>
            </div>
          ))}
        </div>
      </div>
      <div className="grid-2 mt">
        <div className="card">
          <div className="pad row between">
            <div>
              <h3 className="section-title">Recent invoices</h3>
              <p className="section-sub">Latest billing activity</p>
            </div>
            <button
              className="btn sm"
              onClick={() => c.setPage("Invoice History")}
            >
              View all
            </button>
          </div>
          <InvoiceRows rows={invoices.slice(0, 3)} />
        </div>
        <div className="card pad">
          <div className="row between">
            <div>
              <h3 className="section-title">Stock alerts</h3>
              <p className="section-sub">Items below minimum level</p>
            </div>
            <button
              className="btn sm"
              onClick={() => c.setPage("Inventory Stock")}
            >
              Manage
            </button>
          </div>
          {products
            .filter((p) => p.stock <= p.min)
            .map((p) => (
              <div
                key={p.sku}
                className="row between"
                style={{ padding: "14px 0", borderBottom: "1px solid #edf0ee" }}
              >
                <div>
                  <b style={{ fontSize: 11 }}>{p.model}</b>
                  <div className="section-sub">
                    {p.sku} · Min {p.min}
                  </div>
                </div>
                <span className={`status ${p.stock < p.min ? "red" : "amber"}`}>
                  {p.stock} left
                </span>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
function Searchbar({
  c,
  placeholder = "Search records…",
}: {
  c: Ctx;
  placeholder?: string;
}) {
  return (
    <div className="search">
      <Search />
      <input
        className="input"
        placeholder={placeholder}
        value={c.search}
        onChange={(e) => c.setSearch(e.target.value)}
      />
    </div>
  );
}
function Customers({ c }: { c: Ctx }) {
  const list = customers.filter((x) =>
    x.name.toLowerCase().includes(c.search.toLowerCase()),
  );
  return (
    <>
      <PageHead
        title="Customers"
        sub={`${customers.length} active customer accounts`}
      >
        <button className="btn primary" onClick={() => c.setModal("customer")}>
          <Plus size={13} /> Add customer
        </button>
      </PageHead>
      <div className="card">
        <div className="pad toolbar">
          <Searchbar c={c} placeholder="Search customers…" />
          <button className="btn">
            <SlidersHorizontal size={13} /> Filters
          </button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Terms</th>
                <th>YTD Sales</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.code}>
                  <td>
                    <b>{x.name}</b>
                    <div className="muted">{x.code}</div>
                  </td>
                  <td>
                    {x.contact}
                    <div className="muted">{x.email}</div>
                  </td>
                  <td>{x.phone}</td>
                  <td>{x.credit}</td>
                  <td>
                    <b>{money(x.sales)}</b>
                  </td>
                  <td>
                    <span className="status">
                      <i className="dot" />
                      Active
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn sm"
                      onClick={() => c.notify(`${x.name} opened`)}
                    >
                      <Pencil size={11} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {c.modal === "customer" && (
        <SimpleModal
          title="Add customer"
          c={c}
          fields={[
            "Company name",
            "Contact person",
            "Email address",
            "Phone number",
            "Billing address",
          ]}
        />
      )}
    </>
  );
}
function Products({ c }: { c: Ctx }) {
  const list = products.filter((x) =>
    (x.model + x.sku + x.category)
      .toLowerCase()
      .includes(c.search.toLowerCase()),
  );
  return (
    <>
      <PageHead
        title="Products"
        sub={`${products.length} products across 5 categories`}
      >
        <div className="row">
          <button
            className="btn"
            onClick={() => exportSheet("tesvila-products.xlsx", products)}
          >
            <Download size={13} /> Export
          </button>
          <button className="btn primary" onClick={() => c.setModal("product")}>
            <Plus size={13} /> Add product
          </button>
        </div>
      </PageHead>
      <div className="card">
        <div className="pad toolbar">
          <Searchbar c={c} placeholder="Search model, SKU or category…" />
          <button className="btn">
            <SlidersHorizontal size={13} /> Filters
          </button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Model / SKU</th>
                <th>Category</th>
                <th>Brand</th>
                <th>Description</th>
                <th>Cost</th>
                <th>Sell price</th>
                <th>Stock</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.sku}>
                  <td>
                    <b>{x.model}</b>
                    <div className="muted">{x.sku}</div>
                  </td>
                  <td>{x.category}</td>
                  <td>{x.brand}</td>
                  <td>{x.desc}</td>
                  <td>{money(x.cost)}</td>
                  <td>
                    <b>{money(x.price)}</b>
                  </td>
                  <td>
                    <span className={`status ${x.stock <= x.min ? "red" : ""}`}>
                      {x.stock} units
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn sm"
                      onClick={() => c.notify(`${x.model} opened`)}
                    >
                      <Pencil size={11} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {c.modal === "product" && (
        <SimpleModal
          title="Add product"
          c={c}
          fields={[
            "Product model",
            "SKU",
            "Product category",
            "Brand",
            "Description",
            "Cost price",
            "Selling price",
            "Minimum stock",
          ]}
        />
      )}
    </>
  );
}
function SimpleModal({
  title,
  c,
  fields,
}: {
  title: string;
  c: Ctx;
  fields: string[];
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-head">
          <b>{title}</b>
          <button className="icon-btn" onClick={() => c.setModal(null)}>
            <X size={15} />
          </button>
        </div>
        <div className="modal-body">
          <div className="grid-2">
            {fields.map((f) => (
              <div className="field" key={f}>
                <label>{f}</label>
                <input
                  className="input"
                  placeholder={`Enter ${f.toLowerCase()}`}
                />
              </div>
            ))}
          </div>
          <div
            className="row"
            style={{ justifyContent: "flex-end", marginTop: 20 }}
          >
            <button className="btn" onClick={() => c.setModal(null)}>
              Cancel
            </button>
            <button
              className="btn primary"
              onClick={() => {
                c.setModal(null);
                c.notify(`${title.replace("Add ", "")} saved successfully`);
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
function DocumentEditor({ c, invoice = false }: { c: Ctx; invoice?: boolean }) {
  const [items, setItems] = useState<Item[]>(defaultItems);
  const [deposit, setDeposit] = useState(invoice ? 2000 : 0);
  const [customer, setCustomer] = useState(customers[0].name);
  const sub = items.reduce((s, x) => s + x.qty * x.price, 0),
    tax = (sub * c.gst) / 100,
    total = sub + tax,
    balance = total - deposit;
  const upd = (id: number, k: keyof Item, v: any) =>
    setItems(
      items.map((x) =>
        x.id === id
          ? { ...x, [k]: ["qty", "price"].includes(k) ? Number(v) : v }
          : x,
      ),
    );
  const add = () =>
    setItems([
      ...items,
      {
        id: Date.now(),
        model: "",
        sku: "",
        type: "",
        description: "",
        brand: "Tesvila",
        qty: 1,
        price: 0,
        remarks: "",
      },
    ]);
  const duplicate = (it: Item) =>
    setItems([...items, { ...it, id: Date.now() }]);
  return (
    <>
      <PageHead
        title={
          invoice ? "Create Invoice & Delivery Order" : "Create Delivery Order"
        }
        sub={
          invoice
            ? "One save creates both linked documents automatically."
            : "Create a standalone delivery order without an invoice."
        }
      >
        <span className="status gray">Draft autosaved</span>
      </PageHead>
      <div className="invoice-sheet">
        <div className="sheet-head">
          <div className="sheet-logo">
            TESVILA
            <small>
              TESVILA PTE LTD · UEN 202312345Z
              <br />
              18 Kaki Bukit Road 3, #04-12, Singapore 415978
            </small>
          </div>
          <div className="doc-title">
            <h2>{invoice ? "TAX INVOICE" : "DELIVERY ORDER"}</h2>
            <p>{invoice ? "TS-1388 · DO1407202602" : "DO1407202602"}</p>
          </div>
        </div>
        <div className="sheet-info">
          <div className="field">
            <label>Bill to / Customer *</label>
            <select
              className="input"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            >
              {customers.map((x) => (
                <option key={x.code}>{x.name}</option>
              ))}
            </select>
            <textarea
              className="input"
              rows={2}
              defaultValue="21 Woodlands Close, #06-18, Singapore 737854"
            />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>{invoice ? "Invoice date" : "Delivery date"}</label>
              <input className="input" type="date" defaultValue="2026-07-14" />
            </div>
            <div className="field">
              <label>PO number</label>
              <input className="input" defaultValue="PO-MB-0714" />
            </div>
            <div className="field">
              <label>Contact person</label>
              <input className="input" defaultValue="Rachel Lim" />
            </div>
            <div className="field">
              <label>Contact number</label>
              <input className="input" defaultValue="+65 9123 4567" />
            </div>
          </div>
        </div>
        <div className="items-editor">
          <div className="edit-row header">
            <div></div>
            <div>Product model</div>
            <div>SKU</div>
            <div>Type</div>
            <div>Description / Brand</div>
            <div>Qty</div>
            <div>Unit price</div>
            <div>Amount</div>
            <div>Actions</div>
          </div>
          {items.map((it, i) => (
            <div className="edit-row" key={it.id}>
              <div className="drag">
                <GripVertical size={14} />
              </div>
              <div>
                <input
                  className="input"
                  value={it.model}
                  onChange={(e) => upd(it.id, "model", e.target.value)}
                />
              </div>
              <div>
                <input
                  className="input"
                  value={it.sku}
                  onChange={(e) => upd(it.id, "sku", e.target.value)}
                />
              </div>
              <div>
                <input
                  className="input"
                  value={it.type}
                  onChange={(e) => upd(it.id, "type", e.target.value)}
                />
              </div>
              <div>
                <input
                  className="input"
                  value={it.description}
                  onChange={(e) => upd(it.id, "description", e.target.value)}
                />
                <input
                  className="input"
                  style={{ marginTop: 4 }}
                  value={it.remarks}
                  onChange={(e) => upd(it.id, "remarks", e.target.value)}
                  placeholder="Remarks"
                />
              </div>
              <div>
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={it.qty}
                  onChange={(e) => upd(it.id, "qty", e.target.value)}
                />
              </div>
              <div>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={it.price}
                  onChange={(e) => upd(it.id, "price", e.target.value)}
                />
              </div>
              <div>
                <b>{money(it.qty * it.price)}</b>
              </div>
              <div className="row" style={{ gap: 3 }}>
                <button
                  className="btn sm"
                  title="Duplicate"
                  onClick={() => duplicate(it)}
                >
                  <Copy size={10} />
                </button>
                <button
                  className="btn sm danger"
                  title="Delete"
                  disabled={items.length === 1}
                  onClick={() => setItems(items.filter((x) => x.id !== it.id))}
                >
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button className="btn mt" onClick={add}>
          <Plus size={12} /> Add item
        </button>
        {invoice && (
          <div className="totals">
            <div className="total-line">
              <span>Subtotal</span>
              <b>{money(sub)}</b>
            </div>
            <div className="total-line">
              <span>GST ({c.gst}%)</span>
              <b>{money(tax)}</b>
            </div>
            <div className="total-line">
              <span>Grand total</span>
              <b>{money(total)}</b>
            </div>
            <div className="total-line">
              <span>Deposit</span>
              <input
                className="input"
                style={{ width: 110, textAlign: "right" }}
                type="number"
                value={deposit}
                onChange={(e) => setDeposit(Number(e.target.value))}
              />
            </div>
            <div className="total-line grand">
              <span>Balance</span>
              <span>{money(balance)}</span>
            </div>
          </div>
        )}
        <div className="grid-2 mt">
          <div className="field">
            <label>Remarks</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Document remarks…"
            />
          </div>
          <div className="field">
            <label>
              {invoice ? "Payment method" : "Delivery instructions"}
            </label>
            <select className="input">
              <option>PayNow / Bank transfer</option>
              <option>Cheque</option>
              <option>Cash</option>
            </select>
            <textarea
              className="input"
              rows={2}
              defaultValue={
                invoice
                  ? "Pricing is confidential and intended only for the named recipient."
                  : "Please inspect all items upon delivery."
              }
            />
          </div>
        </div>
      </div>
      <div className="row between mt">
        <button className="btn" onClick={() => c.notify("Draft saved")}>
          <Archive size={13} /> Save draft
        </button>
        <div className="row">
          <button
            className="btn"
            onClick={() =>
              downloadPdf(
                invoice ? "TS-1388" : "DO1407202602",
                items,
                sub,
                c.gst,
                invoice,
                c.notify,
              )
            }
          >
            <FileText size={13} /> Preview PDF
          </button>
          <button
            className="btn primary"
            disabled={
              !customer ||
              items.some((x) => !x.model || x.qty <= 0 || x.price < 0)
            }
            onClick={() => {
              c.notify(
                invoice
                  ? "Invoice TS-1388 and DO1407202602 created"
                  : "Delivery order DO1407202602 created",
              );
              c.setPage(invoice ? "Invoice History" : "Delivery Order History");
            }}
          >
            <Check size={13} />{" "}
            {invoice ? "Create invoice & DO" : "Create delivery order"}
          </button>
        </div>
      </div>
    </>
  );
}
async function downloadPdf(
  no: string,
  items: Item[],
  sub: number,
  gst: number,
  invoice: boolean,
  notify: (s: string) => void,
) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica),
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595, 842],
    top = 760,
    rowH = 24,
    bottomReserve = invoice ? 190 : 150;
  let pages: any[] = [];
  let page: any,
    y = 0;
  const header = () => {
    page = doc.addPage(pageSize);
    pages.push(page);
    page.drawText("TESVILA PTE LTD", {
      x: 45,
      y: 797,
      size: 16,
      font: bold,
      color: rgb(0.07, 0.24, 0.16),
    });
    page.drawText(invoice ? "TAX INVOICE" : "DELIVERY ORDER", {
      x: 420,
      y: 797,
      size: 14,
      font: bold,
    });
    page.drawText(no, { x: 430, y: 778, size: 9, font });
    page.drawText("Customer: Meridian Build Pte Ltd", {
      x: 45,
      y: 750,
      size: 9,
      font,
    });
    page.drawRectangle({
      x: 45,
      y: 715,
      width: 505,
      height: 22,
      color: rgb(0.08, 0.24, 0.17),
    });
    ["Model / SKU", "Description", "Qty", "Unit Price", "Amount"].forEach(
      (t, i) =>
        page.drawText(t, {
          x: [52, 180, 390, 430, 500][i],
          y: 723,
          size: 7,
          font: bold,
          color: rgb(1, 1, 1),
        }),
    );
    y = 705;
  };
  header();
  for (const it of items) {
    if (y - rowH < bottomReserve) {
      header();
    }
    page.drawText(it.model.slice(0, 24), { x: 52, y, size: 8, font });
    page.drawText(it.description.slice(0, 38), { x: 180, y, size: 8, font });
    page.drawText(String(it.qty), { x: 395, y, size: 8, font });
    page.drawText(money(it.price), { x: 430, y, size: 8, font });
    page.drawText(money(it.qty * it.price), { x: 495, y, size: 8, font });
    page.drawLine({
      start: { x: 45, y: y - 7 },
      end: { x: 550, y: y - 7 },
      thickness: 0.3,
      color: rgb(0.85, 0.87, 0.86),
    });
    y -= rowH;
  }
  if (y < bottomReserve) header();
  if (invoice) {
    page.drawText(`Subtotal: ${money(sub)}`, {
      x: 400,
      y: y - 15,
      size: 9,
      font,
    });
    page.drawText(`GST (${gst}%): ${money((sub * gst) / 100)}`, {
      x: 400,
      y: y - 32,
      size: 9,
      font,
    });
    page.drawText(`Grand Total: ${money(sub * (1 + gst / 100))}`, {
      x: 400,
      y: y - 53,
      size: 11,
      font: bold,
    });
  } else
    page.drawText("Received in good order and condition.", {
      x: 45,
      y: y - 35,
      size: 9,
      font,
    });
  pages.forEach((p, i) =>
    p.drawText(`Page ${i + 1} of ${pages.length}`, {
      x: 485,
      y: 30,
      size: 7,
      font,
    }),
  );
  const blob = new Blob([(await doc.save()) as any], {
    type: "application/pdf",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${no}.pdf`;
  a.click();
  URL.revokeObjectURL(a.href);
  notify("PDF generated with automatic pagination");
}
function HistoryTable({ c, invoice = false }: { c: Ctx; invoice?: boolean }) {
  return (
    <>
      <PageHead
        title={invoice ? "Invoice History" : "Delivery Order History"}
        sub={
          invoice
            ? "Review, export and manage all invoices."
            : "Track linked and standalone delivery orders."
        }
      >
        <button
          className="btn"
          onClick={() =>
            exportSheet(
              invoice ? "invoices.xlsx" : "delivery-orders.xlsx",
              invoice ? invoices : dos,
            )
          }
        >
          <Download size={13} /> Export
        </button>
      </PageHead>
      <div className="card">
        <div className="pad toolbar">
          <Searchbar
            c={c}
            placeholder={`Search ${invoice ? "invoice" : "DO"} number or customer…`}
          />
          <div className="row">
            <input className="input" type="month" defaultValue="2026-07" />
            <button className="btn">
              <SlidersHorizontal size={13} /> Filters
            </button>
          </div>
        </div>
        {invoice ? (
          <InvoiceRows rows={invoices} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>DO Number</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Invoice</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {dos.map((x) => (
                  <tr key={x.no}>
                    <td>
                      <b>{x.no}</b>
                    </td>
                    <td>{x.date}</td>
                    <td>{x.customer}</td>
                    <td>{x.invoice}</td>
                    <td>{x.items}</td>
                    <td>
                      <span
                        className={`status ${x.status === "In Transit" ? "amber" : ""}`}
                      >
                        {x.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn sm"
                        onClick={() => c.notify(`${x.no} PDF downloaded`)}
                      >
                        <Download size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
function InvoiceRows({ rows }: { rows: typeof invoices }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Date</th>
            <th>Customer</th>
            <th>DO Number</th>
            <th>Total</th>
            <th>Balance</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.no}>
              <td>
                <b>{x.no}</b>
                <div className="muted">{x.po}</div>
              </td>
              <td>{x.date}</td>
              <td>{x.customer}</td>
              <td>{x.doNo}</td>
              <td>
                <b>{money(x.total)}</b>
              </td>
              <td>{money(x.balance)}</td>
              <td>
                <span
                  className={`status ${x.status === "Overdue" ? "red" : x.status === "Partially Paid" ? "amber" : ""}`}
                >
                  {x.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Reports({ c }: { c: Ctx }) {
  return (
    <>
      <PageHead
        title="Monthly Sales Report"
        sub="Revenue, costs and profitability across every invoiced sale."
      >
        <div className="row">
          <button
            className="btn"
            onClick={() => exportCsv("sales-report.csv", invoices)}
          >
            <FileDown size={13} /> CSV
          </button>
          <button
            className="btn"
            onClick={() => exportSheet("sales-report.xlsx", invoices)}
          >
            <FileDown size={13} /> Excel
          </button>
          <button
            className="btn primary"
            onClick={() => c.notify("Sales report PDF generated")}
          >
            <FileText size={13} /> PDF
          </button>
        </div>
      </PageHead>
      <div className="card pad mb">
        <div className="filters">
          <div className="field">
            <label>Month</label>
            <select className="input">
              <option>July</option>
            </select>
          </div>
          <div className="field">
            <label>Year</label>
            <select className="input">
              <option>2026</option>
            </select>
          </div>
          <div className="field">
            <label>Customer</label>
            <select className="input">
              <option>All customers</option>
              {customers.map((x) => (
                <option key={x.code}>{x.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Product</label>
            <select className="input">
              <option>All products</option>
            </select>
          </div>
          <div className="field">
            <label>Brand</label>
            <select className="input">
              <option>All brands</option>
            </select>
          </div>
          <div className="field">
            <label>Payment</label>
            <select className="input">
              <option>All statuses</option>
              <option>Paid</option>
              <option>Overdue</option>
            </select>
          </div>
        </div>
      </div>
      <div className="grid-4">
        <Metric
          label="Total sales"
          value="$86,420"
          delta="Net invoiced value"
          icon={CircleDollarSign}
        />
        <Metric
          label="Total GST"
          value="$7,138"
          delta="9% standard rate"
          icon={ReceiptText}
        />
        <Metric
          label="Gross profit"
          value="$37,220"
          delta="43.1% margin"
          icon={BarChart3}
        />
        <Metric
          label="Outstanding"
          value="$18,742"
          delta="21.7% of sales"
          icon={AlertTriangle}
        />
        <Metric
          label="Total cost"
          value="$49,200"
          delta="Cost of goods sold"
          icon={Boxes}
        />
        <Metric
          label="Invoices"
          value="34"
          delta="Avg $2,541.76"
          icon={FileText}
        />
        <Metric
          label="Quantity sold"
          value="186"
          delta="Across 42 SKUs"
          icon={ShoppingBag}
        />
        <Metric
          label="Avg invoice"
          value="$2,541.76"
          delta="↑ 4.6% vs June"
          icon={Activity}
        />
      </div>
      <div className="grid-2 mt">
        <div className="card pad">
          <h3 className="section-title">Monthly sales trend</h3>
          <p className="section-sub mb">Six-month revenue performance</p>
          <div className="chart">
            <ResponsiveContainer>
              <AreaChart data={salesTrend}>
                <CartesianGrid stroke="#edf0ee" vertical={false} />
                <XAxis dataKey="m" fontSize={9} />
                <YAxis fontSize={9} />
                <Tooltip />
                <Area
                  dataKey="sales"
                  stroke="#053a7c"
                  fill="#dcece3"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card pad">
          <h3 className="section-title">Sales versus cost</h3>
          <p className="section-sub mb">Gross margin by month</p>
          <div className="chart">
            <ResponsiveContainer>
              <BarChart data={salesTrend}>
                <CartesianGrid stroke="#edf0ee" vertical={false} />
                <XAxis dataKey="m" fontSize={9} />
                <YAxis fontSize={9} />
                <Tooltip />
                <Bar dataKey="sales" fill="#053a7c" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cost" fill="#d9b66f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card pad">
          <h3 className="section-title">Top customers</h3>
          {customers.map((x, i) => (
            <div key={x.code} style={{ marginTop: 17 }}>
              <div className="row between" style={{ fontSize: 10 }}>
                <b>
                  {i + 1}. {x.name}
                </b>
                <span>{money(x.sales)}</span>
              </div>
              <div className="progress mt" style={{ marginTop: 6 }}>
                <span
                  style={{ width: `${(x.sales / customers[0].sales) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="card pad">
          <h3 className="section-title">Top-selling products</h3>
          {products.slice(0, 4).map((x, i) => (
            <div
              className="row between"
              style={{ padding: "13px 0", borderBottom: "1px solid #edf0ee" }}
              key={x.sku}
            >
              <div>
                <b style={{ fontSize: 10 }}>{x.model}</b>
                <div className="section-sub">{x.category}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <b style={{ fontSize: 10 }}>{x.outgoing} units</b>
                <div className="section-sub">{money(x.outgoing * x.price)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
function Inventory({ c }: { c: Ctx }) {
  return (
    <>
      <PageHead
        title="Inventory Stock"
        sub="Real-time stock position across all warehouse locations."
      >
        <div className="row">
          <button
            className="btn"
            onClick={() => c.notify("Choose an Excel inventory file to import")}
          >
            <Upload size={13} /> Import
          </button>
          <button
            className="btn"
            onClick={() => exportSheet("inventory.xlsx", products)}
          >
            <Download size={13} /> Export
          </button>
          <button className="btn primary" onClick={() => c.setModal("stock")}>
            <Plus size={13} /> Stock movement
          </button>
        </div>
      </PageHead>
      <div className="grid-4 mb">
        <Metric
          label="Stock value"
          value="$64,280"
          delta="At current cost"
          icon={Warehouse}
        />
        <Metric
          label="Available units"
          value="59"
          delta="11 reserved units"
          icon={PackageCheck}
        />
        <Metric
          label="Low stock"
          value="4"
          delta="Requires replenishment"
          icon={AlertTriangle}
        />
        <Metric
          label="Movements today"
          value="8"
          delta="Last at 09:42"
          icon={Activity}
        />
      </div>
      <div className="card">
        <div className="pad toolbar">
          <Searchbar c={c} placeholder="Search SKU, model or description…" />
          <button className="btn">
            <SlidersHorizontal size={13} /> Status
          </button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>SKU / Model</th>
                <th>Description</th>
                <th>Opening</th>
                <th>Incoming</th>
                <th>Outgoing</th>
                <th>Current</th>
                <th>Reserved</th>
                <th>Available</th>
                <th>Minimum</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((x) => {
                const opening = x.stock - x.incoming + x.outgoing,
                  avail = x.stock - x.reserved;
                return (
                  <tr key={x.sku}>
                    <td>
                      <b>{x.sku}</b>
                      <div className="muted">{x.model}</div>
                    </td>
                    <td>{x.desc}</td>
                    <td>{opening}</td>
                    <td style={{ color: "#287149" }}>+{x.incoming}</td>
                    <td className="danger-text">-{x.outgoing}</td>
                    <td>
                      <b>{x.stock}</b>
                    </td>
                    <td>{x.reserved}</td>
                    <td>
                      <b>{avail}</b>
                    </td>
                    <td>{x.min}</td>
                    <td>
                      <span
                        className={`status ${x.stock < x.min ? "red" : x.stock === x.min ? "amber" : ""}`}
                      >
                        {x.stock < x.min
                          ? "Low"
                          : x.stock === x.min
                            ? "At minimum"
                            : "Healthy"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {c.modal === "stock" && <StockModal c={c} />}
    </>
  );
}
function StockModal({ c }: { c: Ctx }) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-head">
          <b>Record stock movement</b>
          <button className="icon-btn" onClick={() => c.setModal(null)}>
            <X size={15} />
          </button>
        </div>
        <div className="modal-body">
          <div className="grid-2">
            <div className="field">
              <label>Movement type</label>
              <select className="input">
                <option>Incoming stock</option>
                <option>Damaged stock</option>
                <option>Returned stock</option>
                <option>Reserved stock</option>
              </select>
            </div>
            <div className="field">
              <label>Product</label>
              <select className="input">
                {products.map((x) => (
                  <option key={x.sku}>
                    {x.sku} — {x.model}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Quantity *</label>
              <input className="input" type="number" min="1" defaultValue="1" />
            </div>
            <div className="field">
              <label>Reference</label>
              <input
                className="input"
                placeholder="PO / adjustment reference"
              />
            </div>
          </div>
          <div className="field mt">
            <label>Reason / remarks</label>
            <textarea className="input" rows={3} />
          </div>
          <div
            className="row"
            style={{ justifyContent: "flex-end", marginTop: 20 }}
          >
            <button className="btn" onClick={() => c.setModal(null)}>
              Cancel
            </button>
            <button
              className="btn primary"
              onClick={() => {
                c.setModal(null);
                c.notify("Stock updated and audit log created");
              }}
            >
              Confirm movement
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
function Movements({ c }: { c: Ctx }) {
  return (
    <>
      <PageHead
        title="Stock Movement History"
        sub="Immutable audit trail of every inventory change."
      >
        <button
          className="btn"
          onClick={() => exportSheet("stock-movements.xlsx", movements)}
        >
          <Download size={13} /> Export
        </button>
      </PageHead>
      <div className="card">
        <div className="pad toolbar">
          <Searchbar c={c} placeholder="Search SKU, model or reference…" />
          <div className="row">
            <input className="input" type="date" defaultValue="2026-07-14" />
            <button className="btn">
              <SlidersHorizontal size={13} /> Type
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date & time</th>
                <th>SKU / Model</th>
                <th>Movement</th>
                <th>Quantity</th>
                <th>Reference</th>
                <th>Processed by</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((x, i) => (
                <tr key={i}>
                  <td>{x.date}</td>
                  <td>
                    <b>{x.sku}</b>
                    <div className="muted">{x.model}</div>
                  </td>
                  <td>
                    <span
                      className={`status ${x.type === "Damaged" ? "red" : x.type === "Outgoing" ? "amber" : ""}`}
                    >
                      {x.type}
                    </span>
                  </td>
                  <td>
                    <b className={x.qty < 0 ? "danger-text" : ""}>
                      {x.qty > 0 ? "+" : ""}
                      {x.qty}
                    </b>
                  </td>
                  <td>{x.ref}</td>
                  <td>{x.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
function Uploader({ c, invoice = false }: { c: Ctx; invoice?: boolean }) {
  const [file, setFile] = useState<File | null>(null),
    [confirm, setConfirm] = useState(false),
    [drag, setDrag] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const choose = (f?: File) => {
    if (!f) return;
    if (!/\.(pdf|png|jpe?g)$/i.test(f.name)) {
      c.notify("Use a PDF, PNG, JPG or JPEG file");
      return;
    }
    setFile(f);
    setTimeout(() => setConfirm(true), 650);
  };
  return (
    <>
      <PageHead
        title={invoice ? "Upload Invoice" : "Upload Delivery Order"}
        sub={
          invoice
            ? "Extract invoice data with AI, review it, then confirm the import."
            : "Review extracted delivery items before inventory is deducted."
        }
      />
      {!confirm ? (
        <div
          className={`dropzone ${drag ? "dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            choose(e.dataTransfer.files[0]);
          }}
        >
          <input
            ref={ref}
            type="file"
            hidden
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(e) => choose(e.target.files?.[0])}
          />
          <div className="drop-icon">
            <Upload size={24} />
          </div>
          <h3 style={{ fontSize: 14 }}>
            Drag and drop your {invoice ? "invoice" : "delivery order"}
          </h3>
          <p className="section-sub">PDF, PNG, JPG or JPEG · maximum 10 MB</p>
          <button
            className="btn primary mt"
            onClick={() => ref.current?.click()}
          >
            Browse files
          </button>
          <p className="section-sub" style={{ marginTop: 25 }}>
            Nothing is saved until you review and confirm the extracted data.
          </p>
        </div>
      ) : (
        <Extracted
          c={c}
          invoice={invoice}
          file={file!}
          cancel={() => {
            setConfirm(false);
            setFile(null);
          }}
        />
      )}
    </>
  );
}
function Extracted({
  c,
  invoice,
  file,
  cancel,
}: {
  c: Ctx;
  invoice: boolean;
  file: File;
  cancel: () => void;
}) {
  const [no, setNo] = useState(invoice ? "TS-1381" : "DO0907202603");
  return (
    <div className="card">
      <div
        className="pad row between"
        style={{ borderBottom: "1px solid #e6e9e7" }}
      >
        <div className="row">
          <span className="kpi-icon">
            <FileText size={16} />
          </span>
          <div>
            <b style={{ fontSize: 11 }}>{file.name}</b>
            <div className="section-sub">
              Extraction complete · 96% confidence
            </div>
          </div>
        </div>
        <span className="status">
          <Check size={10} /> Ready for review
        </span>
      </div>
      <div className="pad">
        <div className="grid-3">
          <div className="field">
            <label>{invoice ? "Invoice" : "DO"} number *</label>
            <input
              className="input"
              value={no}
              onChange={(e) => setNo(e.target.value)}
            />
          </div>
          <div className="field">
            <label>{invoice ? "Invoice" : "Delivery"} date</label>
            <input className="input" type="date" defaultValue="2026-07-09" />
          </div>
          <div className="field">
            <label>Customer</label>
            <input className="input" defaultValue="Northstar Renovation" />
          </div>
          {invoice && (
            <>
              <div className="field">
                <label>PO number</label>
                <input className="input" defaultValue="PO-99114" />
              </div>
              <div className="field">
                <label>DO number</label>
                <input className="input" defaultValue="DO0907202603" />
              </div>
            </>
          )}
        </div>
        <div className="table-wrap mt">
          <table className="table">
            <thead>
              <tr>
                <th>Product model</th>
                <th>Description</th>
                <th>Quantity</th>
                {invoice && (
                  <>
                    <th>Unit price</th>
                    <th>Amount</th>
                  </>
                )}
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {defaultItems.map((x) => (
                <tr key={x.id}>
                  <td>
                    <input className="input" defaultValue={x.model} />
                  </td>
                  <td>
                    <input className="input" defaultValue={x.description} />
                  </td>
                  <td>
                    <input
                      className="input"
                      type="number"
                      defaultValue={x.qty}
                    />
                  </td>
                  {invoice && (
                    <>
                      <td>
                        <input className="input" defaultValue={x.price} />
                      </td>
                      <td>{money(x.qty * x.price)}</td>
                    </>
                  )}
                  <td>
                    <input className="input" defaultValue={x.remarks} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {invoice && (
          <div className="totals">
            <div className="total-line">
              <span>Subtotal</span>
              <b>{money(3268)}</b>
            </div>
            <div className="total-line">
              <span>GST</span>
              <b>{money(294.12)}</b>
            </div>
            <div className="total-line grand">
              <span>Grand total</span>
              <span>{money(3562.12)}</span>
            </div>
          </div>
        )}
        <div className="row between mt">
          <button className="btn" onClick={cancel}>
            Discard
          </button>
          <button
            className="btn primary"
            disabled={!no}
            onClick={() => {
              if (
                (invoice && invoices.some((x) => x.no === no)) ||
                (!invoice && dos.some((x) => x.no === no))
              ) {
                c.notify(
                  `Duplicate ${invoice ? "invoice" : "delivery order"} number — nothing was processed`,
                );
                return;
              }
              c.notify(
                invoice
                  ? "Invoice imported into sales reporting"
                  : "Delivery order processed and inventory deducted once",
              );
              c.setPage(invoice ? "Invoice History" : "Stock Movement History");
            }}
          >
            <Check size={13} />{" "}
            {invoice ? "Confirm & save invoice" : "Confirm & deduct stock"}
          </button>
        </div>
      </div>
    </div>
  );
}
function UsersPage({ c }: { c: Ctx }) {
  const users = [
    {
      name: "Sarah Tan",
      email: "sarah@tesvila.com.sg",
      role: "Admin",
      last: "Today, 09:28",
    },
    {
      name: "Daniel Koh",
      email: "daniel@tesvila.com.sg",
      role: "Sales",
      last: "Today, 08:51",
    },
    {
      name: "Marcus Lee",
      email: "marcus@tesvila.com.sg",
      role: "Warehouse",
      last: "Today, 09:42",
    },
    {
      name: "Jean Ng",
      email: "jean@tesvila.com.sg",
      role: "Accounts",
      last: "Yesterday, 17:32",
    },
    {
      name: "Olivia Chua",
      email: "olivia@tesvila.com.sg",
      role: "Viewer",
      last: "11 Jul 2026",
    },
  ];
  return (
    <>
      <PageHead
        title="User Management"
        sub="Control access with role-based permissions."
      >
        <button className="btn primary" onClick={() => c.setModal("user")}>
          <Plus size={13} /> Invite user
        </button>
      </PageHead>
      <div className="grid-4 mb">
        {["Admin", "Sales", "Warehouse", "Accounts"].map((x, i) => (
          <div className="card pad" key={x}>
            <div className="metric-label">{x}</div>
            <div className="metric-value">{i ? 1 : 2}</div>
            <div className="section-sub">active users</div>
          </div>
        ))}
      </div>
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Last active</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((x) => (
              <tr key={x.email}>
                <td>
                  <b>{x.name}</b>
                  <div className="muted">{x.email}</div>
                </td>
                <td>
                  <select
                    className="input"
                    defaultValue={x.role}
                    onChange={() => c.notify("Role updated and audit logged")}
                  >
                    {["Admin", "Sales", "Warehouse", "Accounts", "Viewer"].map(
                      (r) => (
                        <option key={r}>{r}</option>
                      ),
                    )}
                  </select>
                </td>
                <td>{x.last}</td>
                <td>
                  <span className="status">Active</span>
                </td>
                <td>
                  <button
                    className="btn sm"
                    onClick={() =>
                      c.notify(`Access settings opened for ${x.name}`)
                    }
                  >
                    <Settings size={11} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {c.modal === "user" && (
        <SimpleModal
          title="Invite user"
          c={c}
          fields={["Full name", "Email address", "Role"]}
        />
      )}
    </>
  );
}
function SettingsPage({ c }: { c: Ctx }) {
  return (
    <>
      <PageHead
        title="Company Settings"
        sub="Company identity, tax, numbering and document defaults."
      />
      <div className="grid-3">
        <div className="card pad" style={{ gridColumn: "span 2" }}>
          <h3 className="section-title">Company information</h3>
          <p className="section-sub mb">
            Shown on invoices and delivery orders.
          </p>
          <div className="grid-2">
            <div className="field">
              <label>Legal name</label>
              <input className="input" defaultValue="Tesvila Pte Ltd" />
            </div>
            <div className="field">
              <label>UEN</label>
              <input className="input" defaultValue="202312345Z" />
            </div>
            <div className="field" style={{ gridColumn: "span 2" }}>
              <label>Registered address</label>
              <textarea
                className="input"
                defaultValue="18 Kaki Bukit Road 3, #04-12, Singapore 415978"
              />
            </div>
            <div className="field">
              <label>Telephone</label>
              <input className="input" defaultValue="+65 6748 3388" />
            </div>
            <div className="field">
              <label>Email</label>
              <input className="input" defaultValue="accounts@tesvila.com.sg" />
            </div>
          </div>
          <h3 className="section-title mt" style={{ marginTop: 25 }}>
            Document numbering
          </h3>
          <div className="grid-2 mt">
            <div className="field">
              <label>Invoice prefix</label>
              <input className="input" defaultValue="TS-" />
            </div>
            <div className="field">
              <label>Last sequence</label>
              <input className="input" defaultValue="1387" disabled />
            </div>
            <div className="field">
              <label>DO format</label>
              <input
                className="input"
                defaultValue="DO + DDMMYYYY + daily sequence"
                disabled
              />
            </div>
            <div className="field">
              <label>Next DO</label>
              <input className="input" defaultValue="DO1407202602" disabled />
            </div>
          </div>
        </div>
        <div>
          <div className="card pad">
            <h3 className="section-title">GST configuration</h3>
            <p className="section-sub mb">Applied to new invoices.</p>
            <div className="field">
              <label>GST rate (%)</label>
              <input
                className="input"
                type="number"
                min="0"
                max="100"
                value={c.gst}
                onChange={(e) => c.setGst(Number(e.target.value))}
              />
            </div>
            <label className="row mt" style={{ fontSize: 10 }}>
              <input type="checkbox" className="check" defaultChecked /> GST
              registered company
            </label>
          </div>
          <div className="card pad mt">
            <h3 className="section-title">PayNow & logo</h3>
            <p className="section-sub">Stored securely for PDF generation.</p>
            <button
              className="btn mt"
              onClick={() => c.notify("Choose a PayNow QR image")}
            >
              <Upload size={13} /> Upload QR code
            </button>
            <button
              className="btn mt"
              onClick={() => c.notify("Choose a company logo")}
            >
              <Upload size={13} /> Upload logo
            </button>
          </div>
        </div>
      </div>
      <div className="card pad mt">
        <div className="row between">
          <div>
            <h3 className="section-title">Terms and conditions</h3>
            <p className="section-sub">
              Default text rendered after the final item row.
            </p>
          </div>
          <button
            className="btn primary"
            onClick={() => c.notify("Company settings saved")}
          >
            Save settings
          </button>
        </div>
        <div className="grid-2 mt">
          <div className="field">
            <label>Invoice terms</label>
            <textarea
              className="input"
              rows={5}
              defaultValue={
                "Payment is due according to the agreed credit terms. Goods sold are not returnable without prior written approval. Pricing is confidential."
              }
            />
          </div>
          <div className="field">
            <label>Delivery order terms</label>
            <textarea
              className="input"
              rows={5}
              defaultValue={
                "Please inspect all goods upon delivery. Any discrepancy or damage must be reported within 24 hours. Signature confirms receipt in good order."
              }
            />
          </div>
        </div>
      </div>
    </>
  );
}
function exportSheet(name: string, data: any[]) {
  const ws = XLSX.utils.json_to_sheet(data),
    wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tesvila");
  XLSX.writeFile(wb, name);
}
function exportCsv(name: string, data: any[]) {
  const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(data));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
