/* eslint-disable @typescript-eslint/no-explicit-any */

export type SalesReportFilters = {
  start: string;
  end: string;
  productId?: string;
  customerKey?: string;
};

export type SalesReportDetail = {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerCompany: string;
  customerId: string;
  sku: string;
  productId: string;
  productModel: string;
  productType: string;
  description: string;
  brand: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  salesAmount: number;
  costPerUnit: number;
  totalCost: number;
  grossProfit: number;
  margin: number;
  status: string;
};

const invalidStatuses = new Set([
  "void",
  "cancelled",
  "canceled",
  "draft",
  "deleted",
]);

const numberValue = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const relation = (value: unknown): any =>
  Array.isArray(value) ? value[0] || null : value || null;

function validIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function normaliseSalesReportFilters(
  filters: Partial<SalesReportFilters>,
): SalesReportFilters {
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const fallbackStart = `${currentMonth}-01`;
  const fallbackEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
  const start = validIsoDate(filters.start || "")
    ? filters.start!
    : fallbackStart;
  const end = validIsoDate(filters.end || "") ? filters.end! : fallbackEnd;
  if (start > end) throw new Error("Start date must be on or before end date.");
  return {
    start,
    end,
    productId: filters.productId || "all",
    customerKey: filters.customerKey || "all",
  };
}

export async function loadSalesReport(
  db: any,
  rawFilters: Partial<SalesReportFilters>,
) {
  const filters = normaliseSalesReportFilters(rawFilters);
  const productQuery = db
    .from("products")
    .select(
      "id,sku,product_model,product_type,description,brand,cost_price",
    )
    .is("deleted_at", null)
    .order("sku");
  const optionInvoiceQuery = db
    .from("invoices")
    .select(
      "invoice_date,customer_id,customer_company_name,status,customer:customers(id,company_name)",
    )
    .is("deleted_at", null)
    .order("invoice_date", { ascending: false })
    .limit(5000);

  let invoiceQuery = db
    .from("invoices")
    .select(
      "id,invoice_number,invoice_date,customer_id,customer_company_name,status,customer:customers(id,company_name),items:invoice_items(id,product_id,sku,product_model,product_type,description,brand,quantity,unit_price,unit_cost,discount_amount,product:products(id,cost_price))",
    )
    .is("deleted_at", null)
    .gte("invoice_date", filters.start)
    .lte("invoice_date", filters.end)
    .order("invoice_date");

  if (filters.customerKey?.startsWith("id:")) {
    invoiceQuery = invoiceQuery.eq("customer_id", filters.customerKey.slice(3));
  } else if (filters.customerKey?.startsWith("name:")) {
    invoiceQuery = invoiceQuery.eq(
      "customer_company_name",
      decodeURIComponent(filters.customerKey.slice(5)),
    );
  }

  const [productResult, optionResult, invoiceResult] = await Promise.all([
    productQuery,
    optionInvoiceQuery,
    invoiceQuery,
  ]);
  const error = productResult.error || optionResult.error || invoiceResult.error;
  if (error) throw new Error(error.message);

  const products = (productResult.data || []).map((product: any) => ({
    id: String(product.id),
    sku: product.sku || "",
    product_model: product.product_model || "",
    product_type: product.product_type || "",
    description: product.description || "",
    brand: product.brand || "",
  }));

  const customerMap = new Map<string, { key: string; id: string; company_name: string }>();
  const monthSet = new Set<string>();
  for (const invoice of optionResult.data || []) {
    if (invalidStatuses.has(String(invoice.status || "").toLowerCase())) continue;
    const invoiceDate = String(invoice.invoice_date || "");
    if (/^\d{4}-\d{2}/.test(invoiceDate)) monthSet.add(invoiceDate.slice(0, 7));
    const customer = relation(invoice.customer);
    const id = String(invoice.customer_id || customer?.id || "");
    const company = String(
      invoice.customer_company_name || customer?.company_name || "",
    ).trim();
    if (!company) continue;
    const key = id ? `id:${id}` : `name:${encodeURIComponent(company)}`;
    if (!customerMap.has(key)) customerMap.set(key, { key, id, company_name: company });
  }
  const currentMonth = new Date().toISOString().slice(0, 7);
  monthSet.add(currentMonth);

  const details: SalesReportDetail[] = [];
  for (const invoice of invoiceResult.data || []) {
    if (invalidStatuses.has(String(invoice.status || "").toLowerCase())) continue;
    const customer = relation(invoice.customer);
    const customerId = String(invoice.customer_id || customer?.id || "");
    const customerCompany = String(
      invoice.customer_company_name || customer?.company_name || "",
    );
    for (const item of invoice.items || []) {
      const product = relation(item.product);
      const productId = String(item.product_id || product?.id || "");
      if (filters.productId !== "all" && productId !== filters.productId)
        continue;
      const quantity = numberValue(item.quantity);
      const unitPrice = numberValue(item.unit_price);
      const discount = numberValue(item.discount_amount);
      const salesAmount = quantity * unitPrice - discount;
      const savedCost = item.unit_cost;
      const costPerUnit =
        savedCost === null || savedCost === undefined
          ? numberValue(product?.cost_price)
          : numberValue(savedCost);
      const totalCost = quantity * costPerUnit;
      const grossProfit = salesAmount - totalCost;
      details.push({
        invoiceId: String(invoice.id),
        invoiceNumber: invoice.invoice_number || "",
        invoiceDate: invoice.invoice_date || "",
        customerCompany,
        customerId,
        sku: item.sku || "",
        productId,
        productModel: item.product_model || "",
        productType: item.product_type || "",
        description: item.description || "",
        brand: item.brand || "",
        quantity,
        unitPrice,
        discount,
        salesAmount,
        costPerUnit,
        totalCost,
        grossProfit,
        margin: salesAmount === 0 ? 0 : grossProfit / salesAmount,
        status: invoice.status || "",
      });
    }
  }

  const grouped = new Map<
    string,
    {
      id: string;
      invoice_number: string;
      invoice_date: string;
      customer_company: string;
      items: string[];
      sales: number;
      cost: number;
      gross_profit: number;
      status: string;
    }
  >();
  for (const row of details) {
    const existing = grouped.get(row.invoiceId) || {
      id: row.invoiceId,
      invoice_number: row.invoiceNumber,
      invoice_date: row.invoiceDate,
      customer_company: row.customerCompany,
      items: [],
      sales: 0,
      cost: 0,
      gross_profit: 0,
      status: row.status,
    };
    if (row.sku && !existing.items.includes(row.sku)) existing.items.push(row.sku);
    existing.sales += row.salesAmount;
    existing.cost += row.totalCost;
    existing.gross_profit += row.grossProfit;
    grouped.set(row.invoiceId, existing);
  }

  const summary = details.reduce(
    (total, row) => {
      total.salesAmount += row.salesAmount;
      total.discount += row.discount;
      total.cost += row.totalCost;
      total.grossProfit += row.grossProfit;
      return total;
    },
    {
      invoices: grouped.size,
      salesAmount: 0,
      discount: 0,
      cost: 0,
      grossProfit: 0,
      margin: 0,
    },
  );
  summary.margin =
    summary.salesAmount === 0 ? 0 : summary.grossProfit / summary.salesAmount;

  return {
    filters,
    availableMonths: Array.from(monthSet).sort().reverse(),
    products,
    customers: Array.from(customerMap.values()).sort((a, b) =>
      a.company_name.localeCompare(b.company_name),
    ),
    summary,
    invoices: Array.from(grouped.values()),
    details,
  };
}
