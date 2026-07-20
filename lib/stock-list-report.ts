/* eslint-disable @typescript-eslint/no-explicit-any */
import { sortProductsByCodeAfterFirstT } from "@/lib/record-sorting";

const INVALID_DO_STATUSES = new Set([
  "cancelled",
  "canceled",
  "draft",
  "deleted",
  "void",
]);
const EXCLUDED_TYPES = new Set(["delivery", "concrete lining", "concret lining"]);

const numeric = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const cleanType = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

export function validPeriodKey(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function periodLabel(periodKey: string) {
  const [year, month] = periodKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-SG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function periodEnd(periodKey: string) {
  const [year, month] = periodKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function formatDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function longDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function effectiveMovementDate(
  movement: any,
  deliveryOrderByNumber: Map<string, any>,
) {
  if (String(movement.reference_type || "").startsWith("delivery_order")) {
    const order = deliveryOrderByNumber.get(String(movement.reference_number || ""));
    if (order?.delivery_date) return String(order.delivery_date).slice(0, 10);
  }
  return String(movement.created_at || "").slice(0, 10);
}

export type StockListProduct = {
  id: string;
  sku: string;
  product_model: string;
  product_type: string;
  description: string;
  brand: string;
  parent_product_id: string | null;
  linked_stock_product_id: string | null;
  stock_owner_id: string;
  stock_owner_sku: string;
  stock_owner_model: string;
  effective_opening_stock: number;
  effective_current_stock: number;
  effective_reserved_stock: number;
  effective_minimum_stock: number;
};

export type StockListReport = {
  periodKey: string;
  periodLabel: string;
  isCurrentMonth: boolean;
  availableMonths: string[];
  asOfLabel: string;
  latestDo: { number: string; date: string; displayDate: string } | null;
  dateUpdated: string;
  products: StockListProduct[];
  reportProducts: Array<{
    id: string;
    productCode: string;
    productModel: string;
    productType: string;
    description: string;
    currentStock: number;
  }>;
  movements: any[];
};

export async function loadStockListReport(
  db: any,
  requestedPeriod?: string,
): Promise<StockListReport> {
  const [productResult, movementResult, deliveryOrderResult] = await Promise.all([
    db
      .from("products")
      .select(
        "id,sku,product_model,product_type,description,brand,opening_stock,current_stock,reserved_stock,minimum_stock,parent_product_id,linked_stock_product_id,updated_at",
      )
      .is("deleted_at", null)
      .limit(5000),
    db
      .from("stock_movements")
      .select(
        "id,product_id,source_product_id,stock_product_id,source_sku,stock_sku,movement_type,quantity,quantity_before,quantity_after,balance_after,reference_type,reference_number,remarks,active,created_at,source_product:products!stock_movements_source_product_id_fkey(sku,product_model),stock_product:products!stock_movements_stock_product_id_fkey(sku,product_model),processed_by:users(full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(5000),
    db
      .from("delivery_orders")
      .select("id,do_number,delivery_date,status,created_at,deleted_at")
      .is("deleted_at", null)
      .order("delivery_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);
  const error = productResult.error || movementResult.error || deliveryOrderResult.error;
  if (error) throw new Error(error.message);

  const rawProducts = productResult.data || [];
  const rawMovements = movementResult.data || [];
  const validDeliveryOrders = (deliveryOrderResult.data || []).filter(
    (order: any) =>
      !INVALID_DO_STATUSES.has(String(order.status || "").trim().toLowerCase()),
  );
  const deliveryOrderByNumber = new Map<string, any>(
    validDeliveryOrders.map((order: any): [string, any] => [
      String(order.do_number || ""),
      order,
    ]),
  );

  const available = new Set<string>();
  for (const order of validDeliveryOrders) {
    const value = String(order.delivery_date || "").slice(0, 7);
    if (validPeriodKey(value)) available.add(value);
  }
  for (const movement of rawMovements) {
    if (movement.active === false) continue;
    const value = effectiveMovementDate(movement, deliveryOrderByNumber).slice(0, 7);
    if (validPeriodKey(value)) available.add(value);
  }
  const currentMonth = new Date().toISOString().slice(0, 7);
  if (rawProducts.length) available.add(currentMonth);
  const availableMonths = Array.from(available).sort().reverse();
  if (!availableMonths.length) {
    throw new Error("No inventory data is available for export.");
  }

  const periodKey =
    requestedPeriod && validPeriodKey(requestedPeriod) && available.has(requestedPeriod)
      ? requestedPeriod
      : availableMonths[0];
  const isCurrentMonth = periodKey === currentMonth;
  const end = periodEnd(periodKey);
  const start = `${periodKey}-01`;

  const activeMovements = rawMovements
    .filter((movement: any) => movement.active !== false)
    .map((movement: any) => ({
      ...movement,
      effective_date: effectiveMovementDate(movement, deliveryOrderByNumber),
    }));
  const movementNetAfter = new Map<string, number>();
  const movementNetInPeriod = new Map<string, number>();
  for (const movement of activeMovements) {
    const ownerId = String(movement.stock_product_id || movement.product_id || "");
    if (!ownerId) continue;
    const amount = numeric(movement.quantity);
    if (movement.effective_date > end) {
      movementNetAfter.set(ownerId, (movementNetAfter.get(ownerId) || 0) + amount);
    } else if (movement.effective_date >= start) {
      movementNetInPeriod.set(
        ownerId,
        (movementNetInPeriod.get(ownerId) || 0) + amount,
      );
    }
  }

  const byId = new Map<string, any>(
    rawProducts.map((product: any): [string, any] => [String(product.id), product]),
  );
  const products: StockListProduct[] = rawProducts.map((product: any) => {
    const owner = product.linked_stock_product_id
      ? byId.get(String(product.linked_stock_product_id))
      : product;
    const ownerId = String(owner?.id || product.id);
    const liveStock = numeric(owner?.current_stock ?? product.current_stock);
    const closingStock = isCurrentMonth
      ? liveStock
      : liveStock - (movementNetAfter.get(ownerId) || 0);
    const periodOpening = closingStock - (movementNetInPeriod.get(ownerId) || 0);
    return {
      id: String(product.id),
      sku: String(product.sku || ""),
      product_model: String(product.product_model || ""),
      product_type: String(product.product_type || ""),
      description: String(product.description || ""),
      brand: String(product.brand || ""),
      parent_product_id: product.parent_product_id || null,
      linked_stock_product_id: product.linked_stock_product_id || null,
      stock_owner_id: ownerId,
      stock_owner_sku: String(owner?.sku || product.sku || ""),
      stock_owner_model: String(owner?.product_model || product.product_model || ""),
      effective_opening_stock: periodOpening,
      effective_current_stock: closingStock,
      effective_reserved_stock: numeric(owner?.reserved_stock ?? product.reserved_stock),
      effective_minimum_stock: numeric(owner?.minimum_stock ?? product.minimum_stock),
    } satisfies StockListProduct;
  });

  const parentIds = new Set(
    rawProducts
      .map((product: any) => product.parent_product_id)
      .filter(Boolean)
      .map(String),
  );
  const reportProducts = sortProductsByCodeAfterFirstT(
    products
      .filter((product) => !product.linked_stock_product_id)
      .filter((product) => !parentIds.has(product.id))
      .filter((product) => !EXCLUDED_TYPES.has(cleanType(product.product_type)))
      .map((product) => ({
        id: product.id,
        sku: product.sku,
        product_model: product.product_model,
        productCode: product.sku,
        productModel: product.product_model,
        productType: product.product_type || "Uncategorised",
        description: product.description,
        currentStock: numeric(product.effective_current_stock),
      })),
  );

  const latestDo = validDeliveryOrders.find(
    (order: any) => String(order.delivery_date || "").slice(0, 7) === periodKey,
  );
  const inventoryDates = activeMovements
    .map((movement: any) => movement.effective_date)
    .filter((date: string) => date >= start && date <= end);
  if (isCurrentMonth) {
    inventoryDates.push(
      ...rawProducts
        .map((product: any) => String(product.updated_at || "").slice(0, 10))
        .filter((date: string) => date >= start && date <= end),
    );
  }
  const inventoryUpdatedDate = inventoryDates.sort().reverse()[0] || "";
  return {
    periodKey,
    periodLabel: periodLabel(periodKey),
    isCurrentMonth,
    availableMonths,
    asOfLabel: isCurrentMonth
      ? `Current Stock — ${periodLabel(periodKey)}`
      : `Stock as of ${longDate(end)}`,
    latestDo: latestDo
      ? {
          number: String(latestDo.do_number || "-"),
          date: String(latestDo.delivery_date || ""),
          displayDate: formatDate(latestDo.delivery_date),
        }
      : null,
    dateUpdated: latestDo
      ? formatDate(latestDo.delivery_date)
      : isCurrentMonth
        ? formatDate(inventoryUpdatedDate)
        : "-",
    products: sortProductsByCodeAfterFirstT(products),
    reportProducts,
    movements: activeMovements.filter(
      (movement: any) => movement.effective_date >= start && movement.effective_date <= end,
    ),
  };
}
