"use client";
import { createContext, useContext, useEffect, useState } from "react";
import {
  PDFDocument,
  PDFImage,
  PDFPage,
  PDFFont,
  StandardFonts,
  rgb,
} from "pdf-lib";
import {
  Check,
  Copy,
  Download,
  Eye,
  FileText,
  GripVertical,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import tesvilaLogo from "../Logo original remove background.png";
import { authFetch, getClientSession } from "@/lib/client-auth";

export type DocumentItem = {
  id: string;
  productId?: string;
  model: string;
  sku: string;
  type: string;
  description: string;
  brand: string;
  quantity: number;
  unitPrice: number;
  unitCost?: number;
  discount?: number;
  remarks: string;
};
export type CustomerSnapshot = {
  customerId?: string;
  name: string;
  billingAddress: string;
  deliveryAddress: string;
  attention: string;
  phone: string;
};
export type InvoiceRecord = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  customer: CustomerSnapshot;
  doNumber: string;
  doId: string;
  poNumber: string;
  items: DocumentItem[];
  gstRate: number;
  deposit: number;
  paymentStatus: string;
  paymentMethod: string;
  itemCollectMethod: string;
  collectionMethod: string;
  installationOption: string;
  remarks: string;
  createdBy: string;
  issuedByUserId?: string;
  createdAt: string;
};
export type DORecord = {
  id: string;
  doNumber: string;
  deliveryDate: string;
  customer: CustomerSnapshot;
  invoiceNumber: string;
  invoiceId?: string;
  deliveryAddress: string;
  deliveryContact: string;
  deliveryPhone: string;
  itemCollectMethod: string;
  items: DocumentItem[];
  status: string;
  remarks: string;
  createdBy: string;
  issuedByUserId?: string;
  createdAt: string;
};

type CustomerOption = {
  id: string;
  company_name: string;
  contact_person: string | null;
  contact_number: string | null;
  billing_address: string | null;
  delivery_address: string | null;
};

type ProductOption = {
  id: string;
  sku: string;
  product_model: string;
  product_type: string;
  description: string;
  brand: string;
  selling_price: number;
  cost_price: number;
};
type Store = {
  invoices: InvoiceRecord[];
  deliveryOrders: DORecord[];
  saveInvoice: (draft: InvoiceDraft) => Promise<InvoiceRecord>;
  saveDO: (draft: DODraft) => Promise<DORecord>;
  update: (
    type: "invoice" | "delivery_order",
    record: InvoiceRecord | DORecord,
  ) => Promise<void>;
  remove: (type: "invoice" | "delivery_order", id: string) => Promise<void>;
  notify: (s: string) => void;
};
type InvoiceDraft = Omit<
  InvoiceRecord,
  "id" | "invoiceNumber" | "doNumber" | "doId" | "createdAt"
>;
type DODraft = Omit<DORecord, "id" | "doNumber" | "createdAt">;

/* Historical UI fixtures intentionally disabled. New forms and histories load only from Supabase.
const seedItems: DocumentItem[] = [
  {
    id: "i1",
    model: "Aurelia WC-8801",
    sku: "TV-WC-8801",
    type: "Water Closet",
    description:
      "Rimless one-piece water closet with tornado flush, soft-close seat and S-trap 250 mm installation set",
    brand: "Tesvila",
    quantity: 4,
    unitPrice: 488,
    remarks: "White · inspect before delivery",
  },
  {
    id: "i2",
    model: "Eurosmart 310",
    sku: "GR-FA-310",
    type: "Basin Mixer",
    description:
      "Single-lever basin mixer with water-saving aerator and flexible connection hoses",
    brand: "Grohe",
    quantity: 4,
    unitPrice: 329,
    remarks: "Chrome finish",
  },
];
const customer = {
  name: "Meridian Build Pte Ltd",
  address: "21 Woodlands Close, #06-18, Singapore 737854",
  attention: "Rachel Lim",
  phone: "+65 9123 4567",
};
const seededInvoices: InvoiceRecord[] = [
  {
    id: "inv-1387",
    invoiceNumber: "TS-1387",
    invoiceDate: "2026-07-14",
    customer,
    doNumber: "DO1407202601",
    doId: "do-1401",
    poNumber: "PO-MB-0714",
    items: seedItems,
    gstRate: 9,
    deposit: 2000,
    paymentStatus: "Partially Paid",
    paymentMethod: "PayNow / Bank transfer",
    collectionMethod: "Delivery by Tesvila",
    installationOption: "Supply only",
    remarks:
      "Pricing is confidential and intended only for the named recipient.",
    createdBy: "Sarah Tan",
    createdAt: "2026-07-14T09:38:00+08:00",
  },
  {
    id: "inv-1386",
    invoiceNumber: "TS-1386",
    invoiceDate: "2026-07-12",
    customer: { ...customer, name: "Northstar Renovation" },
    doNumber: "DO1207202602",
    doId: "do-1202",
    poNumber: "PO-99120",
    items: seedItems.slice(0, 1),
    gstRate: 9,
    deposit: 2127.92,
    paymentStatus: "Paid",
    paymentMethod: "PayNow",
    collectionMethod: "Self collection",
    installationOption: "Supply only",
    remarks: "",
    createdBy: "Daniel Koh",
    createdAt: "2026-07-12T11:16:00+08:00",
  },
];
const seededDOs: DORecord[] = [
  {
    id: "do-1401",
    doNumber: "DO1407202601",
    deliveryDate: "2026-07-14",
    customer,
    invoiceNumber: "TS-1387",
    invoiceId: "inv-1387",
    deliveryAddress: customer.address,
    deliveryContact: "Rachel Lim",
    deliveryPhone: customer.phone,
    items: seedItems,
    status: "Delivered",
    remarks: "Call site contact 30 minutes before arrival.",
    createdBy: "Sarah Tan",
    createdAt: "2026-07-14T09:38:00+08:00",
  },
  {
    id: "do-1202",
    doNumber: "DO1207202602",
    deliveryDate: "2026-07-12",
    customer: { ...customer, name: "Northstar Renovation" },
    invoiceNumber: "TS-1386",
    invoiceId: "inv-1386",
    deliveryAddress: "8 Ubi Road 2, Singapore 408538",
    deliveryContact: "Jason Ong",
    deliveryPhone: "+65 8772 1901",
    items: seedItems.slice(0, 1),
    status: "Delivered",
    remarks: "",
    createdBy: "Daniel Koh",
    createdAt: "2026-07-12T11:16:00+08:00",
  },
  {
    id: "do-standalone",
    doNumber: "DO1207202601",
    deliveryDate: "2026-07-12",
    customer: { ...customer, name: "Site Concepts Asia" },
    invoiceNumber: "—",
    deliveryAddress: "11 Tampines Industrial Ave 5, Singapore 528760",
    deliveryContact: "Kelvin Tan",
    deliveryPhone: "+65 8892 3412",
    items: seedItems,
    status: "In Transit",
    remarks: "Standalone replacement delivery.",
    createdBy: "Marcus Lee",
    createdAt: "2026-07-12T08:45:00+08:00",
  },
];
*/
const DocumentContext = createContext<Store | null>(null);

export function DocumentProvider({
  children,
  notify,
}: {
  children: React.ReactNode;
  notify?: (s: string) => void;
}) {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]),
    [deliveryOrders, setDOs] = useState<DORecord[]>([]);
  const message =
    notify ||
    ((s: string) =>
      window.dispatchEvent(new CustomEvent("tesvila-toast", { detail: s })));
  async function loadDocuments() {
    const response = await authFetch("/api/documents", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setInvoices(data.invoices || []);
    setDOs(data.deliveryOrders || []);
  }
  useEffect(() => {
    // Initial remote hydration intentionally updates this external-store state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDocuments().catch(() => {});
  }, []);
  async function request(body: unknown, method = "POST") {
    const response = await authFetch("/api/documents", {
      method,
      headers: { "content-type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        data.error || "The database did not accept this document.",
      );
    return data;
  }
  async function saveInvoice(draft: InvoiceDraft) {
    const data = await request({ type: "invoice_with_do", ...draft });
    const saved = data.invoice as InvoiceRecord;
    setInvoices((x) => [saved, ...x.filter((r) => r.id !== saved.id)]);
    setDOs((x) => [
      data.deliveryOrder,
      ...x.filter((r) => r.id !== data.deliveryOrder.id),
    ]);
    return saved;
  }
  async function saveDO(draft: DODraft) {
    const data = await request({ type: "delivery_order", ...draft });
    const saved = data.deliveryOrder as DORecord;
    setDOs((x) => [saved, ...x.filter((r) => r.id !== saved.id)]);
    return saved;
  }
  async function update(
    type: "invoice" | "delivery_order",
    record: InvoiceRecord | DORecord,
  ) {
    await request({ type, record }, "PATCH");
    await loadDocuments();
  }
  async function remove(type: "invoice" | "delivery_order", id: string) {
    await request({ type, id }, "DELETE");
    if (type === "invoice") setInvoices((x) => x.filter((r) => r.id !== id));
    else setDOs((x) => x.filter((r) => r.id !== id));
  }
  return (
    <DocumentContext.Provider
      value={{
        invoices,
        deliveryOrders,
        saveInvoice,
        saveDO,
        update,
        remove,
        notify: message,
      }}
    >
      {children}
    </DocumentContext.Provider>
  );
}
const useDocuments = () => {
  const v = useContext(DocumentContext);
  if (!v) throw new Error("DocumentProvider missing");
  return v;
};
const fmt = (n: number) =>
  new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(
    n,
  );
const date = (value: string) =>
  new Intl.DateTimeFormat("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

const itemCollectLabel = (value: string) =>
  value === "delivery"
    ? "Delivery"
    : value === "self_collect"
      ? "Self Collect"
      : "Not specified";

const paymentMethodLabel = (value: string) =>
  value === "paynow"
    ? "PayNow"
    : value === "cash"
      ? "Cash"
      : value === "terms"
        ? "Terms"
        : "Not specified";

export function DocumentWorkflow({
  mode,
  onNavigate,
}: {
  mode: "create-invoice" | "create-do" | "invoice-table" | "do-table";
  onNavigate?: (page: string) => void;
}) {
  if (mode === "create-invoice")
    return <DocumentForm invoice onNavigate={onNavigate} />;
  if (mode === "create-do") return <DocumentForm onNavigate={onNavigate} />;
  return <DocumentTable invoice={mode === "invoice-table"} />;
}

function useDocumentReferenceData() {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([
      authFetch("/api/customers", { cache: "no-store" }),
      authFetch("/api/products", { cache: "no-store" }),
    ])
      .then(async ([customerResponse, productResponse]) => {
        const customerData = await customerResponse.json();
        const productData = await productResponse.json();
        if (!customerResponse.ok) throw new Error(customerData.error || "Unable to load customers.");
        if (!productResponse.ok) throw new Error(productData.error || "Unable to load products.");
        if (active) {
          setCustomers(customerData.customers || []);
          setProducts(productData.products || []);
        }
      })
      .catch((loadError) => active && setError(loadError instanceof Error ? loadError.message : "Unable to load document data."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);
  return { customers, products, loading, error };
}

function emptyItem(): DocumentItem {
  return {
    id: crypto.randomUUID(),
    productId: "",
    model: "",
    sku: "",
    type: "",
    description: "",
    brand: "",
    quantity: 1,
    unitPrice: 0,
    unitCost: 0,
    discount: 0,
    remarks: "",
  };
}

function itemFromProduct(item: DocumentItem, product: ProductOption | undefined, typedSku: string): DocumentItem {
  if (!product) {
    return { ...item, productId: "", sku: typedSku, model: "", type: "", description: "", brand: "", unitPrice: 0, unitCost: 0 };
  }
  return {
    ...item,
    productId: product.id,
    sku: product.sku,
    model: product.product_model,
    type: product.product_type,
    description: product.description,
    brand: product.brand,
    unitPrice: Number(product.selling_price || 0),
    unitCost: Number(product.cost_price || 0),
  };
}

function DocumentForm({
  invoice = false,
  onNavigate,
}: {
  invoice?: boolean;
  onNavigate?: (p: string) => void;
}) {
  const store = useDocuments();
  const reference = useDocumentReferenceData();
  const session = getClientSession();
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [customerId, setCustomerId] = useState(""),
    [customerName, setCustomerName] = useState(""),
    [billingAddress, setBillingAddress] = useState(""),
    [deliveryAddress, setDeliveryAddress] = useState(""),
    [attention, setAttention] = useState(""),
    [phone, setPhone] = useState(""),
    [po, setPO] = useState(""),
    [remarks, setRemarks] = useState(""),
    [itemCollectMethod, setItemCollectMethod] = useState(""),
    [paymentMethod, setPaymentMethod] = useState(""),
    [deposit, setDeposit] = useState(0),
    [clientRequestId] = useState(() => crypto.randomUUID());
  const subtotal = items.reduce(
      (s, i) => s + i.quantity * i.unitPrice - (i.discount || 0),
      0,
    ),
    gst = subtotal * 0.09,
    total = subtotal + gst;
  const update = (
    id: string,
    key: keyof DocumentItem,
    value: string | number,
  ) =>
    setItems((rows) =>
      rows.map((r) => (r.id === id ? { ...r, [key]: value } : r)),
    );
  const add = () => setItems((rows) => [...rows, emptyItem()]);
  function chooseCustomer(value: string) {
    const match = reference.customers.find((entry) => entry.company_name.toLowerCase() === value.trim().toLowerCase());
    setCustomerName(value);
    if (match) {
      setCustomerId(match.id);
      setCustomerName(match.company_name);
      setAttention(match.contact_person || "");
      setPhone(match.contact_number || "");
      setBillingAddress(match.billing_address || "");
      setDeliveryAddress(match.delivery_address || "");
    } else if (customerId) {
      setCustomerId("");
      setAttention("");
      setPhone("");
      setBillingAddress("");
      setDeliveryAddress("");
    }
  }
  function chooseProduct(id: string, value: string) {
    const product = reference.products.find((entry) => entry.sku.toLowerCase() === value.trim().toLowerCase());
    setItems((rows) => rows.map((row) => row.id === id ? itemFromProduct(row, product, value) : row));
  }
  function validationError() {
    if (!customerName.trim()) return "Customer company is required.";
    if (!billingAddress.trim()) return "Billing Address is required.";
    if (!itemCollectMethod) return "Please select an item collect method.";
    if (invoice && !paymentMethod) return "Please select a payment method.";
    if (!items.length) return "Add at least one item before saving.";
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const product = reference.products.find((entry) => entry.id === item.productId && entry.sku === item.sku);
      if (!product) return `Item ${index + 1}: Please select a valid SKU.`;
      if (item.quantity <= 0) return `Item ${index + 1}: Quantity must be greater than zero.`;
      if (item.unitPrice < 0) return `Item ${index + 1}: Unit Price must be zero or greater.`;
    }
    return "";
  }
  async function submit() {
    const validation = validationError();
    setError(validation);
    if (validation) return;
    setSaving(true);
    try {
      const common = {
        clientRequestId,
        customer: { customerId: customerId || undefined, name: customerName, billingAddress, deliveryAddress, attention, phone },
        items,
        createdBy: session?.displayName || "Tesvila User",
        issuedByUserId: session?.userId,
        remarks,
        deliveryDate: new Date().toISOString().slice(0, 10),
        deliveryAddress,
        deliveryContact: attention,
        deliveryPhone: phone,
        itemCollectMethod,
        status: "Scheduled",
      };
      if (invoice) {
        const saved = await store.saveInvoice({
          ...common,
          invoiceDate: new Date().toISOString().slice(0, 10),
          poNumber: po,
          gstRate: 9,
          deposit,
          paymentStatus: "Issued",
          paymentMethod,
          collectionMethod: "Delivery by Tesvila",
          installationOption: "Supply only",
        });
        store.notify(
          `${saved.invoiceNumber} saved. PDFs are available from the Invoice Table.`,
        );
        onNavigate?.("Invoice History");
      } else {
        const saved = await store.saveDO({ ...common, invoiceNumber: "—" });
        store.notify(
          `${saved.doNumber} saved. PDF is available from the Delivery Order Table.`,
        );
        onNavigate?.("Delivery Order History");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Document could not be saved");
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <div className="page-head row between">
        <div>
          <h2>
            {invoice
              ? "Create Invoice & Delivery Order"
              : "Create Delivery Order"}
          </h2>
          <p>
            Save the document first. PDF generation is available later from the
            document table.
          </p>
        </div>
        <span className="status gray">Database-first workflow</span>
      </div>
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
            <h2>{invoice ? "TAX INVOICE + DO" : "DELIVERY ORDER"}</h2>
            <p>Number assigned atomically on save</p>
          </div>
        </div>
        <div className="document-customer-fields">
          <div className="field customer-combobox">
            <label>Customer company *</label>
            <input
              className="input"
              list="document-customers"
              placeholder="Search an existing customer or enter a company name"
              value={customerName}
              onChange={(e) => chooseCustomer(e.target.value)}
            />
            <datalist id="document-customers">
              {reference.customers.map((entry) => <option key={entry.id} value={entry.company_name} />)}
            </datalist>
            {!customerId && customerName && <small className="field-help">Using this company for this document only. It will not be added to Customers automatically.</small>}
          </div>
          <div className="grid-2 document-contact-row">
            <div className="field">
              <label>Attention person</label>
              <input
                className="input"
                value={attention}
                onChange={(e) => setAttention(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Contact number</label>
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <div className={`document-address-grid ${invoice ? "stacked" : ""}`}>
            <div className="field"><label>Billing Address *</label><textarea className="input address-input" value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} /></div>
            <div className="field"><label>Delivery Address</label><textarea className="input address-input" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} /></div>
          </div>
          {invoice && <div className="grid-2 document-meta-row">
            <div className="field"><label>PO number</label><input className="input" value={po} onChange={(e) => setPO(e.target.value)} /></div>
            <div className="field"><label>Deposit</label><input className="input" type="number" min="0" value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} /></div>
          </div>}
          <div className={`document-method-row ${invoice ? "two" : ""}`}>
            <div className="field">
              <label>Item Collect Method *</label>
              <select className="input" value={itemCollectMethod} onChange={(e) => setItemCollectMethod(e.target.value)}>
                <option value="">Select method</option>
                <option value="delivery">Delivery</option>
                <option value="self_collect">Self Collect</option>
              </select>
            </div>
            {invoice && <div className="field">
              <label>Payment Method *</label>
              <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="">Select payment method</option>
                <option value="paynow">PayNow</option>
                <option value="cash">Cash</option>
                <option value="terms">Terms</option>
              </select>
            </div>}
          </div>
          <div className="field"><label>Remarks</label><textarea className="input" value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
        </div>
        <div className="items-editor">
          <div className="edit-row header">
            <div></div>
            <div>SKU</div>
            <div>Product model</div>
            <div>Product type</div>
            <div>Description / brand</div>
            <div>Qty</div>
            <div>Unit price</div>
            <div>Discount</div>
            <div>Amount</div>
            <div>Actions</div>
          </div>
          {items.map((row) => (
            <div className="edit-row" key={row.id}>
              <div className="drag">
                <GripVertical size={14} />
              </div>
              <div>
                <input
                  className="input"
                  list={`product-options-${row.id}`}
                  placeholder={reference.loading ? "Loading products..." : "Search SKU or model"}
                  value={row.sku}
                  onChange={(e) => chooseProduct(row.id, e.target.value)}
                />
                <datalist id={`product-options-${row.id}`}>
                  {reference.products.map((product) => <option key={product.id} value={product.sku}>{product.product_model}</option>)}
                </datalist>
                {row.sku && !row.productId && <small className="invalid-help">No matching product found.</small>}
              </div>
              <div>
                <input className="input" readOnly value={row.model} />
              </div>
              <div>
                <input className="input" readOnly value={row.type} />
              </div>
              <div>
                <input
                  className="input"
                  value={row.description}
                  onChange={(e) =>
                    update(row.id, "description", e.target.value)
                  }
                />
                <input
                  className="input"
                  style={{ marginTop: 4 }}
                  value={row.brand}
                  readOnly
                />
              </div>
              <div>
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={row.quantity}
                  onChange={(e) =>
                    update(row.id, "quantity", Number(e.target.value))
                  }
                />
              </div>
              <div>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={row.unitPrice}
                  onChange={(e) =>
                    update(row.id, "unitPrice", Number(e.target.value))
                  }
                />
              </div>
              <div>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={row.discount || 0}
                  onChange={(e) =>
                    update(row.id, "discount", Number(e.target.value))
                  }
                />
              </div>
              <div>
                <b>{fmt(row.quantity * row.unitPrice - (row.discount || 0))}</b>
              </div>
              <div className="row" style={{ gap: 3 }}>
                <button
                  className="btn sm danger"
                  onClick={() =>
                    setItems((x) => x.filter((i) => i.id !== row.id))
                  }
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
        {reference.error && <div className="inline-error">{reference.error}</div>}
        {invoice && (
          <div className="totals">
            <div className="total-line">
              <span>Subtotal</span>
              <b>{fmt(subtotal)}</b>
            </div>
            <div className="total-line">
              <span>GST (9%)</span>
              <b>{fmt(gst)}</b>
            </div>
            <div className="total-line grand">
              <span>Grand total</span>
              <span>{fmt(total)}</span>
            </div>
            <div className="total-line">
              <span>Deposit</span>
              <b>{fmt(deposit)}</b>
            </div>
            <div className="total-line">
              <span>Balance</span>
              <b>{fmt(total - deposit)}</b>
            </div>
          </div>
        )}
        {error && (
          <div className="status red mt" style={{ padding: 10 }}>
            {error}
          </div>
        )}
        <div className="row between mt document-footer-actions">
          <div><div className="issued-by-field"><span>Issued By</span><b>{session?.displayName || "—"}</b></div><span className="section-sub">No PDF is generated during this save.</span></div>
          <div className="row"><button className="btn" disabled={saving} onClick={() => onNavigate?.("Dashboard")}>Cancel</button><button
            className="btn primary"
            disabled={saving || reference.loading}
            onClick={submit}
          >
            <Save size={13} />
            {saving
              ? "Saving to database…"
              : invoice
                ? "Save Invoice & DO"
                : "Save Delivery Order"}
          </button></div>
        </div>
      </div>
    </>
  );
}

function DocumentTable({ invoice = false }: { invoice?: boolean }) {
  const store = useDocuments(),
    records = invoice ? store.invoices : store.deliveryOrders;
  const [view, setView] = useState<{
      record: InvoiceRecord | DORecord;
      mode: "view" | "edit";
    } | null>(null),
    [busy, setBusy] = useState("");
  async function pdf(record: InvoiceRecord | DORecord, type: "invoice" | "do") {
    setBusy(record.id + type);
    try {
      if (type === "invoice") await generateInvoicePdf(record as InvoiceRecord);
      else {
        const d = invoice
          ? store.deliveryOrders.find(
              (x) => x.id === (record as InvoiceRecord).doId,
            )
          : (record as DORecord);
        if (!d) throw new Error("Related delivery order was not found");
        await generateDOPdf(d);
      }
      store.notify(
        `${type === "invoice" ? (record as InvoiceRecord).invoiceNumber : invoice ? (record as InvoiceRecord).doNumber : (record as DORecord).doNumber} PDF downloaded`,
      );
    } catch (e) {
      store.notify(e instanceof Error ? e.message : "PDF generation failed");
    } finally {
      setBusy("");
    }
  }
  async function duplicate(record: InvoiceRecord | DORecord) {
    setBusy(record.id + "dup");
    try {
      if (invoice) {
        const r = record as InvoiceRecord;
        await store.saveInvoice({
          ...r,
          invoiceDate: new Date().toISOString().slice(0, 10),
        });
        store.notify("Invoice and linked DO duplicated with new numbers");
      } else {
        const r = record as DORecord;
        await store.saveDO({
          ...r,
          deliveryDate: new Date().toISOString().slice(0, 10),
        });
        store.notify("Delivery order duplicated with a new number");
      }
    } catch (e) {
      store.notify(e instanceof Error ? e.message : "Duplicate failed");
    } finally {
      setBusy("");
    }
  }
  async function remove(record: InvoiceRecord | DORecord) {
    if (
      !confirm(
        `Delete ${invoice ? (record as InvoiceRecord).invoiceNumber : (record as DORecord).doNumber}? This action is audited.`,
      )
    )
      return;
    try {
      await store.remove(invoice ? "invoice" : "delivery_order", record.id);
      store.notify("Document deleted and audit logged");
    } catch (e) {
      store.notify(e instanceof Error ? e.message : "Delete failed");
    }
  }
  return (
    <>
      <div className="page-head row between">
        <div>
          <h2>{invoice ? "Invoice Table" : "Delivery Order Table"}</h2>
          <p>
            Documents are saved independently. Generate or download PDFs at any
            time.
          </p>
        </div>
        <span className="status">{records.length} saved records</span>
      </div>
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              {invoice ? (
                <>
                  <th>Invoice Number</th>
                  <th>Invoice Date</th>
                  <th>Customer</th>
                  <th>Related DO</th>
                  <th>PO Number</th>
                  <th>Grand Total</th>
                  <th>Payment Status</th>
                </>
              ) : (
                <>
                  <th>Delivery Order Number</th>
                  <th>Delivery Date</th>
                  <th>Customer</th>
                  <th>Related Invoice</th>
                  <th>Total Quantity</th>
                  <th>Delivery Status</th>
                </>
              )}
              <th>Created By</th>
              <th>Created Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((raw) => {
              const record = raw as InvoiceRecord | DORecord;
              const inv = record as InvoiceRecord,
                dor = record as DORecord;
              const subtotal = record.items.reduce(
                (s, x) => s + x.quantity * x.unitPrice - (x.discount || 0),
                0,
              );
              return (
                <tr key={record.id}>
                  {invoice ? (
                    <>
                      <td>
                        <b>{inv.invoiceNumber}</b>
                      </td>
                      <td>{date(inv.invoiceDate)}</td>
                      <td>{inv.customer.name}</td>
                      <td>{inv.doNumber}</td>
                      <td>{inv.poNumber || "—"}</td>
                      <td>
                        <b>{fmt(subtotal * (1 + inv.gstRate / 100))}</b>
                      </td>
                      <td>
                        <span
                          className={`status ${inv.paymentStatus === "Unpaid" ? "red" : inv.paymentStatus === "Partially Paid" ? "amber" : ""}`}
                        >
                          {inv.paymentStatus}
                        </span>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <b>{dor.doNumber}</b>
                      </td>
                      <td>{date(dor.deliveryDate)}</td>
                      <td>{dor.customer.name}</td>
                      <td>{dor.invoiceNumber || "—"}</td>
                      <td>
                        <b>{dor.items.reduce((s, x) => s + x.quantity, 0)}</b>
                      </td>
                      <td>
                        <span
                          className={`status ${dor.status === "In Transit" ? "amber" : ""}`}
                        >
                          {dor.status}
                        </span>
                      </td>
                    </>
                  )}
                  <td>{record.createdBy}</td>
                  <td>{date(record.createdAt)}</td>
                  <td>
                    <div className="row wrap" style={{ gap: 4 }}>
                      <button
                        className="btn sm"
                        title="View"
                        onClick={() => setView({ record, mode: "view" })}
                      >
                        <Eye size={11} /> View
                      </button>
                      <button
                        className="btn sm"
                        title="Edit"
                        onClick={() => setView({ record, mode: "edit" })}
                      >
                        <Pencil size={11} /> Edit
                      </button>
                      {invoice && (
                        <button
                          className="btn sm"
                          disabled={!!busy}
                          onClick={() => pdf(record, "invoice")}
                        >
                          <FileText size={11} /> Invoice PDF
                        </button>
                      )}
                      <button
                        className="btn sm"
                        disabled={!!busy}
                        onClick={() => pdf(record, "do")}
                      >
                        <Download size={11} /> {invoice ? "DO PDF" : "Save PDF"}
                      </button>
                      <button
                        className="btn sm"
                        disabled={!!busy}
                        onClick={() => duplicate(record)}
                      >
                        <Copy size={11} /> Duplicate
                      </button>
                      <button
                        className="btn sm danger"
                        onClick={() => remove(record)}
                      >
                        <Trash2 size={11} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {view && (
        <RecordModal
          record={view.record}
          invoice={invoice}
          mode={view.mode}
          close={() => setView(null)}
        />
      )}
    </>
  );
}

function RecordModal({
  record,
  invoice,
  mode,
  close,
}: {
  record: InvoiceRecord | DORecord;
  invoice: boolean;
  mode: "view" | "edit";
  close: () => void;
}) {
  const store = useDocuments();
  const reference = useDocumentReferenceData();
  const [draft, setDraft] = useState<InvoiceRecord | DORecord>(() => ({
      ...record,
      customer: { ...record.customer },
      items: record.items.map((item) => ({ ...item })),
    })),
    [saving, setSaving] = useState(false),
    readOnly = mode === "view";
  const inv = draft as InvoiceRecord,
    delivery = draft as DORecord;
  const setField = (field: string, value: unknown) =>
    setDraft(
      (current) => ({ ...current, [field]: value }) as InvoiceRecord | DORecord,
    );
  const setCustomer = (field: keyof CustomerSnapshot, value: string) =>
    setDraft((current) => ({
      ...current,
      customer: { ...current.customer, [field]: value },
    }));
  const chooseModalCustomer = (value: string) => {
    const match = reference.customers.find((entry) => entry.company_name.toLowerCase() === value.trim().toLowerCase());
    setDraft((current) => ({
      ...current,
      customer: match
        ? { customerId: match.id, name: match.company_name, attention: match.contact_person || "", phone: match.contact_number || "", billingAddress: match.billing_address || "", deliveryAddress: match.delivery_address || "" }
        : { ...current.customer, customerId: undefined, name: value },
      ...(!invoice && match ? { deliveryAddress: match.delivery_address || "", deliveryContact: match.contact_person || "", deliveryPhone: match.contact_number || "" } : {}),
    }) as InvoiceRecord | DORecord);
  };
  const setItem = (id: string, field: keyof DocumentItem, value: unknown) =>
    setDraft(
      (current) =>
        ({
          ...current,
          items: current.items.map((item) =>
            item.id === id ? { ...item, [field]: value } : item,
          ),
        }) as InvoiceRecord | DORecord,
    );
  const chooseModalProduct = (id: string, value: string) => {
    const product = reference.products.find((entry) => entry.sku.toLowerCase() === value.trim().toLowerCase());
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => item.id === id ? itemFromProduct(item, product, value) : item),
    }) as InvoiceRecord | DORecord);
  };
  function editValidationError() {
    if (!draft.customer.name.trim()) return "Customer company is required.";
    if (!draft.customer.billingAddress.trim()) return "Billing Address is required.";
    if (!draft.itemCollectMethod) return "Please select an item collect method.";
    if (invoice && !inv.paymentMethod) return "Please select a payment method.";
    for (let index = 0; index < draft.items.length; index++) {
      const item = draft.items[index];
      if (!reference.products.some((product) => product.id === item.productId && product.sku === item.sku)) return `Item ${index + 1}: Please select a valid SKU.`;
      if (item.quantity <= 0) return `Item ${index + 1}: Quantity must be greater than zero.`;
      if (item.unitPrice < 0) return `Item ${index + 1}: Unit Price must be zero or greater.`;
    }
    return "";
  }
  async function save() {
    const validation = editValidationError();
    if (validation) {
      store.notify(validation);
      return;
    }
    setSaving(true);
    try {
      await store.update(invoice ? "invoice" : "delivery_order", draft);
      store.notify(
        invoice
          ? "Invoice updated; totals and reports recalculated"
          : "Delivery order updated; inventory was reversed and reapplied",
      );
      close();
    } catch (e) {
      store.notify(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <div className="modal document-modal">
        <div className="modal-head">
          <div>
            <b>{invoice ? inv.invoiceNumber : delivery.doNumber}</b>
            <div className="muted">
              {readOnly
                ? "Read-only document view"
                : "Edit saved document — number preserved"}
            </div>
          </div>
          <button className="icon-btn" onClick={close}>
            <X size={15} />
          </button>
        </div>
        <div className="modal-body">
          <div className="grid-2">
            <div className="field">
              <label>Customer</label>
              <input
                className="input"
                disabled={readOnly}
                list="edit-document-customers"
                value={draft.customer.name}
                onChange={(e) => chooseModalCustomer(e.target.value)}
              />
              <datalist id="edit-document-customers">{reference.customers.map((entry) => <option key={entry.id} value={entry.company_name} />)}</datalist>
            </div>
            <div className="field">
              <label>Attention</label>
              <input
                className="input"
                disabled={readOnly}
                value={draft.customer.attention}
                onChange={(e) => setCustomer("attention", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Contact Number</label>
              <input className="input" disabled={readOnly} value={draft.customer.phone} onChange={(e) => setCustomer("phone", e.target.value)} />
            </div>
            <div className="field">
              <label>Issued By</label>
              <input className="input" disabled value={draft.createdBy} />
            </div>
            <div className="field">
              <label>Billing Address</label>
              <textarea
                className="input"
                disabled={readOnly}
                value={draft.customer.billingAddress}
                onChange={(e) => setCustomer("billingAddress", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Delivery Address</label>
              <textarea className="input" disabled={readOnly} value={draft.customer.deliveryAddress} onChange={(e) => {
                setCustomer("deliveryAddress", e.target.value);
                if (!invoice) setField("deliveryAddress", e.target.value);
              }} />
            </div>
            <div className="field">
              <label>{invoice ? "Invoice date" : "Delivery date"}</label>
              <input
                className="input"
                type="date"
                disabled={readOnly}
                value={invoice ? inv.invoiceDate : delivery.deliveryDate}
                onChange={(e) =>
                  setField(
                    invoice ? "invoiceDate" : "deliveryDate",
                    e.target.value,
                  )
                }
              />
            </div>
            <div className="field">
              <label>{invoice ? "PO number" : "Delivery status"}</label>
              {invoice ? (
                <input
                  className="input"
                  disabled={readOnly}
                  value={inv.poNumber}
                  onChange={(e) => setField("poNumber", e.target.value)}
                />
              ) : (
                <select
                  className="input"
                  disabled={readOnly}
                  value={delivery.status}
                  onChange={(e) => setField("status", e.target.value)}
                >
                  <option>Scheduled</option>
                  <option>In Transit</option>
                  <option>Delivered</option>
                  <option>Cancelled</option>
                </select>
              )}
            </div>
            <div className="field">
              <label>Item Collect Method</label>
              <select
                className="input"
                disabled={readOnly}
                value={draft.itemCollectMethod || ""}
                onChange={(e) => setField("itemCollectMethod", e.target.value)}
              >
                <option value="">Not specified</option>
                <option value="delivery">Delivery</option>
                <option value="self_collect">Self Collect</option>
              </select>
            </div>
            {invoice && (
              <>
                <div className="field">
                  <label>Payment Method</label>
                  <select
                    className="input"
                    disabled={readOnly}
                    value={inv.paymentMethod || ""}
                    onChange={(e) => setField("paymentMethod", e.target.value)}
                  >
                    <option value="">Not specified</option>
                    <option value="paynow">PayNow</option>
                    <option value="cash">Cash</option>
                    <option value="terms">Terms</option>
                  </select>
                </div>
                <div className="field">
                  <label>Deposit</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    disabled={readOnly}
                    value={inv.deposit}
                    onChange={(e) =>
                      setField("deposit", Number(e.target.value))
                    }
                  />
                </div>
                <div className="field">
                  <label>Payment status</label>
                  <select
                    className="input"
                    disabled={readOnly}
                    value={inv.paymentStatus}
                    onChange={(e) => setField("paymentStatus", e.target.value)}
                  >
                    <option>Issued</option>
                    <option>Partially Paid</option>
                    <option>Paid</option>
                    <option>Overdue</option>
                  </select>
                </div>
              </>
            )}
          </div>
          <div className="table-wrap mt">
            <table className="table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product Model</th>
                  <th>Product Type</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Price</th>
                  {invoice && <th>Discount</th>}
                  <th>Amount</th>
                  {!readOnly && <th></th>}
                </tr>
              </thead>
              <tbody>
                {draft.items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <input
                        className="input"
                        disabled={readOnly}
                        list={`edit-product-options-${i.id}`}
                        value={i.sku}
                        onChange={(e) => chooseModalProduct(i.id, e.target.value)}
                      />
                      <datalist id={`edit-product-options-${i.id}`}>{reference.products.map((product) => <option key={product.id} value={product.sku}>{product.product_model}</option>)}</datalist>
                    </td>
                    <td>
                      <input className="input" disabled value={i.model} />
                    </td>
                    <td>
                      <input className="input" disabled value={i.type} />
                    </td>
                    <td>
                      <input
                        className="input"
                        disabled={readOnly}
                        value={i.description}
                        onChange={(e) =>
                          setItem(i.id, "description", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        min="1"
                        disabled={readOnly}
                        value={i.quantity}
                        onChange={(e) =>
                          setItem(i.id, "quantity", Number(e.target.value))
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        disabled={readOnly}
                        value={i.unitPrice}
                        onChange={(e) =>
                          setItem(i.id, "unitPrice", Number(e.target.value))
                        }
                      />
                    </td>
                    {invoice && (
                      <td>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          disabled={readOnly}
                          value={i.discount || 0}
                          onChange={(e) =>
                            setItem(i.id, "discount", Number(e.target.value))
                          }
                        />
                      </td>
                    )}
                    <td>
                      <b>{fmt(i.quantity * i.unitPrice - (i.discount || 0))}</b>
                    </td>
                    {!readOnly && (
                      <td>
                        <button
                          className="btn sm danger"
                          disabled={draft.items.length === 1}
                          onClick={() =>
                            setDraft(
                              (current) =>
                                ({
                                  ...current,
                                  items: current.items.filter(
                                    (item) => item.id !== i.id,
                                  ),
                                }) as InvoiceRecord | DORecord,
                            )
                          }
                        >
                          <Trash2 size={10} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!readOnly && (
            <button
              className="btn mt"
              onClick={() =>
                setDraft(
                  (current) =>
                    ({
                      ...current,
                      items: [
                        ...current.items,
                        {
                          ...emptyItem(),
                        },
                      ],
                    }) as InvoiceRecord | DORecord,
                )
              }
            >
              <Plus size={12} /> Add item
            </button>
          )}
          {invoice &&
            (() => {
              const subtotal = inv.items.reduce(
                  (s, i) => s + i.quantity * i.unitPrice - (i.discount || 0),
                  0,
                ),
                gst = (subtotal * inv.gstRate) / 100;
              return (
                <div className="totals">
                  <div className="total-line">
                    <span>Subtotal</span>
                    <b>{fmt(subtotal)}</b>
                  </div>
                  <div className="total-line">
                    <span>GST ({inv.gstRate}%)</span>
                    <b>{fmt(gst)}</b>
                  </div>
                  <div className="total-line grand">
                    <span>Grand total</span>
                    <span>{fmt(subtotal + gst)}</span>
                  </div>
                  <div className="total-line">
                    <span>Balance</span>
                    <b>{fmt(subtotal + gst - inv.deposit)}</b>
                  </div>
                </div>
              );
            })()}
          <div
            className="row"
            style={{ justifyContent: "flex-end", marginTop: 18 }}
          >
            <button className="btn" onClick={close}>
              Close
            </button>
            {readOnly && invoice && (
              <button className="btn" onClick={() => generateInvoicePdf(inv)}>
                <FileText size={12} /> Invoice PDF
              </button>
            )}
            {readOnly && (
              <button
                className="btn"
                onClick={async () => {
                  const d = invoice
                    ? store.deliveryOrders.find((x) => x.id === inv.doId)
                    : delivery;
                  if (!d) {
                    store.notify("Related delivery order was not found");
                    return;
                  }
                  await generateDOPdf(d);
                }}
              >
                <Download size={12} /> DO PDF
              </button>
            )}
            {!readOnly && (
              <button
                className="btn primary"
                disabled={saving || reference.loading || !draft.items.length}
                onClick={save}
              >
                <Check size={12} /> {saving ? "Saving…" : "Save changes"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const GREEN = rgb(0.055, 0.22, 0.145),
  INK = rgb(0.12, 0.14, 0.13),
  MUTED = rgb(0.38, 0.42, 0.4),
  LINE = rgb(0.82, 0.84, 0.83);
type PdfKit = {
  doc: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  logo: PDFImage;
  pages: PDFPage[];
};
const textWidth = (font: PDFFont, size: number, s: string) =>
  font.widthOfTextAtSize(s, size);
function wrap(font: PDFFont, size: number, text: string, max: number) {
  const words = (text || "—").split(/\s+/),
    lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(font, size, next) <= max) line = next;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ["—"];
}
function drawLines(
  page: PDFPage,
  font: PDFFont,
  size: number,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  color = INK,
) {
  lines.forEach((line, i) =>
    page.drawText(line, { x, y: y - i * lineHeight, size, font, color }),
  );
}
function line(page: PDFPage, y: number, x1 = 36, x2 = 559) {
  page.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    thickness: 0.55,
    color: LINE,
  });
}
function addPageNumber(kit: PdfKit) {
  kit.pages.forEach((p, i) =>
    p.drawText(`Page ${i + 1} of ${kit.pages.length}`, {
      x: 500,
      y: 19,
      size: 7,
      font: kit.regular,
      color: MUTED,
    }),
  );
}
async function savePdf(kit: PdfKit, name: string) {
  addPageNumber(kit);
  const bytes = await kit.doc.save();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: "application/pdf" }),
  );
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function createPdfKit(): Promise<PdfKit> {
  const doc = await PDFDocument.create(),
    regular = await doc.embedFont(StandardFonts.Helvetica),
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const response = await fetch(tesvilaLogo.src);
  if (!response.ok) throw new Error("Tesvila logo could not be loaded");
  const logo = await doc.embedPng(await response.arrayBuffer());
  return { doc, regular, bold, logo, pages: [] };
}
function companyHeader(
  kit: PdfKit,
  page: PDFPage,
  title: string,
  no: string,
  continuation = false,
) {
  page.drawRectangle({ x: 0, y: 790, width: 595, height: 52, color: GREEN });
  page.drawRectangle({
    x: 30,
    y: 796,
    width: 44,
    height: 40,
    color: rgb(1, 1, 1),
  });
  const logoSize = kit.logo.scaleToFit(42, 38);
  page.drawImage(kit.logo, {
    x: 31 + (42 - logoSize.width) / 2,
    y: 797 + (38 - logoSize.height) / 2,
    width: logoSize.width,
    height: logoSize.height,
  });
  page.drawText("TESVILA PTE LTD", {
    x: 82,
    y: 817,
    size: 14,
    font: kit.bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(
    "4001 Ang Mo Kio Industrial Park 1, Ang Mo Kio Ave 10, 01-09, 569622  |  +65 8189 5198",
    { x: 82, y: 804, size: 7, font: kit.regular, color: rgb(0.9, 0.95, 0.92) },
  );
  page.drawText(
    "sales@tesvila.com.sg  |  www.tesvila.com.sg  |  UEN 201604567R",
    { x: 82, y: 795, size: 7, font: kit.regular, color: rgb(0.9, 0.95, 0.92) },
  );
  page.drawText(continuation ? `${title} — CONTINUED` : title, {
    x: 36,
    y: 762,
    size: 18,
    font: kit.bold,
    color: GREEN,
  });
  page.drawText(no, { x: 455, y: 764, size: 10, font: kit.bold, color: GREEN });
}
function invoiceTableHead(kit: PdfKit, page: PDFPage, y: number) {
  page.drawRectangle({
    x: 36,
    y: y - 18,
    width: 523,
    height: 20,
    color: GREEN,
  });
  [
    ["SKU", 42],
    ["PRODUCT MODEL", 105],
    ["TYPE / DESCRIPTION", 205],
    ["QTY", 397],
    ["UNIT PRICE", 430],
    ["AMOUNT", 505],
  ].forEach(([t, x]) =>
    page.drawText(String(t), {
      x: Number(x),
      y: y - 12,
      size: 6.5,
      font: kit.bold,
      color: rgb(1, 1, 1),
    }),
  );
  return y - 25;
}
function doTableHead(kit: PdfKit, page: PDFPage, y: number) {
  page.drawRectangle({
    x: 36,
    y: y - 18,
    width: 523,
    height: 20,
    color: GREEN,
  });
  [
    ["SKU", 42],
    ["PRODUCT MODEL", 105],
    ["TYPE / DESCRIPTION / BRAND", 190],
    ["QTY", 438],
    ["REMARKS", 475],
  ].forEach(([t, x]) =>
    page.drawText(String(t), {
      x: Number(x),
      y: y - 12,
      size: 6.5,
      font: kit.bold,
      color: rgb(1, 1, 1),
    }),
  );
  return y - 25;
}

export async function generateInvoicePdf(inv: InvoiceRecord) {
  const kit = await createPdfKit(),
    { doc, regular, bold } = kit;
  let page = doc.addPage([595, 842]);
  kit.pages.push(page);
  companyHeader(kit, page, "TAX INVOICE", inv.invoiceNumber);
  page.drawText("BILLING ADDRESS", {
    x: 36,
    y: 730,
    size: 7,
    font: bold,
    color: MUTED,
  });
  const customerNameLines = wrap(bold, 10, inv.customer.name, 260);
  drawLines(page, bold, 10, customerNameLines, 36, 715, 12);
  let customerY = 715 - customerNameLines.length * 12 - 5;
  const billingLines = wrap(regular, 8, inv.customer.billingAddress, 260);
  drawLines(page, regular, 8, billingLines, 36, customerY, 10);
  customerY -= billingLines.length * 10 + 13;
  page.drawText("DELIVERY ADDRESS", { x: 36, y: customerY, size: 7, font: bold, color: MUTED });
  customerY -= 14;
  const deliveryLines = wrap(regular, 8, inv.customer.deliveryAddress, 260);
  drawLines(page, regular, 8, deliveryLines, 36, customerY, 10);
  customerY -= deliveryLines.length * 10 + 12;
  page.drawText(`Attn: ${inv.customer.attention || "—"}  |  Tel: ${inv.customer.phone || "—"}`, { x: 36, y: customerY, size: 8, font: regular, color: MUTED });
  customerY -= 18;
  [
    ["Invoice No.", inv.invoiceNumber],
    ["PO No.", inv.poNumber || "—"],
    ["DO No.", inv.doNumber],
    ["Date", date(inv.invoiceDate)],
  ].forEach(([a, b], i) => {
    page.drawText(a, {
      x: 370,
      y: 720 - i * 18,
      size: 7,
      font: bold,
      color: MUTED,
    });
    page.drawText(b, {
      x: 445,
      y: 720 - i * 18,
      size: 8,
      font: i ? regular : bold,
      color: INK,
    });
  });
  let y = invoiceTableHead(kit, page, Math.min(610, customerY));
  const footerReserve = 250;
  for (let index = 0; index < inv.items.length; index++) {
    const item = inv.items[index];
    const desc = wrap(
      regular,
      7.5,
      `${item.type} — ${item.description} · ${item.brand}${item.remarks ? ` · ${item.remarks}` : ""}`,
      180,
    );
    const h = Math.max(
      25,
      Math.max(
        desc.length,
        wrap(regular, 7.2, item.sku, 54).length,
        wrap(bold, 7.2, item.model, 88).length,
      ) * 9 + 10,
    );
    if (y - h < footerReserve) {
      page = doc.addPage([595, 842]);
      kit.pages.push(page);
      companyHeader(kit, page, "TAX INVOICE", inv.invoiceNumber, true);
      y = invoiceTableHead(kit, page, 735);
    }
    drawLines(page, regular, 7.2, wrap(regular, 7.2, item.sku, 54), 42, y - 9, 9);
    drawLines(page, bold, 7.2, wrap(bold, 7.2, item.model, 88), 105, y - 9, 9);
    drawLines(page, regular, 7.2, desc, 205, y - 9, 9);
    page.drawText(String(item.quantity), {
      x: 397,
      y: y - 10,
      size: 8,
      font: regular,
    });
    page.drawText(fmt(item.unitPrice), {
      x: 430,
      y: y - 10,
      size: 7.5,
      font: regular,
    });
    page.drawText(fmt(item.quantity * item.unitPrice - (item.discount || 0)), {
      x: 503,
      y: y - 10,
      size: 7.5,
      font: bold,
    });
    y -= h;
    line(page, y);
  }
  const footerHeight = 225;
  if (y - footerHeight < 32) {
    page = doc.addPage([595, 842]);
    kit.pages.push(page);
    companyHeader(kit, page, "TAX INVOICE", inv.invoiceNumber, true);
    y = 730;
  }
  const subtotal = inv.items.reduce(
      (s, i) => s + i.quantity * i.unitPrice - (i.discount || 0),
      0,
    ),
    gst = (subtotal * inv.gstRate) / 100,
    grand = subtotal + gst,
    balance = grand - inv.deposit;
  page.drawText("CONFIDENTIAL PRICING NOTICE", {
    x: 36,
    y: y - 16,
    size: 7,
    font: bold,
    color: GREEN,
  });
  drawLines(
    page,
    regular,
    7,
    wrap(
      regular,
      7,
      inv.remarks ||
        "Pricing is confidential and intended only for the named recipient.",
      300,
    ),
    36,
    y - 29,
    9,
    MUTED,
  );
  [
    ["Item Collect Method", itemCollectLabel(inv.itemCollectMethod)],
    ["Payment Method", paymentMethodLabel(inv.paymentMethod)],
    ["Installation", inv.installationOption],
  ].forEach(([a, b], i) => {
    page.drawText(a, {
      x: 36,
      y: y - 54 - i * 15,
      size: 7,
      font: bold,
      color: MUTED,
    });
    page.drawText(b, { x: 135, y: y - 54 - i * 15, size: 7.5, font: regular });
  });
  [
    ["Subtotal", subtotal],
    [`GST (${inv.gstRate}%)`, gst],
    ["Grand Total", grand],
    ["Deposit", inv.deposit],
    ["Balance", balance],
  ].forEach(([a, b], i) => {
    const yy = y - 18 - i * 19;
    page.drawText(String(a), {
      x: 390,
      y: yy,
      size: i === 4 ? 9 : 8,
      font: i >= 2 ? bold : regular,
      color: i === 4 ? GREEN : INK,
    });
    page.drawText(fmt(Number(b)), {
      x: 488,
      y: yy,
      size: i === 4 ? 9 : 8,
      font: i >= 2 ? bold : regular,
      color: i === 4 ? GREEN : INK,
    });
  });
  page.drawRectangle({
    x: 36,
    y: y - 200,
    width: 75,
    height: 75,
    borderColor: LINE,
    borderWidth: 1,
  });
  page.drawText("PAYNOW QR", {
    x: 50,
    y: y - 164,
    size: 8,
    font: bold,
    color: GREEN,
  });
  page.drawText("Upload QR in Settings", {
    x: 42,
    y: y - 181,
    size: 5.5,
    font: regular,
    color: MUTED,
  });
  page.drawText("TERMS & CONDITIONS", {
    x: 130,
    y: y - 126,
    size: 7,
    font: bold,
    color: GREEN,
  });
  drawLines(
    page,
    regular,
    6.5,
    wrap(
      regular,
      6.5,
      "Payment is due according to agreed credit terms. Goods sold are not returnable without written approval. Title remains with Tesvila Pte Ltd until full payment is received.",
      380,
    ),
    130,
    y - 140,
    8,
    MUTED,
  );
  page.drawText(`Issued by: ${inv.createdBy}`, {
    x: 130,
    y: y - 192,
    size: 7,
    font: bold,
    color: INK,
  });
  await savePdf(kit, `${inv.invoiceNumber}-Invoice.pdf`);
}

export async function generateDOPdf(order: DORecord) {
  const kit = await createPdfKit(),
    { doc, regular, bold } = kit;
  let page = doc.addPage([595, 842]);
  kit.pages.push(page);
  companyHeader(kit, page, "DELIVERY ORDER", order.doNumber);
  page.drawText("BILLING ADDRESS", {
    x: 36,
    y: 730,
    size: 7,
    font: bold,
    color: MUTED,
  });
  const doCustomerLines = wrap(bold, 10, order.customer.name, 245);
  drawLines(page, bold, 10, doCustomerLines, 36, 715, 12);
  let doCustomerY = 715 - doCustomerLines.length * 12 - 5;
  const doBillingLines = wrap(regular, 8, order.customer.billingAddress, 245);
  drawLines(page, regular, 8, doBillingLines, 36, doCustomerY, 10);
  doCustomerY -= doBillingLines.length * 10 + 12;
  page.drawText(`Attn: ${order.customer.attention || "—"}  |  ${order.customer.phone || "—"}`, { x: 36, y: doCustomerY, size: 8, font: regular, color: MUTED });
  [
    ["Invoice No.", order.invoiceNumber || "—"],
    ["DO No.", order.doNumber],
    ["Delivery Date", date(order.deliveryDate)],
  ].forEach(([a, b], i) => {
    page.drawText(a, {
      x: 370,
      y: 720 - i * 18,
      size: 7,
      font: bold,
      color: MUTED,
    });
    page.drawText(b, {
      x: 450,
      y: 720 - i * 18,
      size: 8,
      font: i === 1 ? bold : regular,
    });
  });
  let doDetailY = Math.min(638, doCustomerY - 22);
  page.drawText("DELIVERY ADDRESS", {
    x: 36,
    y: doDetailY,
    size: 7,
    font: bold,
    color: MUTED,
  });
  doDetailY -= 15;
  const doDeliveryLines = wrap(regular, 8, order.customer.deliveryAddress || order.deliveryAddress, 500);
  drawLines(page, regular, 8, doDeliveryLines, 36, doDetailY, 10);
  doDetailY -= doDeliveryLines.length * 10 + 12;
  page.drawText(`Contact: ${order.deliveryContact || "—"}  |  ${order.deliveryPhone || "—"}`, { x: 36, y: doDetailY, size: 8, font: regular, color: MUTED });
  let y = doTableHead(kit, page, doDetailY - 22);
  const reserve = 245;
  for (const item of order.items) {
    const details = wrap(
        regular,
        7.5,
        `${item.type} — ${item.description} · Brand: ${item.brand}`,
        235,
      ),
      remarks = wrap(regular, 7, item.remarks || "—", 80);
    const h = Math.max(
      27,
      Math.max(
        details.length,
        remarks.length,
        wrap(regular, 7.2, item.sku, 54).length,
        wrap(bold, 7.2, item.model, 75).length,
      ) * 9 + 10,
    );
    if (y - h < reserve) {
      page = doc.addPage([595, 842]);
      kit.pages.push(page);
      companyHeader(kit, page, "DELIVERY ORDER", order.doNumber, true);
      y = doTableHead(kit, page, 735);
    }
    drawLines(page, regular, 7.2, wrap(regular, 7.2, item.sku, 54), 42, y - 10, 9);
    drawLines(page, bold, 7.2, wrap(bold, 7.2, item.model, 75), 105, y - 10, 9);
    drawLines(page, regular, 7.2, details, 190, y - 10, 9);
    page.drawText(String(item.quantity), {
      x: 445,
      y: y - 10,
      size: 8,
      font: bold,
    });
    drawLines(page, regular, 7, remarks, 475, y - 10, 9);
    y -= h;
    line(page, y);
  }
  const footerHeight = 225;
  if (y - footerHeight < 30) {
    page = doc.addPage([595, 842]);
    kit.pages.push(page);
    companyHeader(kit, page, "DELIVERY ORDER", order.doNumber, true);
    y = 730;
  }
  page.drawText("REMARKS", {
    x: 36,
    y: y - 15,
    size: 7,
    font: bold,
    color: GREEN,
  });
  page.drawText("ITEM COLLECT METHOD", {
    x: 360,
    y: y - 15,
    size: 7,
    font: bold,
    color: GREEN,
  });
  page.drawText(itemCollectLabel(order.itemCollectMethod), {
    x: 465,
    y: y - 15,
    size: 7,
    font: regular,
    color: INK,
  });
  drawLines(
    page,
    regular,
    7,
    wrap(
      regular,
      7,
      order.remarks || "Please inspect all items upon delivery.",
      510,
    ),
    36,
    y - 29,
    9,
    MUTED,
  );
  page.drawText("DELIVERY ORDER TERMS & CONDITIONS", {
    x: 36,
    y: y - 57,
    size: 7,
    font: bold,
    color: GREEN,
  });
  drawLines(
    page,
    regular,
    6.5,
    wrap(
      regular,
      6.5,
      "Goods must be inspected on delivery. Any discrepancy or damage must be reported within 24 hours. Signature confirms receipt in good order and condition.",
      510,
    ),
    36,
    y - 71,
    8,
    MUTED,
  );
  const sy = y - 128;
  page.drawLine({
    start: { x: 36, y: sy },
    end: { x: 190, y: sy },
    thickness: 0.7,
    color: INK,
  });
  page.drawText("Driver / Delivery Personnel", {
    x: 36,
    y: sy - 13,
    size: 7,
    font: bold,
  });
  page.drawLine({
    start: { x: 220, y: sy },
    end: { x: 390, y: sy },
    thickness: 0.7,
    color: INK,
  });
  page.drawText("Customer Signature", {
    x: 220,
    y: sy - 13,
    size: 7,
    font: bold,
  });
  page.drawRectangle({
    x: 420,
    y: sy - 52,
    width: 135,
    height: 57,
    borderColor: LINE,
    borderWidth: 1,
  });
  page.drawText("CUSTOMER STAMP", {
    x: 448,
    y: sy - 27,
    size: 7,
    font: bold,
    color: MUTED,
  });
  page.drawText("Received Date: ____________________", {
    x: 220,
    y: sy - 47,
    size: 7,
    font: regular,
  });
  page.drawText(`Issued by: ${order.createdBy}`, {
    x: 36,
    y: sy - 47,
    size: 7,
    font: bold,
    color: INK,
  });
  await savePdf(kit, `${order.doNumber}-Delivery-Order.pdf`);
}
