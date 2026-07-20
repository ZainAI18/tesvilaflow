import { invoiceItemLineAmount } from "./invoice-discount";
import {
  calculateInvoiceTotals,
  gstModeLabel,
  inferGstMode,
  type GstMode,
} from "./invoice-totals";

export const TESVILA_COMPANY = {
  name: "Tesvila Pte Ltd",
  addressLine1: "BLOCK 4001 ANG MO KIO INDUSTRIAL PARK1",
  addressLine2: "#01-09 SINGAPORE 569622",
  telephone: "8189 5198",
  email: "sales@tesvila.com.sg",
  registrationNumber: "201604567R",
} as const;

export const CONFIDENTIAL_PRICING_NOTICE =
  "Please note that the pricing provided in this invoice is a special price offered exclusively to your company. We kindly request that this information remains confidential and is not disclosed to any third party without our prior consent.";

export const INVOICE_TERMS = [
  "Full payment is required upon order confirmation.",
  "Once confirmed, goods are considered sold.",
  "Goods sold are non-returnable and non-exchangeable.",
  "Installation services are not included unless explicitly stated.",
  "For installation, specific light points must be provided.",
  "A minimum of one week's notice is required for delivery or installation.",
  "Tesvila Pte Ltd retains ownership of goods until full payment is received.",
  "Goods must be inspected upon delivery. Tesvila Pte Ltd will not be responsible for damages discovered after delivery.",
  "Once an order is confirmed, cancellations are not allowed. If cancellation occurs, the full agreed price must still be paid.",
  "All cheques should be crossed and made payable to: TESVILA PTE LTD.",
  "PayNow to UEN (Please indicate invoice number under reference): 201604567R.",
  "Bank transfer to: OCBC Bank 526 228 440 001 (Please indicate invoice number).",
] as const;

export type InvoiceReportSource = {
  invoiceNumber: string;
  invoiceDate: string;
  titleOfInvoice?: string;
  poNumber?: string;
  customer: {
    name?: string;
    billingAddress?: string;
    attention?: string;
    phone?: string;
  };
  items: Array<{
    id: string;
    sku?: string;
    model?: string;
    type?: string;
    brand?: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    discountAmount?: number;
    discountBasisQuantity?: number;
    discountBasisUnitPrice?: number;
  }>;
  relatedDeliveryOrders?: Array<{
    id: string;
    doNumber?: string;
    deliveryDate?: string;
  }>;
  itemCollectMethod?: string;
  paymentMethod?: string;
  remarks?: string;
  createdBy?: string;
  gstRate?: number;
  gstMode?: GstMode;
  deposit?: number;
  subtotal?: number;
  gstAmount?: number;
  grandTotal?: number;
  balance?: number;
};

export type InvoiceReportItem = {
  id: string;
  number: number;
  sku: string;
  model: string;
  type: string;
  brand: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  amount: number;
};

export type InvoiceReportData = ReturnType<typeof buildInvoiceReportData>;

const safeText = (value: unknown, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text && text !== "null" && text !== "undefined" ? text : fallback;
};

const safeNumber = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const invoiceReportDate = (value?: string) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Singapore",
  }).format(parsed);
};

export const invoiceReportMoney = (value: number) =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

export function buildInvoiceReportData(invoice: InvoiceReportSource) {
  const items: InvoiceReportItem[] = invoice.items.map((item, index) => ({
    id: item.id,
    number: index + 1,
    sku: safeText(item.sku, "-"),
    model: safeText(item.model),
    type: safeText(item.type),
    brand: safeText(item.brand),
    description: safeText(item.description),
    quantity: safeNumber(item.quantity, 0),
    unitPrice: safeNumber(item.unitPrice, 0),
    discount: safeNumber(item.discount, 0),
    amount: invoiceItemLineAmount({
      ...item,
      quantity: safeNumber(item.quantity, 0),
      unitPrice: safeNumber(item.unitPrice, 0),
      discount: safeNumber(item.discount, 0),
    }),
  }));
  const gstMode = inferGstMode(invoice.gstMode, invoice);
  const calculatedTotals = calculateInvoiceTotals(items, gstMode);
  const gstRate = safeNumber(invoice.gstRate, calculatedTotals.gstRate);
  const subtotal = safeNumber(invoice.subtotal, calculatedTotals.subtotal);
  const gstAmount = safeNumber(invoice.gstAmount, calculatedTotals.gstAmount);
  const grandTotal = safeNumber(invoice.grandTotal, subtotal + gstAmount);
  const deposit = safeNumber(invoice.deposit, 0);
  const balance = safeNumber(invoice.balance, grandTotal - deposit);

  const uniqueDeliveryOrders = Array.from(
    new Map(
      (invoice.relatedDeliveryOrders || [])
        .filter((order) => safeText(order.doNumber))
        .map((order) => [safeText(order.doNumber), order]),
    ).values(),
  );

  return {
    company: TESVILA_COMPANY,
    title: "Invoice",
    invoiceNumber: safeText(invoice.invoiceNumber, "-"),
    poNumber: safeText(invoice.poNumber, "-"),
    issuedDate: invoiceReportDate(invoice.invoiceDate),
    deliveryOrders: uniqueDeliveryOrders.map((order) => ({
      number: safeText(order.doNumber, "-"),
      date: invoiceReportDate(order.deliveryDate),
    })),
    doNumbers: uniqueDeliveryOrders.map((order) => safeText(order.doNumber)).join(", ") || "-",
    customer: {
      companyName: safeText(invoice.customer.name, "-"),
      address: safeText(invoice.customer.billingAddress),
      contactName: safeText(invoice.customer.attention, "-"),
      contactNumber: safeText(invoice.customer.phone, "-"),
    },
    sectionTitle: safeText(invoice.titleOfInvoice, "Supply Sanitary Ware"),
    items,
    minimumTableRows: Math.max(3, items.length),
    notice: CONFIDENTIAL_PRICING_NOTICE,
    remarks: safeText(invoice.remarks),
    itemCollectMethod:
      invoice.itemCollectMethod === "delivery"
        ? "Delivery"
        : invoice.itemCollectMethod === "self_collect"
          ? "Self Collect"
          : "-",
    paymentMethod:
      invoice.paymentMethod === "paynow"
        ? "PayNow"
        : invoice.paymentMethod === "cash"
          ? "Cash"
          : invoice.paymentMethod === "terms"
            ? "Terms"
            : "-",
    totals: {
      subtotal,
      gstMode,
      gstLabel: gstModeLabel(gstMode),
      gstRate,
      gstAmount,
      grandTotal,
      deposit,
      balance,
    },
    terms: [...INVOICE_TERMS],
    issuedBy: safeText(invoice.createdBy, "-"),
  };
}

export function paginateInvoiceReportItems(items: InvoiceReportItem[]) {
  const pages: InvoiceReportItem[][] = [];
  const firstPageSize = 8;
  const continuationPageSize = 12;
  pages.push(items.slice(0, firstPageSize));
  for (let index = firstPageSize; index < items.length; index += continuationPageSize) {
    pages.push(items.slice(index, index + continuationPageSize));
  }
  return pages.length ? pages : [[]];
}
