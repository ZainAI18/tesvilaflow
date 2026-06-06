export type DocumentLine = {
  code: string;
  description: string;
  quantity: number;
  unitPrice?: number;
  amount?: number;
};

export type InvoicePdfData = {
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  billingAddress?: string;
  lines: DocumentLine[];
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
};

export type DeliveryOrderPdfData = {
  doNumber: string;
  doDate: string;
  customerName: string;
  deliveryAddress?: string;
  relatedInvoiceNumber: string;
  lines: DocumentLine[];
};

export function buildInvoicePdfModel(data: InvoicePdfData) {
  return {
    title: "Tax Invoice",
    companyName: "Tesvila",
    gstLabel: "GST 9%",
    ...data
  };
}

export function buildDeliveryOrderPdfModel(data: DeliveryOrderPdfData) {
  return {
    title: "Delivery Order",
    companyName: "Tesvila",
    ...data
  };
}
