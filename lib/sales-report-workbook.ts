import ExcelJS from "exceljs";
import type { SalesReportDetail, SalesReportFilters } from "@/lib/sales-report";

type ReportData = {
  filters: SalesReportFilters;
  summary: {
    invoices: number;
    salesAmount: number;
    discount: number;
    cost: number;
    grossProfit: number;
    margin: number;
  };
  details: SalesReportDetail[];
  products: Array<{ id: string; sku: string; product_model: string; description: string }>;
  customers: Array<{ key: string; company_name: string }>;
};

const BLUE = "053A7C";
const PALE_BLUE = "EAF1FA";
const BORDER = "CBD5E1";
const CURRENCY = '"S$" #,##0.00';

function asDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function selectedMonth(filters: SalesReportFilters) {
  const monthStart = `${filters.start.slice(0, 7)}-01`;
  const [year, month] = filters.start.slice(0, 7).split("-").map(Number);
  const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return filters.start === monthStart && filters.end === monthEnd
    ? filters.start.slice(0, 7)
    : "Custom date range";
}

export async function buildSalesReportWorkbook(data: ReportData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TESVILA Operations Suite";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  const summarySheet = workbook.addWorksheet("Summary", {
    views: [{ showGridLines: false }],
  });
  const detailSheet = workbook.addWorksheet("Sales Details", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
  });

  summarySheet.mergeCells("A1:D1");
  const title = summarySheet.getCell("A1");
  title.value = "TESVILA Monthly Sales Report";
  title.font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BLUE}` } };
  title.alignment = { vertical: "middle", horizontal: "left" };
  summarySheet.getRow(1).height = 30;

  const product = data.products.find((entry) => entry.id === data.filters.productId);
  const customer = data.customers.find((entry) => entry.key === data.filters.customerKey);
  const summaryRows: Array<[string, string | number | Date]> = [
    ["Exported", new Date()],
    ["Selected month", selectedMonth(data.filters)],
    ["Start date", asDate(data.filters.start)],
    ["End date", asDate(data.filters.end)],
    [
      "Selected product",
      product
        ? `${product.sku} — ${product.product_model}${product.description ? ` — ${product.description}` : ""}`
        : "All Products",
    ],
    ["Selected customer", customer?.company_name || "All Customers"],
    ["Invoice count", data.summary.invoices],
    ["Sales Amount", data.summary.salesAmount],
    ["Discount", data.summary.discount],
    ["Cost", data.summary.cost],
    ["Gross Profit", data.summary.grossProfit],
    ["Margin", data.summary.margin],
  ];
  summaryRows.forEach(([label, value], index) => {
    const row = summarySheet.getRow(index + 3);
    row.getCell(1).value = label;
    row.getCell(2).value = value;
    row.getCell(1).font = { bold: true, color: { argb: `FF${BLUE}` } };
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${PALE_BLUE}` } };
    row.getCell(1).border = { bottom: { style: "thin", color: { argb: `FF${BORDER}` } } };
    row.getCell(2).border = { bottom: { style: "thin", color: { argb: `FF${BORDER}` } } };
  });
  summarySheet.getColumn(1).width = 24;
  summarySheet.getColumn(2).width = 58;
  summarySheet.getColumn(2).alignment = { wrapText: true, vertical: "top" };
  summarySheet.getCell("B3").numFmt = "yyyy-mm-dd hh:mm";
  summarySheet.getCell("B5").numFmt = "yyyy-mm-dd";
  summarySheet.getCell("B6").numFmt = "yyyy-mm-dd";
  [10, 11, 12, 13].forEach((row) => {
    summarySheet.getCell(`B${row}`).numFmt = CURRENCY;
  });
  summarySheet.getCell("B14").numFmt = "0.0%";

  detailSheet.columns = [
    { header: "Invoice Number", key: "invoiceNumber", width: 18 },
    { header: "Invoice Date", key: "invoiceDate", width: 14 },
    { header: "Customer Company", key: "customerCompany", width: 28 },
    { header: "Customer ID", key: "customerId", width: 38 },
    { header: "SKU", key: "sku", width: 20 },
    { header: "Product Model", key: "productModel", width: 24 },
    { header: "Product Type", key: "productType", width: 20 },
    { header: "Description", key: "description", width: 48 },
    { header: "Brand", key: "brand", width: 18 },
    { header: "Quantity", key: "quantity", width: 12 },
    { header: "Unit Price", key: "unitPrice", width: 15 },
    { header: "Discount", key: "discount", width: 15 },
    { header: "Sales Amount", key: "salesAmount", width: 17 },
    { header: "Cost Per Unit", key: "costPerUnit", width: 16 },
    { header: "Total Cost", key: "totalCost", width: 16 },
    { header: "Gross Profit", key: "grossProfit", width: 17 },
    { header: "Gross Profit Margin", key: "margin", width: 20 },
    { header: "Invoice Status", key: "status", width: 17 },
  ];
  for (const row of data.details) {
    detailSheet.addRow({ ...row, invoiceDate: asDate(row.invoiceDate) });
  }

  const header = detailSheet.getRow(1);
  header.height = 24;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BLUE}` } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  const lastDataRow = Math.max(1, detailSheet.rowCount);
  detailSheet.autoFilter = { from: "A1", to: `R${lastDataRow}` };
  detailSheet.getColumn("invoiceDate").numFmt = "yyyy-mm-dd";
  detailSheet.getColumn("quantity").numFmt = "#,##0.###";
  ["unitPrice", "discount", "salesAmount", "costPerUnit", "totalCost", "grossProfit"].forEach(
    (key) => {
      detailSheet.getColumn(key).numFmt = CURRENCY;
    },
  );
  detailSheet.getColumn("margin").numFmt = "0.0%";
  detailSheet.getColumn("description").alignment = { wrapText: true, vertical: "top" };
  for (let row = 2; row <= lastDataRow; row += 1) {
    detailSheet.getRow(row).alignment = { vertical: "top" };
    detailSheet.getRow(row).border = {
      bottom: { style: "thin", color: { argb: `FF${BORDER}` } },
    };
  }

  const totalsRowNumber = lastDataRow + 1;
  const totals = detailSheet.getRow(totalsRowNumber);
  const totalValue = (column: string) =>
    data.details.length ? { formula: `SUM(${column}2:${column}${lastDataRow})` } : 0;
  totals.getCell(1).value = "TOTALS";
  totals.getCell(10).value = totalValue("J");
  totals.getCell(12).value = totalValue("L");
  totals.getCell(13).value = totalValue("M");
  totals.getCell(15).value = totalValue("O");
  totals.getCell(16).value = totalValue("P");
  totals.getCell(17).value = data.details.length
    ? {
        formula: `IF(M${totalsRowNumber}=0,0,P${totalsRowNumber}/M${totalsRowNumber})`,
      }
    : 0;
  totals.font = { bold: true, color: { argb: `FF${BLUE}` } };
  totals.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${PALE_BLUE}` } };
  totals.getCell(10).numFmt = "#,##0.###";
  [12, 13, 15, 16].forEach((column) => {
    totals.getCell(column).numFmt = CURRENCY;
  });
  totals.getCell(17).numFmt = "0.0%";

  const isCalendarMonth = selectedMonth(data.filters) !== "Custom date range";
  const filename = isCalendarMonth
    ? `TESVILA_Monthly_Sales_Report_${data.filters.start.slice(0, 7)}.xlsx`
    : `TESVILA_Sales_Report_${data.filters.start}_to_${data.filters.end}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, filename };
}
