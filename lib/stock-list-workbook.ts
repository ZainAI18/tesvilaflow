import fs from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import type { StockListReport } from "@/lib/stock-list-report";

const BLUE = "053A7C";
const PALE_BLUE = "EAF1FA";
const BORDER = "64748B";
const LIGHT_BORDER = "CBD5E1";

type ListEntry =
  | { kind: "category"; label: string }
  | { kind: "product"; code: string; stock: number };

function entriesFor(products: StockListReport["reportProducts"]): ListEntry[] {
  const entries: ListEntry[] = [];
  let category = "";
  for (const product of products) {
    const nextCategory = product.productType.trim() || "Uncategorised";
    if (nextCategory !== category) {
      entries.push({ kind: "category", label: nextCategory });
      category = nextCategory;
    }
    entries.push({ kind: "product", code: product.productCode, stock: product.currentStock });
  }
  return entries;
}

function border(color = LIGHT_BORDER): Partial<ExcelJS.Borders> {
  return {
    top: { style: "thin", color: { argb: `FF${color}` } },
    left: { style: "thin", color: { argb: `FF${color}` } },
    bottom: { style: "thin", color: { argb: `FF${color}` } },
    right: { style: "thin", color: { argb: `FF${color}` } },
  };
}

function stockFormat(value: number) {
  return Number.isInteger(value) ? "#,##0" : "#,##0.###";
}

export async function buildStockListWorkbook(report: StockListReport) {
  if (!report.periodKey || !report.reportProducts.every((row) => Number.isFinite(row.currentStock))) {
    throw new Error("Stock List contains invalid report data.");
  }
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TESVILA Operations Suite";
  workbook.created = new Date();
  workbook.modified = new Date();
  const sheet = workbook.addWorksheet("Stock List", {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      verticalCentered: false,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.35,
        bottom: 0.45,
        header: 0.15,
        footer: 0.15,
      },
    },
    properties: { defaultRowHeight: 18 },
  });
  sheet.columns = [
    { key: "leftCode", width: 36 },
    { key: "leftStock", width: 14 },
    { key: "gutter", width: 3 },
    { key: "rightCode", width: 36 },
    { key: "rightStock", width: 14 },
  ];

  sheet.mergeCells("A1:A5");
  sheet.getCell("A1").value =
    "Tesvila Pte Ltd\nBLOCK 4001 ANG MO KIO INDUSTRIAL PARK1\n#01-09 SINGAPORE 569622\nTEL: +65 8189 5198 / +65 9106 1490\nCo.GST/Reg.No.201604567R";
  sheet.getCell("A1").font = { bold: true, size: 9, color: { argb: `FF${BLUE}` } };
  sheet.getCell("A1").alignment = { vertical: "top", horizontal: "left", wrapText: true };
  sheet.mergeCells("D1:E5");
  sheet.getCell("D1").value = "Email: Sales@tesvila.com.sg\nWeb: www.tesvila.com.sg";
  sheet.getCell("D1").font = { bold: true, size: 9, color: { argb: `FF${BLUE}` } };
  sheet.getCell("D1").alignment = { vertical: "top", horizontal: "right", wrapText: true };
  [1, 2, 3, 4, 5].forEach((row) => {
    sheet.getRow(row).height = 17;
  });

  try {
    const logoPath = path.join(process.cwd(), "Logo original remove background.png");
    const logo = await fs.readFile(logoPath);
    const logoId = workbook.addImage({
      base64: `data:image/png;base64,${logo.toString("base64")}`,
      extension: "png",
    });
    sheet.addImage(logoId, {
      tl: { col: 1.15, row: 0.05 },
      ext: { width: 78, height: 78 },
      editAs: "oneCell",
    });
  } catch {
    // A missing logo must never corrupt the workbook; the report remains usable.
  }

  sheet.mergeCells("A7:E7");
  const title = sheet.getCell("A7");
  title.value = "Tesvila Stock List";
  title.font = { bold: true, size: 13, color: { argb: `FF${BLUE}` } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(7).height = 22;

  sheet.getCell("A9").value = "DO Updated:";
  sheet.getCell("B9").value = report.latestDo?.number || "-";
  sheet.getCell("D9").value = "Date Updated:";
  sheet.getCell("E9").value = report.dateUpdated || "-";
  ["A9", "D9"].forEach((address) => {
    sheet.getCell(address).font = { bold: true, color: { argb: `FF${BLUE}` } };
    sheet.getCell(address).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${PALE_BLUE}` } };
  });
  ["A9", "B9", "D9", "E9"].forEach((address) => {
    sheet.getCell(address).border = border(BORDER);
    sheet.getCell(address).alignment = { vertical: "middle", wrapText: true };
  });
  sheet.getRow(9).height = 22;

  const total = report.reportProducts.length;
  const leftCount = Math.ceil(total / 2);
  const leftEntries = entriesFor(report.reportProducts.slice(0, leftCount));
  const rightEntries = entriesFor(report.reportProducts.slice(leftCount));
  const tableHeaderRow = 11;
  sheet.getCell(`A${tableHeaderRow}`).value = "Product Code";
  sheet.getCell(`B${tableHeaderRow}`).value = "Current Stock";
  sheet.getCell(`D${tableHeaderRow}`).value = "Product Code";
  sheet.getCell(`E${tableHeaderRow}`).value = "Current Stock";
  ["A", "B", "D", "E"].forEach((column) => {
    const cell = sheet.getCell(`${column}${tableHeaderRow}`);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BLUE}` } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = border(BORDER);
  });
  sheet.getRow(tableHeaderRow).height = 24;

  const entryRows = Math.max(leftEntries.length, rightEntries.length, 1);
  for (let index = 0; index < entryRows; index += 1) {
    const rowNumber = tableHeaderRow + index + 1;
    const row = sheet.getRow(rowNumber);
    const renderHalf = (entry: ListEntry | undefined, codeColumn: number, stockColumn: number) => {
      const code = row.getCell(codeColumn);
      const stock = row.getCell(stockColumn);
      if (entry?.kind === "category") {
        code.value = entry.label;
        code.font = { bold: true, color: { argb: `FF${BLUE}` } };
        code.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${PALE_BLUE}` } };
        stock.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${PALE_BLUE}` } };
      } else if (entry?.kind === "product") {
        code.value = entry.code;
        stock.value = entry.stock;
        stock.numFmt = stockFormat(entry.stock);
        stock.alignment = { horizontal: "right", vertical: "middle" };
      }
      code.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      code.border = border();
      stock.border = border();
    };
    renderHalf(leftEntries[index], 1, 2);
    renderHalf(rightEntries[index], 4, 5);
    row.height = 20;
  }

  let nextRow = tableHeaderRow + entryRows + 2;
  sheet.mergeCells(`A${nextRow}:E${nextRow}`);
  const notice = sheet.getCell(`A${nextRow}`);
  notice.value =
    "Attn : Dealers * Some models which are not shown in the stock list below are Out Of Stock";
  notice.font = { bold: true, color: { argb: `FF${BLUE}` } };
  notice.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  notice.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${PALE_BLUE}` } };
  notice.border = border(BORDER);
  sheet.getRow(nextRow).height = 30;

  nextRow += 2;
  const terms = [
    "1. Delivery from Monday to Saturday exclude Sunday & Public Holidays",
    "2. Order received before 12pm, will try to arrange the delivery in the afternoon",
    "3. Order received after 12pm & before 5pm, will arrange the delivery the next 1-2 working days.",
  ];
  for (const term of terms) {
    sheet.mergeCells(`A${nextRow}:E${nextRow}`);
    const cell = sheet.getCell(`A${nextRow}`);
    cell.value = term;
    cell.alignment = { horizontal: "left", vertical: "top", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: `FF${LIGHT_BORDER}` } } };
    sheet.getRow(nextRow).height = 26;
    nextRow += 1;
  }
  sheet.mergeCells(`A${nextRow}:E${nextRow}`);
  const note = sheet.getCell(`A${nextRow}`);
  note.value =
    "Note: Products reserved with Purchase Order more than 2 months will consider invalid.";
  note.font = { bold: true };
  note.alignment = { horizontal: "left", vertical: "top", wrapText: true };
  sheet.getRow(nextRow).height = 28;

  sheet.pageSetup.printArea = `A1:E${nextRow}`;
  sheet.pageSetup.printTitlesRow = `${tableHeaderRow}:${tableHeaderRow}`;
  sheet.headerFooter.oddFooter = "&L${report.periodLabel}&RPage &P of &N";
  const buffer = await workbook.xlsx.writeBuffer();
  return {
    buffer,
    filename: `Tesvila_Stock_List_${report.periodKey}.xlsx`,
  };
}
