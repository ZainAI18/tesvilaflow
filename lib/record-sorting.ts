type CustomerSortable = {
  customer_code?: string | null;
  company_name?: string | null;
};

type ProductSortable = {
  sku?: string | null;
  product_model?: string | null;
};

const naturalCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

const text = (value: unknown) => String(value ?? "").trim();

function stableSort<T>(records: readonly T[], compare: (left: T, right: T) => number): T[] {
  return records
    .map((record, index) => ({ record, index }))
    .sort((left, right) => compare(left.record, right.record) || left.index - right.index)
    .map(({ record }) => record);
}

export function sortCustomersByCustomerId<T extends CustomerSortable>(records: readonly T[]): T[] {
  return stableSort(records, (left, right) => {
    const leftCode = text(left.customer_code);
    const rightCode = text(right.customer_code);
    if (!leftCode && rightCode) return 1;
    if (leftCode && !rightCode) return -1;
    if (leftCode && rightCode) {
      const codeOrder = naturalCollator.compare(leftCode, rightCode);
      if (codeOrder) return codeOrder;
    }
    return naturalCollator.compare(text(left.company_name), text(right.company_name));
  });
}

function productSortParts(product: ProductSortable) {
  const code = text(product.sku);
  const marker = code.toLowerCase().indexOf("t");
  return {
    code,
    group: !code ? 2 : marker >= 0 ? 0 : 1,
    value: marker >= 0 ? code.slice(marker + 1).trim() : code,
  };
}

export function sortProductsByCodeAfterFirstT<T extends ProductSortable>(records: readonly T[]): T[] {
  return stableSort(records, (left, right) => {
    const leftParts = productSortParts(left);
    const rightParts = productSortParts(right);
    if (leftParts.group !== rightParts.group) return leftParts.group - rightParts.group;
    const valueOrder = naturalCollator.compare(leftParts.value, rightParts.value);
    if (valueOrder) return valueOrder;
    const codeOrder = naturalCollator.compare(leftParts.code, rightParts.code);
    if (codeOrder) return codeOrder;
    return naturalCollator.compare(text(left.product_model), text(right.product_model));
  });
}
