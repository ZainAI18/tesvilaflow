"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Plus, RefreshCw, X } from "lucide-react";
import * as XLSX from "xlsx";
import { authFetch } from "@/lib/client-auth";

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
type SalesReportData = {
  availableMonths: string[];
  products: Array<{
    id: string;
    sku: string;
    product_model: string;
    description: string;
  }>;
  customers: Array<{ key: string; company_name: string }>;
  summary: {
    invoices: number;
    salesAmount: number;
    discount: number;
    cost: number;
    grossProfit: number;
    margin: number;
  };
  invoices: Array<{
    id: string;
    invoice_number: string;
    invoice_date: string;
    customer_company: string;
    items: string[];
    sales: number;
    cost: number;
    gross_profit: number;
    status: string;
  }>;
  details: unknown[];
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
      const r = await authFetch(`/api/operations?${q}`);
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
      const r = await authFetch("/api/operations", {
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

function monthName(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-SG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function ReportSearchFilter({
  label,
  allLabel,
  listId,
  value,
  options,
  onChange,
}: {
  label: string;
  allLabel: string;
  listId: string;
  value: string;
  options: Array<{ key: string; label: string }>;
  onChange: (key: string) => void;
}) {
  const selectedLabel =
    value === "all"
      ? allLabel
      : options.find((option) => option.key === value)?.label || "";
  const [text, setText] = useState(selectedLabel);
  return (
    <div className="field">
      <label>{label}</label>
      <input
        className="input"
        list={listId}
        value={text}
        placeholder={allLabel}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          if (!next || next === allLabel) onChange("all");
          const match = options.find((option) => option.label === next);
          if (match) onChange(match.key);
        }}
        onBlur={() => {
          if (!options.some((option) => option.label === text) && text !== allLabel)
            setText(selectedLabel);
        }}
      />
      <datalist id={listId}>
        <option value={allLabel} />
        {options.map((option) => (
          <option key={option.key} value={option.label} />
        ))}
      </datalist>
    </div>
  );
}

export function SalesReport() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(currentMonth);
  const [start, setStart] = useState(`${currentMonth}-01`);
  const [end, setEnd] = useState(
    new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10),
  );
  const [productId, setProductId] = useState("all");
  const [customerKey, setCustomerKey] = useState("all");
  const [data, setData] = useState<SalesReportData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const query = useCallback(
    () => new URLSearchParams({ start, end, productId, customerKey }),
    [start, end, productId, customerKey],
  );
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authFetch(`/api/sales-report?${query()}`);
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Unable to load sales report.");
      setData(body);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load sales report.",
      );
    } finally {
      setLoading(false);
    }
  }, [query]);
  useEffect(() => {
    // Filter changes intentionally refresh the server-calculated report.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function changeMonth(value: string) {
    if (!value) return;
    setMonth(value);
    const [year, monthNumber] = value.split("-").map(Number);
    setStart(`${value}-01`);
    setEnd(new Date(year, monthNumber, 0).toISOString().slice(0, 10));
  }

  async function exportReport() {
    if (!data?.details.length || exporting) return;
    setExporting(true);
    setExportError("");
    try {
      const response = await authFetch(`/api/sales-report/export?${query()}`);
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Excel export failed.");
      }
      const disposition = response.headers.get("content-disposition") || "";
      const filename =
        disposition.match(/filename="([^"]+)"/)?.[1] ||
        "TESVILA_Monthly_Sales_Report.xlsx";
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setExportError(
        downloadError instanceof Error
          ? downloadError.message
          : "Excel export failed.",
      );
    } finally {
      setExporting(false);
    }
  }

  const summary = data?.summary || {
    invoices: 0,
    salesAmount: 0,
    discount: 0,
    cost: 0,
    grossProfit: 0,
    margin: 0,
  };
  const productOptions = (data?.products || []).map((product) => ({
    key: product.id,
    label: [product.sku, product.product_model, product.description]
      .filter(Boolean)
      .join(" — "),
  }));
  const customerOptions = (data?.customers || []).map((customer) => ({
    key: customer.key,
    label: customer.company_name,
  }));

  return (
    <>
      <div className="page-head row between">
        <div>
          <h2>Monthly Sales Report</h2>
          <p>
            Calculated only from saved, non-void invoices using each line&apos;s
            cost snapshot.
          </p>
        </div>
        <div className="row">
          <button className="btn" onClick={load} disabled={loading}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            className="btn"
            onClick={exportReport}
            disabled={exporting || loading || !data?.details.length}
          >
            <Download size={13} /> {exporting ? "Exporting..." : "Export"}
          </button>
        </div>
      </div>
      {exportError && <div className="notice error">{exportError}</div>}
      <div className="card pad filters mb">
        <div className="field">
          <label>Month</label>
          <select
            className="input"
            value={month}
            onChange={(event) => changeMonth(event.target.value)}
          >
            {month === "" && <option value="">Custom date range</option>}
            {(data?.availableMonths || [month])
              .filter(Boolean)
              .map((value) => (
                <option value={value} key={value}>
                  {monthName(value)}
                </option>
              ))}
          </select>
        </div>
        <div className="field">
          <label>Start Date</label>
          <input
            className="input"
            type="date"
            value={start}
            onChange={(event) => {
              setMonth("");
              setStart(event.target.value);
            }}
          />
        </div>
        <div className="field">
          <label>End Date</label>
          <input
            className="input"
            type="date"
            value={end}
            onChange={(event) => {
              setMonth("");
              setEnd(event.target.value);
            }}
          />
        </div>
        <ReportSearchFilter
          key={`product-${productId}-${productOptions.length}`}
          label="Product"
          allLabel="All Products"
          listId="sales-report-products"
          value={productId}
          options={productOptions}
          onChange={setProductId}
        />
        <ReportSearchFilter
          key={`customer-${customerKey}-${customerOptions.length}`}
          label="Customer"
          allLabel="All Customers"
          listId="sales-report-customers"
          value={customerKey}
          options={customerOptions}
          onChange={setCustomerKey}
        />
      </div>
      <State loading={loading} error={error} />
      {data && (
        <>
          <div className="grid-4 mb">
            <Metric label="Invoices" value={String(summary.invoices)} />
            <Metric label="Sales amount" value={money(summary.salesAmount)} />
            <Metric label="Discount" value={money(summary.discount)} />
            <Metric label="Cost" value={money(summary.cost)} />
            <Metric label="Gross profit" value={money(summary.grossProfit)} />
            <Metric label="Margin" value={`${(summary.margin * 100).toFixed(1)}%`} />
          </div>
          {!data.invoices.length && (
            <div className="card empty">
              No sales records found for the selected filters.
            </div>
          )}
          {!!data.invoices.length && (
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
                  {data.invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td><b>{invoice.invoice_number}</b></td>
                      <td>{invoice.invoice_date}</td>
                      <td>{invoice.customer_company}</td>
                      <td>{invoice.items.join(", ")}</td>
                      <td>{money(invoice.sales)}</td>
                      <td>{money(invoice.cost)}</td>
                      <td><b>{money(invoice.gross_profit)}</b></td>
                      <td><span className="status">{title(invoice.status)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
