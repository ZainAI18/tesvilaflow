import type { PDFFont } from "pdf-lib";

/** Wraps text to a measured PDF width, including unbroken SKUs and URLs. */
export function wrapPdfText(
  font: PDFFont,
  size: number,
  value: string,
  maxWidth: number,
  fallback = "",
) {
  const text = String(value ?? "");
  const paragraphs = (text || fallback).split(/\r?\n/);
  const lines: string[] = [];

  const pushToken = (token: string, prefix = "") => {
    let current = prefix;
    for (const character of token) {
      const candidate = current + character;
      if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(current);
        current = character;
      } else {
        current = candidate;
      }
    }
    return current;
  };

  paragraphs.forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      return;
    }

    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        return;
      }
      if (line) lines.push(line);
      line = font.widthOfTextAtSize(word, size) <= maxWidth
        ? word
        : pushToken(word);
    });
    if (line) lines.push(line);
  });

  return lines.length ? lines : [fallback];
}

/** Reduces only the affected value until it fits a single measured cell. */
export function fitPdfTextSize(
  font: PDFFont,
  value: string,
  maxWidth: number,
  preferredSize: number,
  minimumSize = 7,
) {
  let size = preferredSize;
  while (size > minimumSize && font.widthOfTextAtSize(value, size) > maxWidth) {
    size = Math.max(minimumSize, size - 0.25);
  }
  return size;
}

export function rightAlignedPdfX(
  font: PDFFont,
  value: string,
  size: number,
  left: number,
  width: number,
  padding = 5,
) {
  return Math.max(left + padding, left + width - padding - font.widthOfTextAtSize(value, size));
}
