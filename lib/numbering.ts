function pad(value: number, length: number): string {
  return String(value).padStart(length, "0");
}

export function formatDateKey(date: Date): string {
  const day = pad(date.getDate(), 2);
  const month = pad(date.getMonth() + 1, 2);
  const year = date.getFullYear();

  return `${day}${month}${year}`;
}

export function formatInvoiceNumber(sequence: number): string {
  return `TS-${pad(sequence, 4)}`;
}

export function formatDailyDocumentNumber(prefix: "DO" | "PO", date: Date, sequence: number): string {
  return `${prefix}${formatDateKey(date)}${pad(sequence, 2)}`;
}
