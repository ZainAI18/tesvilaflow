export type UserRole = "ADMIN" | "STAFF" | "VIEWER";

export type AllocationMethod = "BY_QUANTITY" | "BY_PRODUCT_VALUE";

export type StockDirection = "IN" | "OUT";

export type StockMovementType =
  | "STOCK_IN"
  | "STOCK_OUT"
  | "ADJUSTMENT"
  | "TRANSFER"
  | "RETURN"
  | "DAMAGE";

export type PaymentStatus = "UNPAID" | "PAID";

export type InvoiceStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";

export type DeliveryOrderStatus = "DRAFT" | "CONFIRMED" | "PARTIAL" | "COMPLETED" | "CANCELLED";

export type PurchaseItemInput = {
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitCost: number;
};

export type LandedCostInput = {
  items: PurchaseItemInput[];
  shippingCost: number;
  taxAmount: number;
  otherCost: number;
  paymentFee: number;
  finalExchangeRate: number;
  allocationMethod: AllocationMethod;
};

export type LandedCostItem = PurchaseItemInput & {
  totalCost: number;
  allocatedExtraCost: number;
  actualUnitLandedCost: number;
};

export type WeightedAverageInput = {
  currentStock: number;
  currentAverageCost: number;
  incomingQuantity: number;
  incomingUnitCost: number;
};

export type InvoiceItemInput = {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  costPriceSnapshot: number;
  gstStatus: boolean;
};

export type InvoiceItemCalculation = InvoiceItemInput & {
  amount: number;
  gstAmount: number;
  grossProfit: number;
  marginPercent: number;
  markupPercent: number;
};

export type DashboardMetric = {
  label: string;
  value: string;
  helper: string;
};
