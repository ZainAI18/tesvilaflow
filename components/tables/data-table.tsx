type Column<T> = {
  key: keyof T;
  label: string;
  align?: "left" | "right";
};

export function DataTable<T extends Record<string, string | number | null | undefined>>({
  columns,
  rows
}: {
  columns: Column<T>[];
  rows: T[];
}) {
  return (
    <div className="overflow-hidden rounded border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line p-3">
        <input className="field max-w-xs" placeholder="Search table" />
        <button className="rounded border border-line px-3 py-2 text-sm hover:bg-panel">Export Excel</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead className="bg-panel">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={`border-b border-line px-3 py-2 text-left text-xs font-semibold uppercase text-muted ${
                    column.align === "right" ? "text-right" : ""
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="hover:bg-panel">
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className={`table-cell ${column.align === "right" ? "text-right" : ""}`}
                  >
                    {row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
