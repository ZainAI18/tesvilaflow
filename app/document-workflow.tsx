"use client";
import { createContext, useContext, useEffect, useState } from "react";
import Image from "next/image";
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
import payNowQr from "../PayNow_QR.png";
import { authFetch, getClientSession } from "@/lib/client-auth";
import {
  buildInvoiceReportData,
  invoiceReportMoney,
  paginateInvoiceReportItems,
} from "@/lib/invoice-report";
import { createInvoicePdf } from "@/lib/invoice-pdf";

export type DocumentItem = {
  id: string;
  invoiceItemId?: string;
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
  invoiceQuantity?: number;
  previouslyDeliveredQuantity?: number;
  remainingQuantity?: number;
  itemSource?: "invoice" | "extra";
  relatedDeliveryOrderNumbers?: string[];
};
export type RelatedDeliveryOrder = {
  id: string;
  doNumber: string;
  deliveryDate: string;
  deliveredQuantity: number;
  status: string;
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
  relatedDeliveryOrders: RelatedDeliveryOrder[];
  deliveryStatus: "Not Delivered" | "Partially Delivered" | "Fully Delivered";
  poNumber: string;
  items: DocumentItem[];
  gstRate: number;
  subtotal?: number;
  gstAmount?: number;
  grandTotal?: number;
  deposit: number;
  balance?: number;
  paymentStatus: string;
  paymentMethod: string;
  itemCollectMethod: string;
  collectionMethod: string;
  installationOption: string;
  remarks: string;
  titleOfInvoice: string;
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
  parent_product_id: string | null;
};
type Store = {
  invoices: InvoiceRecord[];
  deliveryOrders: DORecord[];
  documentsLoading: boolean;
  saveInvoice: (draft: InvoiceDraft) => Promise<InvoiceRecord>;
  saveInvoiceOnly: (draft: InvoiceDraft) => Promise<InvoiceRecord>;
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
  | "id"
  | "invoiceNumber"
  | "doNumber"
  | "doId"
  | "relatedDeliveryOrders"
  | "deliveryStatus"
  | "subtotal"
  | "gstAmount"
  | "grandTotal"
  | "balance"
  | "createdAt"
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
    [deliveryOrders, setDOs] = useState<DORecord[]>([]),
    [documentsLoading, setDocumentsLoading] = useState(true);
  const message =
    notify ||
    ((s: string) =>
      window.dispatchEvent(new CustomEvent("tesvila-toast", { detail: s })));
  async function loadDocuments() {
    setDocumentsLoading(true);
    try {
      const response = await authFetch("/api/documents", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setInvoices(data.invoices || []);
      setDOs(data.deliveryOrders || []);
    } finally {
      setDocumentsLoading(false);
    }
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
    await loadDocuments();
    return saved;
  }
  async function saveInvoiceOnly(draft: InvoiceDraft) {
    const data = await request({ type: "invoice_only", ...draft });
    const saved = data.invoice as InvoiceRecord;
    await loadDocuments();
    return saved;
  }
  async function saveDO(draft: DODraft) {
    const data = await request({ type: "delivery_order", ...draft });
    const saved = data.deliveryOrder as DORecord;
    await loadDocuments();
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
    await loadDocuments();
  }
  return (
    <DocumentContext.Provider
      value={{
        invoices,
        deliveryOrders,
        documentsLoading,
        saveInvoice,
        saveInvoiceOnly,
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

const invoiceOptionLabel = (record: InvoiceRecord) =>
  `${record.invoiceNumber} — ${record.customer.name} — ${record.deliveryStatus}`;

const invoiceItemsForDeliveryOrder = (
  record: InvoiceRecord,
  currentOrder?: DORecord,
) =>
  (currentOrder?.items || []).map((currentItem) => {
      if (!currentItem.invoiceItemId) {
        return {
          ...currentItem,
          itemSource: "extra" as const,
          invoiceQuantity: 0,
          previouslyDeliveredQuantity: 0,
          remainingQuantity: undefined,
        };
      }
      const item = record.items.find((entry) => entry.id === currentItem.invoiceItemId);
      if (!item) return { ...currentItem, itemSource: "invoice" as const };
      const deliveredIncludingCurrent = item.previouslyDeliveredQuantity || 0;
      const currentCountedQuantity = currentOrder?.status === "Cancelled"
        ? 0
        : (currentOrder?.items || [])
          .filter((entry) => entry.invoiceItemId === item.id)
          .reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
      const previouslyDeliveredQuantity = Math.max(
        0,
        deliveredIncludingCurrent - currentCountedQuantity,
      );
      const remainingQuantity = Math.max(
        0,
        item.quantity - previouslyDeliveredQuantity,
      );
      return {
        ...currentItem,
        invoiceItemId: item.id,
        itemSource: "invoice" as const,
        invoiceQuantity: item.quantity,
        previouslyDeliveredQuantity,
        remainingQuantity,
        quantity: currentItem.quantity,
        discount: 0,
      };
    });

const previouslyDeliveredItems = (
  record: InvoiceRecord,
  currentOrder?: DORecord,
) => record.items.map((item) => {
  const currentCountedQuantity = currentOrder?.status === "Cancelled"
    ? 0
    : (currentOrder?.items || [])
      .filter((entry) => entry.invoiceItemId === item.id)
      .reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
  const previouslyDeliveredQuantity = Math.max(
    0,
    (item.previouslyDeliveredQuantity || 0) - currentCountedQuantity,
  );
  return {
    ...item,
    itemSource: "invoice" as const,
    invoiceQuantity: item.quantity,
    previouslyDeliveredQuantity,
    remainingQuantity: Math.max(0, item.quantity - previouslyDeliveredQuantity),
    relatedDeliveryOrderNumbers: (item.relatedDeliveryOrderNumbers || []).filter(
      (number) => number !== currentOrder?.doNumber,
    ),
  };
}).filter((item) => (item.previouslyDeliveredQuantity || 0) > 0);

function PreviouslyDeliveredItems({ items }: { items: DocumentItem[] }) {
  return (
    <section className="previously-delivered-section">
      <div className="row between">
        <h3>Previously Delivered Items</h3>
        <span className="status gray">Read-only history</span>
      </div>
      {!items.length ? (
        <div className="previously-delivered-empty">No previously delivered items.</div>
      ) : (
        <div className="table-wrap">
          <table className="table previously-delivered-table">
            <thead><tr><th>SKU</th><th>Product Type</th><th>Description / Brand</th><th>Invoice Qty</th><th>Previously Delivered</th><th>Remaining</th><th>Related DO</th></tr></thead>
            <tbody>{items.map((item) => (
              <tr key={item.id}>
                <td><b>{item.sku}</b><small>{item.model}</small></td>
                <td>{item.type}</td>
                <td>{item.description}<small>{item.brand}</small></td>
                <td>{item.invoiceQuantity || 0}</td>
                <td>{item.previouslyDeliveredQuantity || 0}</td>
                <td><b>{item.remainingQuantity || 0}</b></td>
                <td>{item.relatedDeliveryOrderNumbers?.join(", ") || "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const emptyCustomerSnapshot = (): CustomerSnapshot => ({
  customerId: undefined,
  name: "",
  billingAddress: "",
  deliveryAddress: "",
  attention: "",
  phone: "",
});

function InvoiceSelector({
  id,
  invoices,
  value,
  selectedId,
  loading,
  disabled = false,
  onChange,
  onClear,
  onBlur,
}: {
  id: string;
  invoices: InvoiceRecord[];
  value: string;
  selectedId?: string;
  loading: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  onClear: () => void;
  onBlur?: () => void;
}) {
  const listId = `${id}-options`;
  return (
    <div className="field selected-invoice-field">
      <label>Selected Invoice</label>
      <div className="selected-invoice-control">
        <input
          id={id}
          className="input"
          list={disabled ? undefined : listId}
          disabled={disabled}
          placeholder={loading ? "Loading invoices..." : "Select invoice, if applicable"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          autoComplete="off"
        />
        {!disabled && (selectedId || value) && (
          <button type="button" className="selected-invoice-clear" onClick={onClear} aria-label="Clear selected invoice">
            <X size={13} />
          </button>
        )}
      </div>
      <datalist id={listId}>
        {invoices.map((entry) => (
          <option key={entry.id} value={invoiceOptionLabel(entry)} />
        ))}
      </datalist>
      {!loading && !invoices.length && <small className="field-help">No saved invoices found.</small>}
      {!loading && invoices.length > 0 && !disabled && <small className="field-help">Search by invoice number or customer company. Optional.</small>}
    </div>
  );
}

const itemCollectLabel = (value: string) =>
  value === "delivery"
    ? "Delivery"
    : value === "self_collect"
      ? "Self Collect"
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
    return { ...item, productId: "", sku: typedSku, model: "", type: "", description: "", brand: "", unitPrice: 0, unitCost: 0, invoiceItemId: undefined, itemSource: undefined, invoiceQuantity: undefined, previouslyDeliveredQuantity: undefined, remainingQuantity: undefined };
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

function selectDeliveryProduct(
  row: DocumentItem,
  product: ProductOption | undefined,
  typedSku: string,
  linkedInvoice: InvoiceRecord | undefined,
  currentItems: DocumentItem[],
  allProducts: ProductOption[],
  currentOrder?: DORecord,
) {
  const base = itemFromProduct(row, product, typedSku);
  if (!product) return { item: base };
  if (allProducts.some((candidate) => candidate.parent_product_id === product.id)) {
    return { item: row, error: `Please select a Child SKU for Parent SKU ${product.sku}.` };
  }
  const otherItems = currentItems.filter((item) => item.id !== row.id);
  const invoiceMatches = (linkedInvoice?.items || []).filter(
    (item) => item.productId === product.id || item.sku === product.sku || product.parent_product_id === item.productId,
  );
  const availableInvoiceItem = invoiceMatches.find((item) => {
    const currentSavedQuantity = currentOrder?.status === "Cancelled"
      ? 0
      : currentOrder?.items
        .filter((current) => current.invoiceItemId === item.id)
        .reduce((sum, current) => sum + Number(current.quantity || 0), 0) || 0;
    const previouslyDeliveredQuantity = Math.max(
      0,
      (item.previouslyDeliveredQuantity || 0) - currentSavedQuantity,
    );
    const allocatedQuantity = otherItems
      .filter((current) => current.invoiceItemId === item.id)
      .reduce((sum, current) => sum + Number(current.quantity || 0), 0);
    return allocatedQuantity < Math.max(0, item.quantity - previouslyDeliveredQuantity);
  });
  if (availableInvoiceItem) {
    const currentCountedQuantity = currentOrder?.status === "Cancelled"
      ? 0
      : currentOrder?.items
        .filter((item) => item.invoiceItemId === availableInvoiceItem.id)
        .reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0;
    const previouslyDeliveredQuantity = Math.max(
      0,
      (availableInvoiceItem.previouslyDeliveredQuantity || 0) - currentCountedQuantity,
    );
    return {
      item: {
        ...base,
        invoiceItemId: availableInvoiceItem.id,
        itemSource: "invoice" as const,
        invoiceQuantity: availableInvoiceItem.quantity,
        previouslyDeliveredQuantity,
        remainingQuantity: Math.max(0, availableInvoiceItem.quantity - previouslyDeliveredQuantity),
        quantity: 0,
      },
    };
  }
  if (otherItems.some((item) => item.itemSource === "extra" && item.productId === product.id)) {
    return { item: row, error: "This Extra Item has already been added to the current Delivery Order." };
  }
  return {
    item: {
      ...base,
      invoiceItemId: undefined,
      itemSource: linkedInvoice ? "extra" as const : undefined,
      invoiceQuantity: linkedInvoice ? 0 : undefined,
      previouslyDeliveredQuantity: linkedInvoice ? 0 : undefined,
      remainingQuantity: undefined,
      quantity: 0,
    },
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
  const [saving, setSaving] = useState<"" | "invoice-do" | "invoice-only">("");
  const [error, setError] = useState("");
  const [customerId, setCustomerId] = useState(""),
    [customerName, setCustomerName] = useState(""),
    [billingAddress, setBillingAddress] = useState(""),
    [deliveryAddress, setDeliveryAddress] = useState(""),
    [deliveryContact, setDeliveryContact] = useState(""),
    [deliveryPhone, setDeliveryPhone] = useState(""),
    [attention, setAttention] = useState(""),
    [phone, setPhone] = useState(""),
    [po, setPO] = useState(""),
    [remarks, setRemarks] = useState(""),
    [titleOfInvoice, setTitleOfInvoice] = useState("Supply Sanitary Ware"),
    [itemCollectMethod, setItemCollectMethod] = useState(""),
    [paymentMethod, setPaymentMethod] = useState(""),
    [selectedInvoiceId, setSelectedInvoiceId] = useState(""),
    [selectedInvoiceNumber, setSelectedInvoiceNumber] = useState(""),
    [selectedInvoiceQuery, setSelectedInvoiceQuery] = useState(""),
    [deposit, setDeposit] = useState(0),
    [clientRequestId] = useState(() => crypto.randomUUID());
  const subtotal = items.reduce(
      (s, i) => s + i.quantity * i.unitPrice - (i.discount || 0),
      0,
    ),
    gst = subtotal * 0.09,
    total = subtotal + gst;
  const selectedInvoice = !invoice && selectedInvoiceId
    ? store.invoices.find((entry) => entry.id === selectedInvoiceId)
    : undefined;
  const historicalItems = selectedInvoice
    ? previouslyDeliveredItems(selectedInvoice)
    : [];
  const update = (
    id: string,
    key: keyof DocumentItem,
    value: string | number,
  ) =>
    setItems((rows) =>
      rows.map((r) => (r.id === id ? { ...r, [key]: value } : r)),
    );
  const add = () => {
    if (!invoice && items.some((item) => !item.productId)) {
      setError("Complete the current item before adding another item.");
      return;
    }
    setError("");
    setItems((rows) => [...rows, emptyItem()]);
  };
  function applySelectedInvoice(selected: InvoiceRecord) {
    setSelectedInvoiceId(selected.id);
    setSelectedInvoiceNumber(selected.invoiceNumber);
    setSelectedInvoiceQuery(invoiceOptionLabel(selected));
    setCustomerId(selected.customer.customerId || "");
    setCustomerName(selected.customer.name);
    setAttention(selected.customer.attention);
    setPhone(selected.customer.phone);
    setBillingAddress(selected.customer.billingAddress);
    setDeliveryAddress(selected.customer.deliveryAddress);
    setDeliveryContact("");
    setDeliveryPhone("");
    setItemCollectMethod(selected.itemCollectMethod || "");
    setItems([]);
  }
  function clearDeliveryOrderDetails() {
    setCustomerId("");
    setCustomerName("");
    setAttention("");
    setPhone("");
    setBillingAddress("");
    setDeliveryAddress("");
    setDeliveryContact("");
    setDeliveryPhone("");
    setItemCollectMethod("");
    setItems([]);
  }
  function clearSelectedInvoice() {
    if (!selectedInvoiceId) {
      setSelectedInvoiceQuery("");
      return;
    }
    const keepDetails = window.confirm(
      "The Invoice link will be removed. Select OK to keep the current customer and item details, or Cancel to clear them.",
    );
    setSelectedInvoiceId("");
    setSelectedInvoiceNumber("");
    setSelectedInvoiceQuery("");
    if (!keepDetails) clearDeliveryOrderDetails();
  }
  function chooseInvoice(value: string) {
    setSelectedInvoiceQuery(value);
    if (!value.trim()) {
      clearSelectedInvoice();
      return;
    }
    const normalized = value.trim().toLowerCase();
    const selected = store.invoices.find(
      (entry) =>
        entry.invoiceNumber.toLowerCase() === normalized ||
        invoiceOptionLabel(entry).toLowerCase() === normalized,
    );
    if (!selected) return;
    if (selected.id === selectedInvoiceId) {
      setSelectedInvoiceQuery(invoiceOptionLabel(selected));
      return;
    }
    if (
      (selectedInvoiceId || customerName.trim() || items.length > 0) &&
      !window.confirm(
        "Changing the selected Invoice will replace the current customer and item details. Continue?",
      )
    ) {
      const current = store.invoices.find((entry) => entry.id === selectedInvoiceId);
      setSelectedInvoiceQuery(current ? invoiceOptionLabel(current) : "");
      return;
    }
    applySelectedInvoice(selected);
  }
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
      setDeliveryContact("");
      setDeliveryPhone("");
    } else if (customerId) {
      setCustomerId("");
      setAttention("");
      setPhone("");
      setBillingAddress("");
      setDeliveryAddress("");
      setDeliveryContact("");
      setDeliveryPhone("");
    }
  }
  function chooseProduct(id: string, value: string) {
    const product = reference.products.find((entry) => entry.sku.toLowerCase() === value.trim().toLowerCase());
    const row = items.find((entry) => entry.id === id);
    if (!row) return;
    const selected = invoice || !selectedInvoice
      ? { item: itemFromProduct(row, product, value) }
      : selectDeliveryProduct(row, product, value, selectedInvoice, items, reference.products);
    setError(selected.error || "");
    setItems((rows) => rows.map((entry) => entry.id === id ? selected.item : entry));
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
      if (
        selectedInvoiceId &&
        item.invoiceItemId &&
        item.remainingQuantity !== undefined &&
        item.quantity > item.remainingQuantity
      )
        return `Item ${index + 1}: Delivery quantity cannot exceed the remaining quantity of ${item.remainingQuantity}.`;
      if (item.unitPrice < 0) return `Item ${index + 1}: Unit Price must be zero or greater.`;
    }
    const invoiceItemProductPairs = items.flatMap((item) => item.invoiceItemId && item.productId ? [`${item.invoiceItemId}:${item.productId}`] : []);
    if (new Set(invoiceItemProductPairs).size !== invoiceItemProductPairs.length)
      return "This Child SKU has already been added for the same Invoice item.";
    const invoiceGroups = new Map<string, { quantity: number; remaining: number }>();
    items.forEach((item) => {
      if (!item.invoiceItemId) return;
      const group = invoiceGroups.get(item.invoiceItemId) || { quantity: 0, remaining: item.remainingQuantity || 0 };
      group.quantity += Number(item.quantity || 0);
      group.remaining = item.remainingQuantity || group.remaining;
      invoiceGroups.set(item.invoiceItemId, group);
    });
    for (const group of invoiceGroups.values()) {
      if (group.quantity > group.remaining)
        return `Delivery quantity cannot exceed the remaining quantity of ${group.remaining}.`;
    }
    const extraProductIds = items.flatMap((item) => item.itemSource === "extra" && item.productId ? [item.productId] : []);
    if (new Set(extraProductIds).size !== extraProductIds.length)
      return "This Extra Item has already been added to the current Delivery Order.";
    return "";
  }
  async function submit(saveMode: "invoice-do" | "invoice-only" = "invoice-do") {
    const validation = validationError();
    setError(validation);
    if (validation) return;
    setSaving(saveMode);
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
        deliveryContact,
        deliveryPhone,
        itemCollectMethod,
        status: "Scheduled",
      };
      if (invoice) {
        const invoiceDraft = {
          ...common,
          invoiceDate: new Date().toISOString().slice(0, 10),
          poNumber: po,
          gstRate: 9,
          deposit,
          paymentStatus: "Issued",
          paymentMethod,
          collectionMethod: "Delivery by Tesvila",
          installationOption: "Supply only",
          titleOfInvoice: titleOfInvoice.trim() || "Supply Sanitary Ware",
        };
        const saved = saveMode === "invoice-only"
          ? await store.saveInvoiceOnly(invoiceDraft)
          : await store.saveInvoice(invoiceDraft);
        store.notify(
          saveMode === "invoice-only"
            ? `${saved.invoiceNumber} saved as Invoice Only. No Delivery Order or stock movement was created.`
            : `${saved.invoiceNumber} and its linked Delivery Order were saved. PDFs are available from the document tables.`,
        );
        onNavigate?.("Invoice History");
      } else {
        const saved = await store.saveDO({
          ...common,
          invoiceId: selectedInvoiceId || undefined,
          invoiceNumber: selectedInvoiceNumber,
        });
        store.notify(
          `${saved.doNumber} saved. PDF is available from the Delivery Order Table.`,
        );
        onNavigate?.("Delivery Order History");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Document could not be saved");
    } finally {
      setSaving("");
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
        {!invoice && (
          <InvoiceSelector
            id="delivery-order-selected-invoice"
            invoices={store.invoices}
            value={selectedInvoiceQuery}
            selectedId={selectedInvoiceId}
            loading={store.documentsLoading}
            onChange={chooseInvoice}
            onClear={clearSelectedInvoice}
            onBlur={() => {
              if (!selectedInvoiceId) return;
              const current = store.invoices.find((entry) => entry.id === selectedInvoiceId);
              setSelectedInvoiceQuery(current ? invoiceOptionLabel(current) : selectedInvoiceNumber);
            }}
          />
        )}
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
          <div className="document-delivery-contact-row">
            <div className="field"><label>Delivery Contact Person</label><input className="input" value={deliveryContact} onChange={(e) => setDeliveryContact(e.target.value)} /></div>
            <div className="field"><label>Delivery Contact Number</label><input className="input" value={deliveryPhone} onChange={(e) => setDeliveryPhone(e.target.value)} /></div>
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
          {invoice && <div className="field"><label>Title of Invoice</label><input className="input" value={titleOfInvoice} onChange={(e) => setTitleOfInvoice(e.target.value)} /></div>}
        </div>
        {!invoice && selectedInvoice && <PreviouslyDeliveredItems items={historicalItems} />}
        {!invoice && selectedInvoice && <div className="current-delivery-heading"><h3>Current Delivery Items</h3><span>Only these editable rows will be saved.</span></div>}
        <div className="items-editor">
          <div className={`edit-row header ${selectedInvoiceId ? "partial-delivery" : ""}`}>
            <div></div>
            <div>SKU</div>
            <div>Product model</div>
            <div>Product type</div>
            <div>Description / brand</div>
            {selectedInvoiceId ? (
              <>
                <div>Invoice Qty</div>
                <div>Previously Delivered</div>
                <div>Remaining</div>
                <div>Current Delivery Qty</div>
              </>
            ) : <div>Qty</div>}
            <div>Unit price</div>
            <div>Discount</div>
            <div>Amount</div>
            <div>Actions</div>
          </div>
          {items.map((row) => (
            <div className={`edit-row ${selectedInvoiceId ? "partial-delivery" : ""}`} key={row.id}>
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
                {selectedInvoiceId && row.productId && <small className={`item-source ${row.invoiceItemId ? "invoice" : "extra"}`}>{row.invoiceItemId ? "Invoice Item" : "Extra Item"}</small>}
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
                  placeholder="Brand"
                  onChange={(e) =>
                    update(row.id, "brand", e.target.value)
                  }
                />
              </div>
              {selectedInvoiceId && <div className="delivery-quantity-value">{row.invoiceItemId ? row.invoiceQuantity || 0 : "Not in Invoice"}</div>}
              {selectedInvoiceId && <div className="delivery-quantity-value">{row.previouslyDeliveredQuantity || 0}</div>}
              {selectedInvoiceId && <div className="delivery-quantity-value remaining">{row.invoiceItemId ? row.remainingQuantity || 0 : "N/A"}</div>}
              <div>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max={selectedInvoiceId && row.invoiceItemId ? row.remainingQuantity : undefined}
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
          <Plus size={12} /> {invoice ? "Add item" : "Item"}
        </button>
        {selectedInvoiceId && !items.length && (
          <div className="status gray mt">No new delivery items added.</div>
        )}
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
          <div className="row wrap document-save-actions">
            <button className="btn" disabled={!!saving} onClick={() => onNavigate?.("Dashboard")}>Cancel</button>
            <button
              className="btn primary"
              disabled={!!saving || reference.loading}
              onClick={() => submit("invoice-do")}
            >
              <Save size={13} />
              {saving === "invoice-do"
                ? "Saving to database…"
                : invoice
                  ? "Save Invoice & DO"
                  : "Save Delivery Order"}
            </button>
            {invoice && (
              <button
                className="btn primary"
                disabled={!!saving || reference.loading}
                onClick={() => submit("invoice-only")}
              >
                <Save size={13} />
                {saving === "invoice-only" ? "Saving Invoice…" : "Save Invoice Only"}
              </button>
            )}
          </div>
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
    const inv = record as InvoiceRecord;
    const delivery = record as DORecord;
    if (!invoice && delivery.invoiceId) {
      store.notify(
        "This Delivery Order is linked to an Invoice and cannot be deleted separately. Delete the related Invoice to remove this Delivery Order.",
      );
      return;
    }
    const message = invoice && inv.relatedDeliveryOrders.length
      ? `This Invoice has ${inv.relatedDeliveryOrders.length} related Delivery Orders. Deleting the Invoice will also delete all related Delivery Orders and reverse their stock movements. Continue?`
      : invoice
        ? `Delete ${inv.invoiceNumber}? This action is audited.`
        : "Delete this Delivery Order? Its inventory movement will be reversed.";
    if (
      !confirm(message)
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
                  <th>Delivery Status</th>
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
                      <td>
                        <b>{inv.relatedDeliveryOrders.length}</b>
                        <div className="muted">{inv.doNumber}</div>
                      </td>
                      <td><span className={`status ${inv.deliveryStatus === "Partially Delivered" ? "amber" : inv.deliveryStatus === "Fully Delivered" ? "" : "gray"}`}>{inv.deliveryStatus}</span></td>
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
                      {(!invoice || !!inv.doId) && (
                        <button
                          className="btn sm"
                          disabled={!!busy}
                          onClick={() => pdf(record, "do")}
                        >
                          <Download size={11} /> {invoice ? "DO PDF" : "Save PDF"}
                        </button>
                      )}
                      <button
                        className="btn sm"
                        disabled={!!busy}
                        onClick={() => duplicate(record)}
                      >
                        <Copy size={11} /> Duplicate
                      </button>
                      {!(!invoice && dor.invoiceId) ? (
                        <button
                          className="btn sm danger"
                          onClick={() => remove(record)}
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      ) : (
                        <button
                          className="btn sm"
                          disabled
                          title="This Delivery Order is linked to an Invoice and cannot be deleted separately. Delete the related Invoice to remove this Delivery Order."
                        >
                          <Trash2 size={11} /> Linked to Invoice
                        </button>
                      )}
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

function InvoiceReportPreview({
  invoice,
  onClose,
}: {
  invoice: InvoiceRecord;
  onClose: () => void;
}) {
  const report = buildInvoiceReportData(invoice);
  const pages = paginateInvoiceReportItems(report.items);
  const rowsForPage = (pageItems: typeof report.items, pageIndex: number) => {
    const rows: Array<(typeof report.items)[number] | undefined> = [...pageItems];
    if (pageIndex === 0) while (rows.length < 3) rows.push(undefined);
    return rows;
  };
  return (
    <div className="modal-backdrop invoice-report-backdrop">
      <div className="invoice-report-shell">
        <div className="invoice-report-actions no-print">
          <button className="btn" onClick={onClose}><X size={14} /> Close</button>
          <button className="btn" onClick={() => window.print()}><FileText size={14} /> Print</button>
          <button className="btn primary" onClick={() => generateInvoicePdf(invoice)}><Download size={14} /> Download PDF</button>
        </div>
        <div className="invoice-report-pages">
          {pages.map((pageItems, pageIndex) => {
            const finalPage = pageIndex === pages.length - 1;
            return (
              <article className="invoice-report-page" key={`${report.invoiceNumber}-${pageIndex}`}>
                {pageIndex === 0 ? (
                  <>
                    <header className="invoice-report-header">
                      <div className="invoice-company">
                        <h1>{report.company.name}</h1>
                        <div>{report.company.addressLine1}</div>
                        <div>{report.company.addressLine2}</div>
                        <div>TEL: {report.company.telephone}</div>
                        <div>EMAIL: {report.company.email}</div>
                        <div>Co./GST Reg.No. {report.company.registrationNumber}</div>
                      </div>
                      <div className="invoice-title-logo">
                        <h2>{report.title}</h2>
                      </div>
                    </header>
                    <div className="invoice-report-intro">
                      <table className="invoice-info-table"><tbody>
                        <tr><th>Invoice No.</th><td><b>{report.invoiceNumber}</b></td></tr>
                        <tr><th>PO No.</th><td>{report.poNumber}</td></tr>
                        <tr><th>DO No.</th><td>{report.doNumbers}</td></tr>
                        <tr><th>Issued Date</th><td>{report.issuedDate}</td></tr>
                        <tr><th>Delivery Date</th><td>{report.deliveryOrders.length ? report.deliveryOrders.map((order) => <div key={order.number}>{order.number} - {order.date}</div>) : "-"}</td></tr>
                      </tbody></table>
                      <div className="invoice-report-logo"><Image src={tesvilaLogo} alt="TESVILA" priority /></div>
                    </div>
                    <section className="invoice-to">
                      <b>Invoice To:</b>
                      <strong>{report.customer.companyName}</strong>
                      <span>{report.customer.address}</span>
                      <span>Contact Name: {report.customer.contactName}</span>
                      <span>Contact Number: {report.customer.contactNumber}</span>
                    </section>
                  </>
                ) : (
                  <header className="invoice-continuation-header">
                    <div><strong>{report.company.name}</strong><span>Co./GST Reg.No. {report.company.registrationNumber}</span></div>
                    <div><b>Invoice No.: {report.invoiceNumber}</b><span>Customer: {report.customer.companyName}</span></div>
                  </header>
                )}
                <h3 className="invoice-items-title">{report.sectionTitle}</h3>
                <table className="invoice-item-report-table">
                  <thead><tr><th>No.</th><th>Item Description</th><th>Quantity</th><th>Unit Price</th><th>Amount</th></tr></thead>
                  <tbody>{rowsForPage(pageItems, pageIndex).map((item, rowIndex) => (
                    <tr key={item?.id || `blank-${rowIndex}`} className={!item ? "invoice-blank-row" : undefined}>
                      <td>{item?.number || ""}</td>
                      <td>{item && <div className="invoice-description"><span>{[item.brand, item.description].filter(Boolean).join(" ")}</span></div>}</td>
                      <td>{item?.quantity ?? ""}</td>
                      <td>{item ? invoiceReportMoney(item.unitPrice) : ""}</td>
                      <td>{item ? invoiceReportMoney(item.amount) : ""}</td>
                    </tr>
                  ))}</tbody>
                </table>
                {finalPage && (
                  <footer className="invoice-report-footer">
                    <div className="invoice-notice"><b>NOTICE</b><span>{report.notice}</span></div>
                    <div className="invoice-remarks"><b>Remarks:</b><span>{report.remarks}</span></div>
                    <div className="invoice-method-totals">
                      <div className="invoice-methods">
                        <div><b>ITEM COLLECT METHOD</b><span>{report.itemCollectMethod}</span></div>
                        <div><b>PAYMENT METHOD</b><span>{report.paymentMethod}</span></div>
                      </div>
                      <table className="invoice-total-table"><tbody>
                        <tr><th>Total</th><td>{invoiceReportMoney(report.totals.subtotal)}</td></tr>
                        <tr><th>GST {report.totals.gstRate}%</th><td>{invoiceReportMoney(report.totals.gstAmount)}</td></tr>
                        <tr><th>Grand Total</th><td>{invoiceReportMoney(report.totals.grandTotal)}</td></tr>
                        <tr><th>Deposit</th><td>{invoiceReportMoney(report.totals.deposit)}</td></tr>
                        <tr><th>Balance</th><td>{invoiceReportMoney(report.totals.balance)}</td></tr>
                      </tbody></table>
                    </div>
                    <div className="invoice-terms-row">
                      <div className="invoice-terms"><b>Terms and Conditions:</b><ol>{report.terms.map((term) => <li key={term}>{term}</li>)}</ol></div>
                      <div className="invoice-qr"><Image src={payNowQr} alt="PayNow QR" /><b>PayNow</b></div>
                      <div className="invoice-issued-by">Issued By: {report.issuedBy}</div>
                    </div>
                  </footer>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </div>
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
  const savedDelivery = record as DORecord;
  const linkedInvoice = !invoice && savedDelivery.invoiceId
    ? store.invoices.find((entry) => entry.id === savedDelivery.invoiceId)
    : undefined;
  const [draft, setDraft] = useState<InvoiceRecord | DORecord>(() => ({
      ...record,
      customer: { ...record.customer },
      items: linkedInvoice
        ? invoiceItemsForDeliveryOrder(linkedInvoice, savedDelivery)
        : record.items.map((item) => ({ ...item })),
    })),
    [saving, setSaving] = useState(false),
    [relatedView, setRelatedView] = useState<DORecord | null>(null),
    [selectedInvoiceQuery, setSelectedInvoiceQuery] = useState(() => {
      if (invoice) return "";
      const linkedNumber = (record as DORecord).invoiceNumber;
      return linkedNumber && linkedNumber !== "—"
        ? linkedNumber
        : mode === "view"
          ? "No linked invoice"
          : "";
    }),
    readOnly = mode === "view";
  const inv = draft as InvoiceRecord,
    delivery = draft as DORecord;
  const activeModalInvoice = !invoice && delivery.invoiceId
    ? store.invoices.find((entry) => entry.id === delivery.invoiceId)
    : undefined;
  const modalHistoricalItems = activeModalInvoice
    ? previouslyDeliveredItems(activeModalInvoice, savedDelivery)
    : [];
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
      ...(!invoice && match ? { deliveryAddress: match.delivery_address || "", deliveryContact: "", deliveryPhone: "" } : {}),
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
    const row = draft.items.find((item) => item.id === id);
    if (!row) return;
    const selected = !invoice && activeModalInvoice
      ? selectDeliveryProduct(row, product, value, activeModalInvoice, draft.items, reference.products, savedDelivery)
      : { item: itemFromProduct(row, product, value) };
    if (selected.error) {
      store.notify(selected.error);
      return;
    }
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => item.id === id ? selected.item : item),
    }) as InvoiceRecord | DORecord);
  };
  const addModalItem = () => {
    if (!invoice && draft.items.some((item) => !item.productId)) {
      store.notify("Complete the current item before adding another item.");
      return;
    }
    setDraft((current) => ({
      ...current,
      items: [...current.items, emptyItem()],
    }) as InvoiceRecord | DORecord);
  };
  const clearModalInvoice = () => {
    if (!delivery.invoiceId) {
      setSelectedInvoiceQuery("");
      return;
    }
    const keepDetails = window.confirm(
      "The Invoice link will be removed. Select OK to keep the current customer and item details, or Cancel to clear them.",
    );
    setSelectedInvoiceQuery("");
    setDraft((current) => ({
      ...current,
      invoiceId: undefined,
      invoiceNumber: "—",
      ...(keepDetails
        ? {}
        : {
            customer: emptyCustomerSnapshot(),
            deliveryAddress: "",
            deliveryContact: "",
            deliveryPhone: "",
            itemCollectMethod: "",
            items: [],
          }),
    }) as DORecord);
  };
  const chooseModalInvoice = (value: string) => {
    setSelectedInvoiceQuery(value);
    if (!value.trim()) {
      clearModalInvoice();
      return;
    }
    const normalized = value.trim().toLowerCase();
    const selected = store.invoices.find(
      (entry) =>
        entry.invoiceNumber.toLowerCase() === normalized ||
        invoiceOptionLabel(entry).toLowerCase() === normalized,
    );
    if (!selected) return;
    if (selected.id === delivery.invoiceId) {
      setSelectedInvoiceQuery(invoiceOptionLabel(selected));
      return;
    }
    if (
      (delivery.invoiceId || draft.customer.name.trim() || draft.items.length > 0) &&
      !window.confirm(
        "Changing the selected Invoice will replace the current customer and item details. Continue?",
      )
    ) {
      const current = store.invoices.find((entry) => entry.id === delivery.invoiceId);
      setSelectedInvoiceQuery(current ? invoiceOptionLabel(current) : delivery.invoiceNumber || "");
      return;
    }
    setSelectedInvoiceQuery(invoiceOptionLabel(selected));
    setDraft((current) => ({
      ...current,
      invoiceId: selected.id,
      invoiceNumber: selected.invoiceNumber,
      customer: { ...selected.customer },
      deliveryAddress: selected.customer.deliveryAddress,
      deliveryContact: "",
      deliveryPhone: "",
      itemCollectMethod: selected.itemCollectMethod || "",
      items: [],
    }) as DORecord);
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
      if (
        !invoice &&
        delivery.invoiceId &&
        item.invoiceItemId &&
        item.remainingQuantity !== undefined &&
        item.quantity > item.remainingQuantity
      )
        return `Item ${index + 1}: Delivery quantity cannot exceed the remaining quantity of ${item.remainingQuantity}.`;
      if (item.unitPrice < 0) return `Item ${index + 1}: Unit Price must be zero or greater.`;
    }
    if (!invoice) {
      const invoiceItemProductPairs = draft.items.flatMap((item) => item.invoiceItemId && item.productId ? [`${item.invoiceItemId}:${item.productId}`] : []);
      if (new Set(invoiceItemProductPairs).size !== invoiceItemProductPairs.length)
        return "This Child SKU has already been added for the same Invoice item.";
      const invoiceGroups = new Map<string, { quantity: number; remaining: number }>();
      draft.items.forEach((item) => {
        if (!item.invoiceItemId) return;
        const group = invoiceGroups.get(item.invoiceItemId) || { quantity: 0, remaining: item.remainingQuantity || 0 };
        group.quantity += Number(item.quantity || 0);
        group.remaining = item.remainingQuantity || group.remaining;
        invoiceGroups.set(item.invoiceItemId, group);
      });
      for (const group of invoiceGroups.values()) {
        if (group.quantity > group.remaining)
          return `Delivery quantity cannot exceed the remaining quantity of ${group.remaining}.`;
      }
      const extraProductIds = draft.items.flatMap((item) => item.itemSource === "extra" && item.productId ? [item.productId] : []);
      if (new Set(extraProductIds).size !== extraProductIds.length)
        return "This Extra Item has already been added to the current Delivery Order.";
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
  if (invoice && readOnly) {
    return <InvoiceReportPreview invoice={inv} onClose={close} />;
  }
  return (
    <>
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
          {!invoice && (
            <InvoiceSelector
              id={`edit-selected-invoice-${record.id}`}
              invoices={store.invoices}
              value={selectedInvoiceQuery}
              selectedId={delivery.invoiceId}
              loading={store.documentsLoading}
              disabled={readOnly}
              onChange={chooseModalInvoice}
              onClear={clearModalInvoice}
              onBlur={() => {
                if (!delivery.invoiceId) return;
                const current = store.invoices.find((entry) => entry.id === delivery.invoiceId);
                setSelectedInvoiceQuery(current ? invoiceOptionLabel(current) : delivery.invoiceNumber);
              }}
            />
          )}
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
            {!invoice && <>
              <div className="field">
                <label>Delivery Contact Person</label>
                <input
                  className="input"
                  disabled={readOnly}
                  value={readOnly ? delivery.deliveryContact || draft.customer.attention || "" : delivery.deliveryContact}
                  onChange={(e) => setField("deliveryContact", e.target.value)}
                />
              </div>
              <div className="field">
                <label>Delivery Contact Number</label>
                <input
                  className="input"
                  disabled={readOnly}
                  value={readOnly ? delivery.deliveryPhone || draft.customer.phone || "" : delivery.deliveryPhone}
                  onChange={(e) => setField("deliveryPhone", e.target.value)}
                />
              </div>
            </>}
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
                <div className="field">
                  <label>Title of Invoice</label>
                  <input
                    className="input"
                    disabled={readOnly}
                    value={inv.titleOfInvoice || "Supply Sanitary Ware"}
                    onChange={(e) => setField("titleOfInvoice", e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          {invoice && (
            <div className="related-delivery-orders mt">
              <div className="row between">
                <b>Related Delivery Orders</b>
                <span className={`status ${inv.deliveryStatus === "Partially Delivered" ? "amber" : inv.deliveryStatus === "Fully Delivered" ? "" : "gray"}`}>{inv.deliveryStatus}</span>
              </div>
              {!inv.relatedDeliveryOrders.length ? (
                <p className="muted">No Delivery Orders have been created for this Invoice.</p>
              ) : inv.relatedDeliveryOrders.map((related) => {
                const relatedRecord = store.deliveryOrders.find((entry) => entry.id === related.id);
                return (
                  <div className="related-delivery-row" key={related.id}>
                    <div><b>{related.doNumber}</b><small>{date(related.deliveryDate)}</small></div>
                    <span>{related.deliveredQuantity} units</span>
                    <span className="status gray">{related.status}</span>
                    <button className="btn sm" disabled={!relatedRecord} onClick={() => relatedRecord && setRelatedView(relatedRecord)}><Eye size={11} /> View</button>
                  </div>
                );
              })}
            </div>
          )}
          {!invoice && !readOnly && activeModalInvoice && <PreviouslyDeliveredItems items={modalHistoricalItems} />}
          {!invoice && !readOnly && activeModalInvoice && <div className="current-delivery-heading"><h3>Current Delivery Items</h3><span>Only these editable rows will be saved.</span></div>}
          <div className="table-wrap mt document-items-table-wrap">
            <table className={`table document-items-table ${!invoice && delivery.invoiceId ? "partial-delivery" : ""}`}>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product Model</th>
                  <th>Product Type</th>
                  <th>Description</th>
                  {!invoice && delivery.invoiceId ? (
                    <>
                      <th>Invoice Qty</th>
                      <th>Previously Delivered</th>
                      <th>Remaining</th>
                      <th>Current Delivery Qty</th>
                    </>
                  ) : <th>Qty</th>}
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
                      {!invoice && delivery.invoiceId && i.productId && <small className={`item-source ${i.invoiceItemId ? "invoice" : "extra"}`}>{i.invoiceItemId ? "Invoice Item" : "Extra Item"}</small>}
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
                      <input
                        className="input"
                        style={{ marginTop: 4 }}
                        disabled={readOnly}
                        value={i.brand}
                        placeholder="Brand"
                        onChange={(e) =>
                          setItem(i.id, "brand", e.target.value)
                        }
                        />
                      </td>
                    {!invoice && delivery.invoiceId && <td><b>{i.invoiceItemId ? i.invoiceQuantity || 0 : "Not in Invoice"}</b></td>}
                    {!invoice && delivery.invoiceId && <td>{i.previouslyDeliveredQuantity || 0}</td>}
                    {!invoice && delivery.invoiceId && <td><b className="delivery-remaining">{i.invoiceItemId ? i.remainingQuantity || 0 : "N/A"}</b></td>}
                    <td>
                      <input
                        className="input"
                        type="number"
                        min="1"
                        max={!invoice && delivery.invoiceId && i.invoiceItemId ? i.remainingQuantity : undefined}
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
              onClick={addModalItem}
            >
              <Plus size={12} /> {invoice ? "Add item" : "Item"}
            </button>
          )}
          {!invoice && !readOnly && delivery.invoiceId && !draft.items.length && <div className="status gray mt">No new delivery items added.</div>}
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
            {readOnly && (!invoice || !!inv.doId) && (
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
    {relatedView && (
      <RecordModal
        record={relatedView}
        invoice={false}
        mode="view"
        close={() => setRelatedView(null)}
      />
    )}
    </>
  );
}

const TESVILA_BLUE = rgb(0.02, 0.23, 0.49),
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
  const logoSize = kit.logo.scaleToFit(42, 38);
  page.drawImage(kit.logo, {
    x: 36 + (42 - logoSize.width) / 2,
    y: 798 + (38 - logoSize.height) / 2,
    width: logoSize.width,
    height: logoSize.height,
  });
  page.drawText("TESVILA PTE LTD", {
    x: 88,
    y: 822,
    size: 14,
    font: kit.bold,
    color: TESVILA_BLUE,
  });
  page.drawText(
    "4001 Ang Mo Kio Industrial Park 1, #01-09, Singapore 569622",
    { x: 88, y: 809, size: 7, font: kit.regular, color: INK },
  );
  page.drawText(
    "Tel: +65 8189 5198  |  Co./GST Reg.No. 201604567R",
    { x: 88, y: 798, size: 7, font: kit.regular, color: INK },
  );
  page.drawText("Email: sales@tesvila.com.sg", { x: 421, y: 820, size: 7, font: kit.regular, color: INK });
  page.drawText("Web: www.tesvila.com.sg", { x: 433, y: 808, size: 7, font: kit.regular, color: INK });
  page.drawLine({ start: { x: 36, y: 785 }, end: { x: 559, y: 785 }, thickness: 1.2, color: TESVILA_BLUE });
  page.drawText(continuation ? `${title} — CONTINUED` : title, {
    x: 36,
    y: 758,
    size: 18,
    font: kit.bold,
    color: TESVILA_BLUE,
  });
  page.drawText(no, { x: 455, y: 760, size: 10, font: kit.bold, color: TESVILA_BLUE });
}
function doTableHead(kit: PdfKit, page: PDFPage, y: number) {
  page.drawRectangle({
    x: 36,
    y: y - 18,
    width: 523,
    height: 20,
    color: TESVILA_BLUE,
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

const DELIVERY_ORDER_TERMS = [
  "All goods listed above are received in good condition unless otherwise stated at the time of delivery.",
  "Any claim of damaged or missing goods must be made in writing within 24 hours upon receipt of goods. Claims made after this period may not be entertained.",
  "Ownership of the goods remains with TESVILA PTE LTD until full payment is received.",
  "Delivery is considered complete once the goods are handed over to the stated delivery address or an authorized representative.",
  "Additional delivery charges may apply if no one is present to receive the goods at the delivery location during the scheduled delivery time.",
  "The customer is responsible for inspecting the goods immediately upon delivery. Any discrepancy should be noted on this delivery order.",
  "Goods sold and delivered are not returnable unless prior agreement is made in writing.",
  "If installation is not included, TESVILA PTE LTD is not responsible for any damage or defect arising from improper installation by third parties.",
  "By signing this delivery order, the customer acknowledges that the goods are delivered as listed and agrees to the terms stated above.",
] as const;

const DELIVERY_ORDER_STATIC_FOOTER_TOP = 270;

function drawDeliveryOrderStaticFooter(
  kit: PdfKit,
  page: PDFPage,
  order: DORecord,
) {
  page.drawLine({
    start: { x: 36, y: DELIVERY_ORDER_STATIC_FOOTER_TOP },
    end: { x: 559, y: DELIVERY_ORDER_STATIC_FOOTER_TOP },
    thickness: 0.8,
    color: INK,
  });
  page.drawText("DELIVERY ORDER TERMS & CONDITIONS", {
    x: 36,
    y: DELIVERY_ORDER_STATIC_FOOTER_TOP - 14,
    size: 7,
    font: kit.bold,
    color: TESVILA_BLUE,
  });
  let termsY = DELIVERY_ORDER_STATIC_FOOTER_TOP - 27;
  DELIVERY_ORDER_TERMS.forEach((term, index) => {
    const lines = wrap(kit.regular, 5.5, `${index + 1}. ${term}`, 523);
    drawLines(page, kit.regular, 5.5, lines, 36, termsY, 6.6, INK);
    termsY -= lines.length * 6.6;
  });

  const signatureY = 93;
  page.drawLine({
    start: { x: 36, y: signatureY },
    end: { x: 190, y: signatureY },
    thickness: 0.7,
    color: INK,
  });
  page.drawText("Driver / Delivery Personnel", {
    x: 36,
    y: signatureY - 13,
    size: 7,
    font: kit.bold,
  });
  page.drawLine({
    start: { x: 350, y: signatureY },
    end: { x: 555, y: signatureY },
    thickness: 0.7,
    color: INK,
  });
  page.drawText("Goods Checked & Received In Good Condition", {
    x: 350,
    y: signatureY + 16,
    size: 6.5,
    font: kit.bold,
    color: INK,
  });
  page.drawText("Customer Signature", {
    x: 350,
    y: signatureY - 13,
    size: 7,
    font: kit.bold,
  });
  page.drawText("Received Date: ____________________", {
    x: 350,
    y: signatureY - 47,
    size: 7,
    font: kit.regular,
  });
  page.drawText(`Issued by: ${order.createdBy}`, {
    x: 36,
    y: signatureY - 47,
    size: 7,
    font: kit.bold,
    color: INK,
  });
}

export async function generateInvoicePdf(inv: InvoiceRecord) {
  const [logoResponse, qrResponse] = await Promise.all([
    fetch(tesvilaLogo.src),
    fetch(payNowQr.src),
  ]);
  if (!logoResponse.ok) throw new Error("Tesvila logo could not be loaded");
  if (!qrResponse.ok) throw new Error("PayNow QR code could not be loaded");
  const bytes = await createInvoicePdf(
    buildInvoiceReportData(inv),
    await logoResponse.arrayBuffer(),
    await qrResponse.arrayBuffer(),
  );
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: "application/pdf" }),
  );
  anchor.download = `${inv.invoiceNumber}-Invoice.pdf`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
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
  const reportDeliveryContact = order.deliveryContact || order.customer.attention || "—";
  const reportDeliveryPhone = order.deliveryPhone || order.customer.phone || "—";
  page.drawText(`Attn: ${order.customer.attention || "—"}`, { x: 36, y: doCustomerY, size: 8, font: regular, color: MUTED });
  page.drawText(`HP No.: ${order.customer.phone || "—"}`, { x: 36, y: doCustomerY - 12, size: 8, font: regular, color: MUTED });
  page.drawText(`Invoice No.: ${order.invoiceNumber || "—"}`, { x: 36, y: doCustomerY - 24, size: 8, font: regular, color: MUTED });

  const deliveryInformation = [
    ["DO No.", [order.doNumber]],
    ["Delivery Address", wrap(regular, 8, order.deliveryAddress || order.customer.deliveryAddress || "—", 125)],
    ["Contact Person", wrap(regular, 8, reportDeliveryContact, 125)],
    ["Contact Number", wrap(regular, 8, reportDeliveryPhone, 125)],
    ["DO Date", [date(order.deliveryDate)]],
  ] as const;
  let deliveryInformationY = 720;
  deliveryInformation.forEach(([label, values]) => {
    page.drawText(label, { x: 350, y: deliveryInformationY, size: 7, font: bold, color: MUTED });
    drawLines(page, regular, 8, [...values], 430, deliveryInformationY, 10, INK);
    deliveryInformationY -= Math.max(18, values.length * 10 + 6);
  });

  const detailBottom = Math.min(doCustomerY - 24, deliveryInformationY);
  let y = doTableHead(kit, page, Math.min(638, detailBottom - 18));
  const reserve = DELIVERY_ORDER_STATIC_FOOTER_TOP + 78;
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
  const finalRemarkLines = wrap(
    regular,
    7,
    order.remarks || "Please inspect all items upon delivery.",
    510,
  );
  const dynamicFooterHeight = Math.max(50, finalRemarkLines.length * 9 + 32);
  if (y - dynamicFooterHeight < DELIVERY_ORDER_STATIC_FOOTER_TOP + 12) {
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
    color: TESVILA_BLUE,
  });
  page.drawText("ITEM COLLECT METHOD", {
    x: 360,
    y: y - 15,
    size: 7,
    font: bold,
    color: TESVILA_BLUE,
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
    finalRemarkLines,
    36,
    y - 29,
    9,
    MUTED,
  );
  drawDeliveryOrderStaticFooter(kit, page, order);
  await savePdf(kit, `${order.doNumber}-Delivery-Order.pdf`);
}
