"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Plus, RefreshCw, X } from "lucide-react";
import * as XLSX from "xlsx";

type Product = {
  id: string;
  sku: string;
  product_model: string;
  product_type: string;
  brand: string;
  opening_stock: number;
  current_stock: number;
  reserved_stock: number;
  minimum_stock: number;
};
type Movement = {
  id: string;
  product_id: string;
  movement_type: string;
  quantity: number;
  quantity_before: number | null;
  quantity_after: number | null;
  balance_after: number;
  reference_type: string | null;
  reference_number: string | null;
  remarks: string | null;
  active: boolean;
  created_at: string;
  product: { sku: string; product_model: string } | null;
  processed_by: { full_name: string } | null;
};
type InvoiceItem = {
  quantity: number;
  unit_price: number;
  unit_cost: number;
  discount_amount: number;
  product: {
    id: string;
    sku: string;
    product_model: string;
    product_type: string;
  } | null;
};
type Invoice = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  subtotal: number;
  gst_amount: number;
  grand_total: number;
  status: string;
  customer: { company_name: string } | null;
  items: InvoiceItem[];
  net_sales: number;
  cost: number;
  gross_profit: number;
};
type OperationsData = {
  products: Product[];
  movements: Movement[];
  invoices: Invoice[];
  start: string;
  end: string;
};

const money = (n: number) =>
  new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(
    n || 0,
  );
const number = (n: number) =>
  new Intl.NumberFormat("en-SG", { maximumFractionDigits: 3 }).format(n || 0);
const title = (s: string) =>
  s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
function exportXlsx(name: string, rows: Record<string, unknown>[]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Tesvila");
  XLSX.writeFile(wb, name);
}

function useOperations(start?: string, end?: string) {
  const [data, setData] = useState<OperationsData | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams();
      if (start) q.set("start", start);
      if (end) q.set("end", end);
      const r = await fetch(`/api/operations?${q}`);
      const body = await r.json();
      if (!r.ok)
        throw new Error(body.error || "Unable to load operations data");
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load data");
    } finally {
      setLoading(false);
    }
  }, [start, end]);
  useEffect(() => {
    // Initial and filter-driven API hydration intentionally updates local state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);
  return { data, error, loading, load };
}
function State({ loading, error }: { loading: boolean; error: string }) {
  if (loading)
    return <div className="card empty">Loading live Supabase data…</div>;
  if (error) return <div className="card empty danger-text">{error}</div>;
  return null;
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="card metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

export function InventoryOperations({
  notify,
}: {
  notify: (s: string) => void;
}) {
  const { data, error, loading, load } = useOperations();
  const [productId, setProductId] = useState("all"),
    [show, setShow] = useState(false);
  const products = data?.products || [],
    movements = data?.movements || [];
  const selected =
    productId === "all" ? products : products.filter((p) => p.id === productId);
  const ids = new Set(selected.map((p) => p.id));
  const relevant = movements.filter((m) => ids.has(m.product_id));
  const sum = (kind: string) =>
    relevant
      .filter((m) => m.movement_type === kind && m.active !== false)
      .reduce((s, m) => s + Math.abs(Number(m.quantity)), 0);
  const opening = selected.reduce((s, p) => s + Number(p.opening_stock), 0),
    current = selected.reduce((s, p) => s + Number(p.current_stock), 0),
    incoming = sum("incoming"),
    returned = sum("returned"),
    damaged = sum("damaged"),
    delivered = sum("outgoing");
  const computed = opening + incoming + returned - damaged - delivered;
  return (
    <>
      <div className="page-head row between">
        <div>
          <h2>Inventory Stock</h2>
          <p>
            Live balances calculated from opening stock and immutable movement
            history.
          </p>
        </div>
        <div className="row">
          <button className="btn" onClick={load}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button className="btn primary" onClick={() => setShow(true)}>
            <Plus size={13} /> Record movement
          </button>
        </div>
      </div>
      <State loading={loading} error={error} />
      {data && (
        <>
          <div className="card pad mb">
            <div className="field">
              <label>Product view</label>
              <select
                className="input"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                <option value="all">All Product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.product_model} · {p.sku}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid-4 mb">
            <Metric label="Total products" value={String(selected.length)} />
            <Metric label="Opening stock" value={number(opening)} />
            <Metric label="Current stock" value={number(current)} />
            <Metric label="Incoming" value={number(incoming)} />
            <Metric label="Damaged" value={number(damaged)} />
            <Metric label="Returned" value={number(returned)} />
            <Metric label="Delivery order qty" value={number(delivered)} />
            <Metric label="Formula check" value={number(computed)} />
          </div>
          {Math.abs(computed - current) > 0.001 && (
            <div className="card pad mb danger-text">
              Balance discrepancy detected: stored {number(current)}, movement
              formula {number(computed)}. Review legacy movements before this
              migration.
            </div>
          )}
          <div className="card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product ID</th>
                  <th>SKU</th>
                  <th>Product</th>
                  <th>Opening</th>
                  <th>Current</th>
                  <th>Reserved</th>
                  <th>Available</th>
                  <th>Minimum</th>
                </tr>
              </thead>
              <tbody>
                {selected.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>
                      <b>{p.sku}</b>
                    </td>
                    <td>
                      {p.product_model}
                      <div className="muted">
                        {p.product_type} · {p.brand}
                      </div>
                    </td>
                    <td>{number(p.opening_stock)}</td>
                    <td>
                      <b>{number(p.current_stock)}</b>
                    </td>
                    <td>{number(p.reserved_stock)}</td>
                    <td>
                      {number(
                        Number(p.current_stock) - Number(p.reserved_stock),
                      )}
                    </td>
                    <td>{number(p.minimum_stock)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {show && (
        <MovementModal
          products={products}
          close={() => setShow(false)}
          saved={async () => {
            setShow(false);
            await load();
            notify("Stock movement saved to Supabase");
          }}
        />
      )}
    </>
  );
}

function MovementModal({
  products,
  close,
  saved,
}: {
  products: Product[];
  close: () => void;
  saved: () => void;
}) {
  const [productId, setProductId] = useState(products[0]?.id || ""),
    [movementType, setMovementType] = useState("incoming"),
    [quantity, setQuantity] = useState(1),
    [referenceNumber, setReference] = useState(""),
    [remarks, setRemarks] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/operations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId,
          movementType,
          quantity,
          referenceNumber,
          remarks,
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Movement failed");
      saved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Movement failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-head">
          <b>Record stock movement</b>
          <button className="icon-btn" onClick={close}>
            <X size={15} />
          </button>
        </div>
        <div className="modal-body">
          <div className="grid-2">
            <div className="field">
              <label>Product</label>
              <select
                className="input"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                {products.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.sku} · {p.product_model}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Movement type</label>
              <select
                className="input"
                value={movementType}
                onChange={(e) => setMovementType(e.target.value)}
              >
                <option value="incoming">Incoming</option>
                <option value="damaged">Damaged</option>
                <option value="returned">Returned</option>
              </select>
            </div>
            <div className="field">
              <label>Quantity</label>
              <input
                className="input"
                type="number"
                min="0.001"
                step="0.001"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Reference number</label>
              <input
                className="input"
                value={referenceNumber}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
            <div className="field" style={{ gridColumn: "span 2" }}>
              <label>Remarks</label>
              <textarea
                className="input"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="danger-text">{error}</p>}
          <div
            className="row"
            style={{ justifyContent: "flex-end", marginTop: 18 }}
          >
            <button className="btn" onClick={close}>
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={busy || !productId || quantity <= 0}
              onClick={submit}
            >
              {busy ? "Saving…" : "Save movement"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StockMovementHistory() {
  const { data, error, loading, load } = useOperations();
  const [productId, setProductId] = useState("all"),
    [kind, setKind] = useState("all"),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [search, setSearch] = useState("");
  const rows = (data?.movements || []).filter(
    (m) =>
      (productId === "all" || m.product_id === productId) &&
      (kind === "all" || m.movement_type === kind) &&
      (!start || m.created_at.slice(0, 10) >= start) &&
      (!end || m.created_at.slice(0, 10) <= end) &&
      (!search ||
        `${m.product?.sku} ${m.product?.product_model} ${m.reference_number}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  return (
    <>
      <div className="page-head row between">
        <div>
          <h2>Stock Movement History</h2>
          <p>
            Full audit history including automatic delivery-order deductions and
            reversals.
          </p>
        </div>
        <div className="row">
          <button className="btn" onClick={load}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            className="btn"
            onClick={() =>
              exportXlsx(
                "stock-movement-history.xlsx",
                rows.map((m) => ({
                  Date: m.created_at,
                  Product: m.product?.product_model,
                  SKU: m.product?.sku,
                  Type: title(m.movement_type),
                  Quantity: m.quantity,
                  Before: m.quantity_before,
                  After: m.quantity_after ?? m.balance_after,
                  Reference: m.reference_number,
                  Source: m.reference_type,
                  Remarks: m.remarks,
                  ProcessedBy: m.processed_by?.full_name || "System",
                })),
              )
            }
          >
            <Download size={13} /> Export
          </button>
        </div>
      </div>
      <State loading={loading} error={error} />
      {data && (
        <>
          <div className="card pad filters mb">
            <input
              className="input"
              placeholder="Search product or reference"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="input"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="all">All Product</option>
              {data.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} · {p.product_model}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="all">All movement types</option>
              {["opening", "incoming", "outgoing", "damaged", "returned"].map(
                (x) => (
                  <option value={x} key={x}>
                    {title(x)}
                  </option>
                ),
              )}
            </select>
            <input
              className="input"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
            <input
              className="input"
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
          <div className="card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date & time</th>
                  <th>Product / SKU</th>
                  <th>Movement type</th>
                  <th>Quantity</th>
                  <th>Before</th>
                  <th>After</th>
                  <th>Source document</th>
                  <th>Reference</th>
                  <th>Remarks</th>
                  <th>Processed by</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td>{new Date(m.created_at).toLocaleString("en-SG")}</td>
                    <td>
                      {m.product?.product_model}
                      <div className="muted">{m.product?.sku}</div>
                    </td>
                    <td>
                      <span
                        className={`status ${m.movement_type === "damaged" ? "red" : m.movement_type === "outgoing" ? "amber" : ""}`}
                      >
                        {m.reference_type === "delivery_order"
                          ? "Delivery Order"
                          : title(m.movement_type)}
                      </span>
                    </td>
                    <td>
                      <b
                        className={Number(m.quantity) < 0 ? "danger-text" : ""}
                      >
                        {Number(m.quantity) > 0 ? "+" : ""}
                        {number(m.quantity)}
                      </b>
                    </td>
                    <td>{number(m.quantity_before ?? 0)}</td>
                    <td>{number(m.quantity_after ?? m.balance_after)}</td>
                    <td>{title(m.reference_type || "manual")}</td>
                    <td>{m.reference_number || "—"}</td>
                    <td>{m.remarks || "—"}</td>
                    <td>{m.processed_by?.full_name || "System"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

export function SalesReport() {
  const now = new Date(),
    [month, setMonth] = useState(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    ),
    [start, setStart] = useState(`${month}-01`),
    [end, setEnd] = useState(
      new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString()
        .slice(0, 10),
    );
  const { data, error, loading, load } = useOperations(start, end);
  const [productId, setProductId] = useState("all"),
    [customer, setCustomer] = useState("all");
  function changeMonth(v: string) {
    setMonth(v);
    const [y, m] = v.split("-").map(Number);
    setStart(`${v}-01`);
    setEnd(new Date(y, m, 0).toISOString().slice(0, 10));
  }
  const invoices = (data?.invoices || [])
    .map((i) => {
      const items = i.items.filter(
        (x) => productId === "all" || x.product?.id === productId,
      );
      const sales = items.reduce(
          (s, x) =>
            s +
            Number(x.quantity) * Number(x.unit_price) -
            Number(x.discount_amount || 0),
          0,
        ),
        cost = items.reduce(
          (s, x) => s + Number(x.quantity) * Number(x.unit_cost || 0),
          0,
        );
      return {
        ...i,
        items,
        net_sales: sales,
        cost,
        gross_profit: sales - cost,
      };
    })
    .filter(
      (i) =>
        i.items.length &&
        (customer === "all" || i.customer?.company_name === customer),
    );
  const totalSales = invoices.reduce((s, i) => s + i.net_sales, 0),
    totalCost = invoices.reduce((s, i) => s + i.cost, 0),
    profit = totalSales - totalCost,
    discount = invoices.reduce(
      (s, i) =>
        s + i.items.reduce((a, x) => a + Number(x.discount_amount || 0), 0),
      0,
    );
  const customers = Array.from(
    new Set(
      (data?.invoices || [])
        .map((i) => i.customer?.company_name)
        .filter(Boolean),
    ),
  ) as string[];
  return (
    <>
      <div className="page-head row between">
        <div>
          <h2>Monthly Sales Report</h2>
          <p>
            Calculated only from saved, non-void invoices using each line’s cost
            snapshot.
          </p>
        </div>
        <div className="row">
          <button className="btn" onClick={load}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            className="btn"
            onClick={() =>
              exportXlsx(
                "monthly-sales-report.xlsx",
                invoices.map((i) => ({
                  Invoice: i.invoice_number,
                  Date: i.invoice_date,
                  Customer: i.customer?.company_name,
                  Sales: i.net_sales,
                  Cost: i.cost,
                  GrossProfit: i.gross_profit,
                  Status: i.status,
                })),
              )
            }
          >
            <Download size={13} /> Export
          </button>
        </div>
      </div>
      <div className="card pad filters mb">
        <input
          className="input"
          type="month"
          value={month}
          onChange={(e) => changeMonth(e.target.value)}
        />
        <input
          className="input"
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <input
          className="input"
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
        <select
          className="input"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        >
          <option value="all">All products</option>
          {data?.products.map((p) => (
            <option value={p.id} key={p.id}>
              {p.sku} · {p.product_model}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
        >
          <option value="all">All customers</option>
          {customers.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>
      <State loading={loading} error={error} />
      {data && (
        <>
          <div className="grid-4 mb">
            <Metric label="Invoices" value={String(invoices.length)} />
            <Metric label="Sales amount" value={money(totalSales)} />
            <Metric label="Discount" value={money(discount)} />
            <Metric label="Cost" value={money(totalCost)} />
            <Metric label="Gross profit" value={money(profit)} />
            <Metric
              label="Margin"
              value={`${totalSales ? ((profit / totalSales) * 100).toFixed(1) : "0.0"}%`}
            />
          </div>
          <div className="card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Sales</th>
                  <th>Cost</th>
                  <th>Gross profit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <b>{i.invoice_number}</b>
                    </td>
                    <td>{i.invoice_date}</td>
                    <td>{i.customer?.company_name}</td>
                    <td>{i.items.map((x) => x.product?.sku).join(", ")}</td>
                    <td>{money(i.net_sales)}</td>
                    <td>{money(i.cost)}</td>
                    <td>
                      <b>{money(i.gross_profit)}</b>
                    </td>
                    <td>
                      <span className="status">{title(i.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
