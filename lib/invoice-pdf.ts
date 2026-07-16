import {
  PDFDocument,
  PDFImage,
  PDFPage,
  PDFFont,
  StandardFonts,
  rgb,
} from "pdf-lib";
import type { InvoiceReportData, InvoiceReportItem } from "./invoice-report";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 34;
const CONTENT_WIDTH = A4_WIDTH - MARGIN * 2;
const BLUE = rgb(0.02, 0.23, 0.49);
const BLACK = rgb(0.05, 0.05, 0.05);
const RED = rgb(0.58, 0.08, 0.1);
const GRAY = rgb(0.35, 0.35, 0.35);
const LIGHT_BLUE = rgb(0.94, 0.97, 1);
const WHITE = rgb(1, 1, 1);

type Kit = {
  doc: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  logo: PDFImage;
  pages: PDFPage[];
};

const money = (value: number) =>
  `S$ ${Number.isFinite(value) ? value.toFixed(2) : "0.00"}`.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ",",
  );

function wrap(font: PDFFont, size: number, value: string, width: number) {
  const paragraphs = (value || "").split(/\r?\n/);
  const lines: string[] = [];
  paragraphs.forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      return;
    }
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
        return;
      }
      if (line) lines.push(line);
      if (font.widthOfTextAtSize(word, size) <= width) {
        line = word;
        return;
      }
      let fragment = "";
      for (const character of word) {
        if (font.widthOfTextAtSize(fragment + character, size) > width) {
          if (fragment) lines.push(fragment);
          fragment = character;
        } else fragment += character;
      }
      line = fragment;
    });
    if (line) lines.push(line);
  });
  return lines;
}

function drawTextLines(
  page: PDFPage,
  font: PDFFont,
  lines: string[],
  x: number,
  y: number,
  size: number,
  lineHeight: number,
  color = BLACK,
) {
  lines.forEach((line, index) =>
    page.drawText(line, {
      x,
      y: y - index * lineHeight,
      size,
      font,
      color,
    }),
  );
}

function drawImageFit(
  page: PDFPage,
  image: PDFImage,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scaled = image.scaleToFit(width, height);
  page.drawImage(image, {
    x: x + (width - scaled.width) / 2,
    y: y + (height - scaled.height) / 2,
    width: scaled.width,
    height: scaled.height,
  });
}

function addPage(kit: Kit) {
  const page = kit.doc.addPage([A4_WIDTH, A4_HEIGHT]);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: A4_WIDTH,
    height: A4_HEIGHT,
    color: WHITE,
  });
  kit.pages.push(page);
  return page;
}

function drawMainHeader(kit: Kit, page: PDFPage, data: InvoiceReportData) {
  const { bold, regular } = kit;
  page.drawText(data.company.name, {
    x: MARGIN,
    y: 806,
    size: 13,
    font: bold,
    color: BLUE,
  });
  drawTextLines(
    page,
    regular,
    [
      data.company.addressLine1,
      data.company.addressLine2,
      `TEL: ${data.company.telephone}`,
      `EMAIL: ${data.company.email}`,
      `Co./GST Reg.No. ${data.company.registrationNumber}`,
    ],
    MARGIN,
    791,
    6.8,
    9,
    BLACK,
  );
  page.drawText(data.title, {
    x: 446,
    y: 792,
    size: 26,
    font: bold,
    color: BLUE,
  });
  page.drawLine({
    start: { x: MARGIN, y: 738 },
    end: { x: A4_WIDTH - MARGIN, y: 738 },
    thickness: 1.2,
    color: BLUE,
  });

  const infoX = MARGIN;
  const infoWidth = 252;
  const labelWidth = 82;
  const deliveryLines = data.deliveryOrders.length
    ? data.deliveryOrders.map((order) => `${order.number} - ${order.date}`)
    : ["-"];
  const rows = [
    ["Invoice No.", [data.invoiceNumber]],
    ["PO No.", [data.poNumber]],
    ["DO No.", wrap(regular, 7, data.doNumbers, infoWidth - labelWidth - 10)],
    ["Issued Date", [data.issuedDate]],
    ["Delivery Date", deliveryLines],
  ] as const;
  let infoCursor = 726;
  rows.forEach(([label, values]) => {
    const rowHeight = Math.max(16, values.length * 8 + 6);
    page.drawRectangle({
      x: infoX,
      y: infoCursor - rowHeight,
      width: infoWidth,
      height: rowHeight,
      borderColor: BLACK,
      borderWidth: 0.55,
    });
    page.drawLine({
      start: { x: infoX + labelWidth, y: infoCursor },
      end: { x: infoX + labelWidth, y: infoCursor - rowHeight },
      thickness: 0.55,
      color: BLACK,
    });
    page.drawText(label, {
      x: infoX + 5,
      y: infoCursor - 11,
      size: 6.7,
      font: bold,
      color: BLACK,
    });
    drawTextLines(
      page,
      label === "Invoice No." ? bold : regular,
      [...values],
      infoX + labelWidth + 5,
      infoCursor - 11,
      7,
      8,
      BLACK,
    );
    infoCursor -= rowHeight;
  });

  drawImageFit(page, kit.logo, 348, 632, 190, 88);

  const customerTop = infoCursor - 24;
  page.drawText("Invoice To:", {
    x: MARGIN + 7,
    y: customerTop,
    size: 8,
    font: bold,
    color: BLUE,
  });
  const customerLines = [
    ...wrap(bold, 9, data.customer.companyName, 260),
    ...wrap(regular, 7.2, data.customer.address, 260),
    `Contact Name: ${data.customer.contactName}`,
    `Contact Number: ${data.customer.contactNumber}`,
  ];
  customerLines.forEach((line, index) =>
    page.drawText(line, {
      x: MARGIN + 7,
      y: customerTop - 16 - index * 10,
      size: index === 0 ? 9 : 7.2,
      font: index === 0 ? bold : regular,
      color: BLACK,
    }),
  );

  const customerBottom = customerTop - 16 - customerLines.length * 10;
  const titleY = Math.min(562, customerBottom - 16);
  page.drawText(data.sectionTitle, {
    x: 235,
    y: titleY,
    size: 9,
    font: bold,
    color: BLUE,
  });
  return titleY - 14;
}


function drawContinuationHeader(kit: Kit, page: PDFPage, data: InvoiceReportData) {
  page.drawText(data.company.name, {
    x: MARGIN,
    y: 808,
    size: 11,
    font: kit.bold,
    color: BLUE,
  });
  page.drawText("Invoice Continued", {
    x: 424,
    y: 808,
    size: 12,
    font: kit.bold,
    color: BLUE,
  });
  page.drawText(`Invoice No.: ${data.invoiceNumber}`, {
    x: MARGIN,
    y: 791,
    size: 7.5,
    font: kit.bold,
    color: BLACK,
  });
  page.drawText(`Customer: ${data.customer.companyName}`, {
    x: 250,
    y: 791,
    size: 7.5,
    font: kit.regular,
    color: BLACK,
  });
  page.drawLine({
    start: { x: MARGIN, y: 780 },
    end: { x: A4_WIDTH - MARGIN, y: 780 },
    thickness: 1.1,
    color: BLUE,
  });
  return 766;
}

const columns = {
  number: { x: MARGIN, width: 28 },
  description: { x: MARGIN + 28, width: 309 },
  quantity: { x: MARGIN + 337, width: 50 },
  unitPrice: { x: MARGIN + 387, width: 69 },
  amount: { x: MARGIN + 456, width: CONTENT_WIDTH - 456 },
};

function drawTableHeader(kit: Kit, page: PDFPage, topY: number) {
  const height = 20;
  page.drawRectangle({
    x: MARGIN,
    y: topY - height,
    width: CONTENT_WIDTH,
    height,
    color: BLUE,
    borderColor: BLACK,
    borderWidth: 0.65,
  });
  const headers = [
    ["No.", columns.number],
    ["SKU / Item Description", columns.description],
    ["Quantity", columns.quantity],
    ["Unit Price", columns.unitPrice],
    ["Amount", columns.amount],
  ] as const;
  headers.forEach(([label, column], index) => {
    if (index) {
      page.drawLine({
        start: { x: column.x, y: topY },
        end: { x: column.x, y: topY - height },
        thickness: 0.55,
        color: WHITE,
      });
    }
    page.drawText(label, {
      x: column.x + 4,
      y: topY - 13,
      size: 6.6,
      font: kit.bold,
      color: WHITE,
    });
  });
  return topY - height;
}

function itemDescriptionLines(kit: Kit, item: InvoiceReportItem) {
  return [
    ...wrap(kit.bold, 6.4, item.sku, columns.description.width - 10),
    ...wrap(kit.regular, 6.1, item.model, columns.description.width - 10),
    ...wrap(kit.regular, 6.1, item.type, columns.description.width - 10),
    ...wrap(kit.regular, 6.1, item.description, columns.description.width - 10),
  ].filter((line, index, lines) => line || index === 0 || lines.length === 1);
}

function itemRowHeight(kit: Kit, item?: InvoiceReportItem) {
  if (!item) return 23;
  return Math.max(25, itemDescriptionLines(kit, item).length * 6.5 + 6);
}

function drawItemRow(
  kit: Kit,
  page: PDFPage,
  topY: number,
  item?: InvoiceReportItem,
) {
  const height = itemRowHeight(kit, item);
  page.drawRectangle({
    x: MARGIN,
    y: topY - height,
    width: CONTENT_WIDTH,
    height,
    borderColor: BLACK,
    borderWidth: 0.55,
  });
  [columns.description.x, columns.quantity.x, columns.unitPrice.x, columns.amount.x].forEach((x) =>
    page.drawLine({
      start: { x, y: topY },
      end: { x, y: topY - height },
      thickness: 0.45,
      color: BLACK,
    }),
  );
  if (!item) return topY - height;
  page.drawText(String(item.number), {
    x: columns.number.x + 10,
    y: topY - 14,
    size: 7,
    font: kit.regular,
    color: BLACK,
  });
  const descriptionLines = itemDescriptionLines(kit, item);
  descriptionLines.forEach((line, index) =>
    page.drawText(line, {
      x: columns.description.x + 5,
      y: topY - 9 - index * 6.5,
      size: index === 0 ? 6.4 : 6.1,
      font: index === 0 ? kit.bold : kit.regular,
      color: BLACK,
    }),
  );
  page.drawText(String(item.quantity), {
    x: columns.quantity.x + 19,
    y: topY - 14,
    size: 7,
    font: kit.regular,
    color: BLACK,
  });
  page.drawText(money(item.unitPrice), {
    x: columns.unitPrice.x + 5,
    y: topY - 14,
    size: 6.5,
    font: kit.regular,
    color: BLACK,
  });
  page.drawText(money(item.amount), {
    x: columns.amount.x + 5,
    y: topY - 14,
    size: 6.5,
    font: kit.bold,
    color: BLACK,
  });
  return topY - height;
}

function drawFooter(kit: Kit, page: PDFPage, data: InvoiceReportData, topY: number) {
  const { bold, regular } = kit;
  let cursor = topY - 10;
  page.drawText("NOTICE", { x: MARGIN, y: cursor, size: 6.8, font: bold, color: RED });
  cursor -= 10;
  const noticeLines = wrap(regular, 6.2, data.notice, CONTENT_WIDTH);
  drawTextLines(page, regular, noticeLines, MARGIN, cursor, 6.2, 7.2, RED);
  cursor -= noticeLines.length * 7.2 + 6;

  page.drawText("Remarks:", { x: MARGIN, y: cursor, size: 6.8, font: bold, color: BLACK });
  const remarkLines = wrap(regular, 6.4, data.remarks, 310).slice(0, 4);
  if (remarkLines.length) drawTextLines(page, regular, remarkLines, MARGIN + 48, cursor, 6.4, 7.3, BLACK);
  cursor -= Math.max(16, remarkLines.length * 7.3 + 5);

  const boxTop = cursor;
  const boxHeight = 72;
  page.drawRectangle({
    x: MARGIN,
    y: boxTop - boxHeight,
    width: 300,
    height: boxHeight,
    borderColor: BLACK,
    borderWidth: 0.6,
    color: LIGHT_BLUE,
  });
  page.drawText("ITEM COLLECT METHOD", { x: MARGIN + 8, y: boxTop - 14, size: 6, font: bold, color: BLUE });
  page.drawText(data.itemCollectMethod, { x: MARGIN + 8, y: boxTop - 29, size: 8, font: bold, color: BLACK });
  page.drawLine({ start: { x: MARGIN + 8, y: boxTop - 36 }, end: { x: MARGIN + 139, y: boxTop - 36 }, thickness: 0.5, color: BLACK });
  page.drawText("PAYMENT METHOD", { x: MARGIN + 158, y: boxTop - 14, size: 6, font: bold, color: BLUE });
  page.drawText(data.paymentMethod, { x: MARGIN + 158, y: boxTop - 29, size: 8, font: bold, color: BLACK });
  page.drawLine({ start: { x: MARGIN + 158, y: boxTop - 36 }, end: { x: MARGIN + 290, y: boxTop - 36 }, thickness: 0.5, color: BLACK });

  const totalsX = 350;
  const totalsWidth = A4_WIDTH - MARGIN - totalsX;
  page.drawRectangle({
    x: totalsX,
    y: boxTop - boxHeight,
    width: totalsWidth,
    height: boxHeight,
    borderColor: BLACK,
    borderWidth: 0.7,
  });
  const totals = [
    ["Total", data.totals.subtotal],
    [`GST ${data.totals.gstRate}%`, data.totals.gstAmount],
    ["Grand Total", data.totals.grandTotal],
    ["Deposit", data.totals.deposit],
    ["Balance", data.totals.balance],
  ] as const;
  totals.forEach(([label, value], index) => {
    const y = boxTop - 12 - index * 13;
    page.drawText(label, { x: totalsX + 7, y, size: 6.7, font: index >= 2 ? bold : regular, color: BLACK });
    page.drawText(money(value), { x: totalsX + 95, y, size: 6.7, font: index >= 2 ? bold : regular, color: index === 4 ? BLUE : BLACK });
    if (index < totals.length - 1) page.drawLine({ start: { x: totalsX, y: y - 4 }, end: { x: totalsX + totalsWidth, y: y - 4 }, thickness: 0.3, color: BLACK });
  });
  cursor = boxTop - boxHeight - 9;

  page.drawText("Terms and Conditions:", { x: MARGIN, y: cursor, size: 6.7, font: bold, color: BLUE });
  let termsY = cursor - 9;
  data.terms.forEach((term, index) => {
    const lines = wrap(regular, 5.4, `${index + 1}. ${term}`, 360);
    drawTextLines(page, regular, lines, MARGIN, termsY, 5.4, 6.25, BLACK);
    termsY -= lines.length * 6.25;
  });
  page.drawText(`Issued By: ${data.issuedBy}`, {
    x: 414,
    y: Math.max(52, cursor - 62),
    size: 10,
    font: bold,
    color: BLACK,
  });
}

export async function createInvoicePdf(
  data: InvoiceReportData,
  logoBytes: ArrayBuffer | Uint8Array,
) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(logoBytes);
  const kit: Kit = { doc, regular, bold, logo, pages: [] };

  let page = addPage(kit);
  let y = drawTableHeader(kit, page, drawMainHeader(kit, page, data));
  const rows: Array<InvoiceReportItem | undefined> = [...data.items];
  while (rows.length < 3) rows.push(undefined);

  rows.forEach((item, index) => {
    const forceContinuation = data.items.length > 8 && index === 8;
    const height = itemRowHeight(kit, item);
    const isLast = index === rows.length - 1;
    const finalFooterLimit = 230;
    if (
      forceContinuation ||
      y - height < 42 ||
      (isLast && y - height < finalFooterLimit)
    ) {
      page = addPage(kit);
      y = drawTableHeader(kit, page, drawContinuationHeader(kit, page, data));
    }
    y = drawItemRow(kit, page, y, item);
  });

  if (y < 230) {
    page = addPage(kit);
    y = drawContinuationHeader(kit, page, data) - 8;
  }
  drawFooter(kit, page, data, y);

  kit.pages.forEach((pdfPage, index) => {
    pdfPage.drawText(`Page ${index + 1} of ${kit.pages.length}`, {
      x: 500,
      y: 16,
      size: 6.5,
      font: regular,
      color: GRAY,
    });
  });
  return doc.save();
}
