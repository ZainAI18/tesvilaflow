import { calculateInvoiceItem, calculateLandedCost, summarizeInvoice } from "@/lib/costing";

export const products = [
  {
    productCode: "TB-9001",
    productName: "One Piece Toilet Bowl",
    brand: "Tesvila",
    category: "Toilet Bowl",
    supplier: "Guangzhou Sanitary Supply",
    warehouse: "Main Warehouse",
    stock: 38,
    wac: 148.25,
    dealerPrice: 260,
    retailPrice: 338,
    status: "Active"
  },
  {
    productCode: "SH-230",
    productName: "Rain Shower Set",
    brand: "AquaPro",
    category: "Shower Set",
    supplier: "Foshan Bath Co",
    warehouse: "Main Warehouse",
    stock: 12,
    wac: 72.6,
    dealerPrice: 138,
    retailPrice: 188,
    status: "Active"
  },
  {
    productCode: "FT-80",
    productName: "Stainless Floor Trap",
    brand: "Tesvila",
    category: "Floor Trap",
    supplier: "Taobao",
    warehouse: "Showroom",
    stock: 5,
    wac: 9.8,
    dealerPrice: 18,
    retailPrice: 28,
    status: "Active"
  }
];

export const suppliers = [
  {
    supplierName: "Guangzhou Sanitary Supply",
    contact: "Ms Chen",
    currency: "RMB",
    paymentTerm: "Deposit + balance",
    phone: "+86 138 0000 0000"
  },
  {
    supplierName: "Foshan Bath Co",
    contact: "Mr Li",
    currency: "USD",
    paymentTerm: "Before shipment",
    phone: "+86 139 0000 0000"
  }
];

export const customers = [
  {
    companyName: "ABC Hardware Trading",
    contact: "Kelvin",
    dealerType: "Dealer",
    priceLevel: "dealer",
    paymentTerm: "30 days",
    phone: "+65 8888 0001"
  },
  {
    companyName: "Home Reno Studio",
    contact: "May",
    dealerType: "Retail",
    priceLevel: "retail",
    paymentTerm: "COD",
    phone: "+65 8888 0002"
  }
];

export const landedCostPreview = calculateLandedCost({
  allocationMethod: "BY_PRODUCT_VALUE",
  finalExchangeRate: 0.185,
  shippingCost: 850,
  taxAmount: 240,
  otherCost: 120,
  paymentFee: 45,
  items: [
    { productId: "1", productCode: "TB-9001", productName: "One Piece Toilet Bowl", quantity: 20, unitCost: 560 },
    { productId: "2", productCode: "SH-230", productName: "Rain Shower Set", quantity: 30, unitCost: 260 }
  ]
});

export const invoicePreviewItems = [
  calculateInvoiceItem({
    productId: "1",
    description: "One Piece Toilet Bowl",
    quantity: 2,
    unitPrice: 260,
    costPriceSnapshot: 148.25,
    gstStatus: true
  }),
  calculateInvoiceItem({
    productId: "2",
    description: "Rain Shower Set",
    quantity: 1,
    unitPrice: 138,
    costPriceSnapshot: 72.6,
    gstStatus: true
  })
];

export const invoicePreviewSummary = summarizeInvoice(invoicePreviewItems);

export const stockMovements = [
  {
    date: "2026-06-04",
    type: "STOCK_IN",
    product: "TB-9001",
    warehouse: "Main Warehouse",
    qty: 20,
    related: "PO0505202601"
  },
  {
    date: "2026-06-04",
    type: "STOCK_OUT",
    product: "SH-230",
    warehouse: "Main Warehouse",
    qty: 1,
    related: "DO0505202601"
  }
];
