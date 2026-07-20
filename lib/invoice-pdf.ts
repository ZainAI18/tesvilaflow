import {
  PDFDocument,
  PDFImage,
  PDFPage,
  PDFFont,
  StandardFonts,
  rgb,
} from "pdf-lib";
import type { InvoiceReportData, InvoiceReportItem } from "./invoice-report";
import { formatDiscountPercent } from "./invoice-discount";
import {
  fitPdfTextSize,
  rightAlignedPdfX,
  wrapPdfText as wrap,
} from "./pdf-text-layout";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 34;
const CONTENT_WIDTH = A4_WIDTH - MARGIN * 2;
const BLUE = rgb(0.02, 0.23, 0.49);
const BLACK = rgb(0.05, 0.05, 0.05);
const RED = rgb(0.58, 0.08, 0.1);
const LIGHT_BLUE = rgb(0.94, 0.97, 1);
const WHITE = rgb(1, 1, 1);

type Kit = {
  doc: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  logo: PDFImage;
  qr: PDFImage;
  pages: PDFPage[];
};

const money = (value: number) =>
  `S$ ${Number.isFinite(value) ? value.toFixed(2) : "0.00"}`.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ",",
  );

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
    size: 14.5,
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
    8.1,
    10,
    BLACK,
  );
  page.drawText(data.title, {
    x: 438,
    y: 790,
    size: 28,
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
  const valueWidth = infoWidth - labelWidth - 10;
  const rows = [
    ["Invoice No.", wrap(bold, 8.2, data.invoiceNumber, valueWidth)],
    ["PO No.", wrap(regular, 8.2, data.poNumber, valueWidth)],
    ["DO No.", wrap(regular, 8.2, data.doNumbers, infoWidth - labelWidth - 10)],
    ["Issued Date", wrap(regular, 8.2, data.issuedDate, valueWidth)],
    ["Delivery Date", deliveryLines.flatMap((value) => wrap(regular, 8.2, value, valueWidth))],
  ] as const;
  let infoCursor = 726;
  rows.forEach(([label, values]) => {
    const rowHeight = Math.max(19, values.length * 9.5 + 7);
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
      y: infoCursor - 13,
      size: 8,
      font: bold,
      color: BLACK,
    });
    drawTextLines(
      page,
      label === "Invoice No." ? bold : regular,
      [...values],
      infoX + labelWidth + 5,
      infoCursor - 13,
      8.2,
      9.5,
      BLACK,
    );
    infoCursor -= rowHeight;
  });

  drawImageFit(page, kit.logo, 310, 610, 250, 115);

  const customerTop = infoCursor - 24;
  page.drawText("Invoice To:", {
    x: MARGIN + 7,
    y: customerTop,
    size: 9.5,
    font: bold,
    color: BLUE,
  });
  const customerLines = [
    ...wrap(bold, 10.5, data.customer.companyName, 260),
    ...wrap(regular, 8.5, data.customer.address, 260),
    ...wrap(regular, 8.5, `Contact Name: ${data.customer.contactName}`, 260),
    ...wrap(regular, 8.5, `Contact Number: ${data.customer.contactNumber}`, 260),
  ];
  customerLines.forEach((line, index) =>
    page.drawText(line, {
      x: MARGIN + 7,
      y: customerTop - 17 - index * 11,
      size: index === 0 ? 10.5 : 8.5,
      font: index === 0 ? bold : regular,
      color: BLACK,
    }),
  );

  const customerBottom = customerTop - 17 - customerLines.length * 11;
  return Math.min(555, customerBottom - 12);
}


function drawContinuationHeader(kit: Kit, page: PDFPage, data: InvoiceReportData) {
  page.drawText(data.company.name, {
    x: MARGIN,
    y: 808,
    size: 12.5,
    font: kit.bold,
    color: BLUE,
  });
  drawTextLines(page, kit.bold, wrap(kit.bold, 10, `Invoice No.: ${data.invoiceNumber}`, 163), 398, 808, 10, 11, BLUE);
  page.drawText(`Co./GST Reg.No. ${data.company.registrationNumber}`, {
    x: MARGIN,
    y: 791,
    size: 8.5,
    font: kit.regular,
    color: BLACK,
  });
  drawTextLines(page, kit.regular, wrap(kit.regular, 8.5, `Customer: ${data.customer.companyName}`, 311), 250, 791, 8.5, 9.5, BLACK);
  page.drawLine({
    start: { x: MARGIN, y: 780 },
    end: { x: A4_WIDTH - MARGIN, y: 780 },
    thickness: 1.1,
    color: BLUE,
  });
  return 766;
}

function drawSectionTitle(
  kit: Kit,
  page: PDFPage,
  data: InvoiceReportData,
  topY: number,
) {
  const titleLines = wrap(kit.bold, 10.5, data.sectionTitle, CONTENT_WIDTH - 16);
  const height = Math.max(24, titleLines.length * 12 + 10);
  page.drawRectangle({
    x: MARGIN,
    y: topY - height,
    width: CONTENT_WIDTH,
    height,
    borderColor: BLACK,
    borderWidth: 0.65,
  });
  const size = 10.5;
  titleLines.forEach((titleLine, index) => {
    const textWidth = kit.bold.widthOfTextAtSize(titleLine, size);
    page.drawText(titleLine, {
      x: MARGIN + (CONTENT_WIDTH - textWidth) / 2,
      y: topY - 16 - index * 12,
      size,
      font: kit.bold,
      color: BLUE,
    });
  });
  return topY - height;
}

const columns = {
  number: { x: MARGIN, width: 28 },
  description: { x: MARGIN + 28, width: 257 },
  quantity: { x: MARGIN + 285, width: 40 },
  unitPrice: { x: MARGIN + 325, width: 72 },
  discount: { x: MARGIN + 397, width: 54 },
  amount: { x: MARGIN + 451, width: CONTENT_WIDTH - 451 },
};

function drawTableHeader(kit: Kit, page: PDFPage, topY: number) {
  const height = 24;
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
    ["Item Description", columns.description],
    ["Qty", columns.quantity],
    ["Unit Price", columns.unitPrice],
    ["Discount", columns.discount],
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
      y: topY - 16,
      size: 8,
      font: kit.bold,
      color: WHITE,
    });
  });
  return topY - height;
}

function itemDescriptionLines(kit: Kit, item: InvoiceReportItem) {
  const description = [item.brand, item.description].filter(Boolean).join(" ");
  return wrap(kit.regular, 7.6, description, columns.description.width - 10);
}

function itemRowHeight(kit: Kit, item?: InvoiceReportItem) {
  if (!item) return 23;
  return Math.max(22, itemDescriptionLines(kit, item).length * 8.4 + 7);
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
  [columns.description.x, columns.quantity.x, columns.unitPrice.x, columns.discount.x, columns.amount.x].forEach((x) =>
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
    y: topY - 15,
    size: 8.5,
    font: kit.regular,
    color: BLACK,
  });
  const descriptionLines = itemDescriptionLines(kit, item);
  descriptionLines.forEach((line, index) =>
    page.drawText(line, {
      x: columns.description.x + 5,
      y: topY - 12 - index * 8.4,
      size: 7.6,
      font: kit.regular,
      color: BLACK,
    }),
  );
  page.drawText(String(item.quantity), {
    x: columns.quantity.x + 19,
    y: topY - 15,
    size: 8.5,
    font: kit.regular,
    color: BLACK,
  });
  const unitPrice = money(item.unitPrice);
  const unitPriceSize = fitPdfTextSize(kit.regular, unitPrice, columns.unitPrice.width - 10, 8, 7);
  page.drawText(unitPrice, {
    x: rightAlignedPdfX(kit.regular, unitPrice, unitPriceSize, columns.unitPrice.x, columns.unitPrice.width),
    y: topY - 15,
    size: unitPriceSize,
    font: kit.regular,
    color: BLACK,
  });
  const discount = formatDiscountPercent(item.discount);
  const discountSize = fitPdfTextSize(kit.regular, discount, columns.discount.width - 10, 8, 7);
  page.drawText(discount, {
    x: rightAlignedPdfX(kit.regular, discount, discountSize, columns.discount.x, columns.discount.width),
    y: topY - 15,
    size: discountSize,
    font: kit.regular,
    color: BLACK,
  });
  const amount = money(item.amount);
  const amountSize = fitPdfTextSize(kit.bold, amount, columns.amount.width - 10, 8, 7);
  page.drawText(amount, {
    x: rightAlignedPdfX(kit.bold, amount, amountSize, columns.amount.x, columns.amount.width),
    y: topY - 15,
    size: amountSize,
    font: kit.bold,
    color: BLACK,
  });
  return topY - height;
}

const LOWER_FOOTER_TOP = 145;
const SUMMARY_BOX_HEIGHT = 58;

function footerUpperHeight(kit: Kit, data: InvoiceReportData) {
  const noticeLines = wrap(kit.regular, 7.6, data.notice, CONTENT_WIDTH);
  const remarkLines = wrap(kit.regular, 7.7, data.remarks, CONTENT_WIDTH);
  return (
    11 +
    noticeLines.length * 8.8 +
    5 +
    12 +
    Math.max(3, remarkLines.length) * 9 +
    5 +
    SUMMARY_BOX_HEIGHT +
    8
  );
}

function drawFooter(kit: Kit, page: PDFPage, data: InvoiceReportData, topY: number) {
  const { bold, regular } = kit;
  let cursor = topY - 8;
  page.drawText("NOTICE", {
    x: MARGIN,
    y: cursor,
    size: 8.3,
    font: bold,
    color: RED,
  });
  cursor -= 11;
  const noticeLines = wrap(regular, 7.6, data.notice, CONTENT_WIDTH);
  drawTextLines(page, regular, noticeLines, MARGIN, cursor, 7.6, 8.8, RED);
  cursor -= noticeLines.length * 8.8 + 5;

  page.drawText("Remarks:", {
    x: MARGIN,
    y: cursor,
    size: 8.3,
    font: bold,
    color: BLACK,
  });
  cursor -= 12;
  const remarkLines = wrap(regular, 7.7, data.remarks, CONTENT_WIDTH);
  if (remarkLines.length) {
    drawTextLines(page, regular, remarkLines, MARGIN, cursor, 7.7, 9, BLACK);
  }
  cursor -= Math.max(3, remarkLines.length) * 9 + 5;

  const boxTop = cursor;
  const boxHeight = SUMMARY_BOX_HEIGHT;
  page.drawRectangle({
    x: MARGIN,
    y: boxTop - boxHeight,
    width: 300,
    height: boxHeight,
    borderColor: BLACK,
    borderWidth: 0.65,
    color: LIGHT_BLUE,
  });
  page.drawText("ITEM COLLECT METHOD", {
    x: MARGIN + 8,
    y: boxTop - 14,
    size: 7.5,
    font: bold,
    color: BLUE,
  });
  const collectMethodSize = fitPdfTextSize(bold, data.itemCollectMethod, 131, 9.5, 8);
  page.drawText(data.itemCollectMethod, {
    x: MARGIN + 8,
    y: boxTop - 31,
    size: collectMethodSize,
    font: bold,
    color: BLACK,
  });
  page.drawLine({
    start: { x: MARGIN + 8, y: boxTop - 39 },
    end: { x: MARGIN + 139, y: boxTop - 39 },
    thickness: 0.55,
    color: BLACK,
  });
  page.drawText("PAYMENT METHOD", {
    x: MARGIN + 158,
    y: boxTop - 14,
    size: 7.5,
    font: bold,
    color: BLUE,
  });
  const paymentMethodSize = fitPdfTextSize(bold, data.paymentMethod, 132, 9.5, 8);
  page.drawText(data.paymentMethod, {
    x: MARGIN + 158,
    y: boxTop - 31,
    size: paymentMethodSize,
    font: bold,
    color: BLACK,
  });
  page.drawLine({
    start: { x: MARGIN + 158, y: boxTop - 39 },
    end: { x: MARGIN + 290, y: boxTop - 39 },
    thickness: 0.55,
    color: BLACK,
  });

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
    [data.totals.gstLabel, data.totals.gstAmount],
    ["Grand Total", data.totals.grandTotal],
    ["Deposit", data.totals.deposit],
    ["Balance", data.totals.balance],
  ] as const;
  totals.forEach(([label, value], index) => {
    const rowTop = boxTop - index * (boxHeight / totals.length);
    const y = rowTop - 9.5;
    page.drawText(label, {
      x: totalsX + 7,
      y,
      size: 8,
      font: index >= 2 ? bold : regular,
      color: BLACK,
    });
    const formattedValue = money(value);
    const valueSize = fitPdfTextSize(index >= 2 ? bold : regular, formattedValue, totalsWidth - 99, 8, 7);
    page.drawText(formattedValue, {
      x: rightAlignedPdfX(index >= 2 ? bold : regular, formattedValue, valueSize, totalsX + 85, totalsWidth - 85),
      y,
      size: valueSize,
      font: index >= 2 ? bold : regular,
      color: index === 4 ? BLUE : BLACK,
    });
    if (index < totals.length - 1) {
      page.drawLine({
        start: { x: totalsX, y: rowTop - boxHeight / totals.length },
        end: { x: totalsX + totalsWidth, y: rowTop - boxHeight / totals.length },
        thickness: 0.35,
        color: BLACK,
      });
    }
  });

  page.drawText("Terms and Conditions:", {
    x: MARGIN,
    y: LOWER_FOOTER_TOP,
    size: 8.2,
    font: bold,
    color: BLUE,
  });
  let termsY = LOWER_FOOTER_TOP - 10;
  data.terms.forEach((term, index) => {
    const lines = wrap(regular, 6.7, `${index + 1}. ${term}`, 365);
    drawTextLines(page, regular, lines, MARGIN, termsY, 6.7, 7.2, BLACK);
    termsY -= lines.length * 7.2;
  });

  const qrSize = 80;
  drawImageFit(page, kit.qr, 409, 55, qrSize, qrSize);
  page.drawText("PayNow", {
    x: 428,
    y: 44,
    size: 7.5,
    font: bold,
    color: BLUE,
  });
  const issuedByLines = wrap(bold, 11.5, `Issued By: ${data.issuedBy}`, 136);
  drawTextLines(page, bold, issuedByLines, 425, 22 + Math.max(0, issuedByLines.length - 1) * 12, 11.5, 12, BLACK);
}


export async function createInvoicePdf(
  data: InvoiceReportData,
  logoBytes: ArrayBuffer | Uint8Array,
  qrBytes: ArrayBuffer | Uint8Array,
) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(logoBytes);
  const qr = await doc.embedPng(qrBytes);
  const kit: Kit = { doc, regular, bold, logo, qr, pages: [] };

  let page = addPage(kit);
  let y = drawTableHeader(
    kit,
    page,
    drawSectionTitle(kit, page, data, drawMainHeader(kit, page, data)),
  );
  const rows: Array<InvoiceReportItem | undefined> = [...data.items];
  while (rows.length < 3) rows.push(undefined);

  rows.forEach((item, index) => {
    const forceContinuation = data.items.length > 8 && index === 8;
    const height = itemRowHeight(kit, item);
    if (forceContinuation || y - height < 42) {
      page = addPage(kit);
      y = drawTableHeader(
        kit,
        page,
        drawSectionTitle(kit, page, data, drawContinuationHeader(kit, page, data)),
      );
    }
    y = drawItemRow(kit, page, y, item);
  });

  if (y - footerUpperHeight(kit, data) < LOWER_FOOTER_TOP + 5) {
    page = addPage(kit);
    y = drawContinuationHeader(kit, page, data) - 12;
  }
  drawFooter(kit, page, data, y);
  return doc.save();
}
