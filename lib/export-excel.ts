export type ExportColumn<T> = {
  key: keyof T;
  header: string;
};

export function toExportRows<T extends Record<string, unknown>>(rows: T[], columns: ExportColumn<T>[]) {
  return rows.map((row) =>
    columns.reduce<Record<string, unknown>>((exportRow, column) => {
      exportRow[column.header] = row[column.key];
      return exportRow;
    }, {})
  );
}
