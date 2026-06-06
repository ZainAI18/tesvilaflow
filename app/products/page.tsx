"use client";

import { FormEvent, useMemo, useState } from "react";
import { Download, Edit, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

type ProductRecord = {
  productCode: string;
  productCategory: string;
  description: string;
  brand: string;
  supplier: string;
  logistics: string;
  cost: number;
  dealerPrice: number;
  onlinePrice: number;
  stockAlert: number;
};

const emptyProduct: ProductRecord = {
  productCode: "",
  productCategory: "",
  description: "",
  brand: "",
  supplier: "",
  logistics: "",
  cost: 0,
  dealerPrice: 0,
  onlinePrice: 0,
  stockAlert: 0
};

const demoProducts: ProductRecord[] = [
  {
    productCode: "TB-9001",
    productCategory: "Toilet Bowl",
    description: "One Piece Toilet Bowl",
    brand: "Tesvila",
    supplier: "Guangzhou Sanitary Supply",
    logistics: "Sea Freight",
    cost: 148.25,
    dealerPrice: 260,
    onlinePrice: 338,
    stockAlert: 8
  },
  {
    productCode: "SH-230",
    productCategory: "Shower Set",
    description: "Rain Shower Set",
    brand: "AquaPro",
    supplier: "Foshan Bath Co",
    logistics: "Consolidated Shipment",
    cost: 72.6,
    dealerPrice: 138,
    onlinePrice: 188,
    stockAlert: 10
  },
  {
    productCode: "FT-80",
    productCategory: "Floor Trap",
    description: "Stainless Floor Trap",
    brand: "Tesvila",
    supplier: "Taobao",
    logistics: "Air Courier",
    cost: 9.8,
    dealerPrice: 18,
    onlinePrice: 28,
    stockAlert: 20
  }
];

const searchFields: (keyof ProductRecord)[] = [
  "productCode",
  "productCategory",
  "description",
  "brand",
  "supplier",
  "logistics"
];

const textFields: { key: keyof ProductRecord; label: string }[] = [
  { key: "productCode", label: "Product Code" },
  { key: "productCategory", label: "Product Category" },
  { key: "description", label: "Description" },
  { key: "brand", label: "Brand" },
  { key: "supplier", label: "Supplier" },
  { key: "logistics", label: "Logistics" }
];

const numericFields: { key: keyof ProductRecord; label: string }[] = [
  { key: "cost", label: "Cost" },
  { key: "dealerPrice", label: "Dealer Price" },
  { key: "onlinePrice", label: "Online Price" },
  { key: "stockAlert", label: "Stock Alert" }
];

function formatNumber(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductRecord[]>(demoProducts);
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form, setForm] = useState<ProductRecord>(emptyProduct);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return products;
    }

    return products.filter((product) =>
      searchFields.some((field) => String(product[field]).toLowerCase().includes(query))
    );
  }, [products, search]);

  const openAddForm = () => {
    setEditingIndex(null);
    setForm(emptyProduct);
    setIsFormOpen(true);
  };

  const openEditForm = (product: ProductRecord, index: number) => {
    setEditingIndex(index);
    setForm(product);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingIndex(null);
    setForm(emptyProduct);
  };

  const updateField = (key: keyof ProductRecord, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: numericFields.some((field) => field.key === key) ? Number(value) : value
    }));
  };

  const saveForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (editingIndex === null) {
      setProducts((current) => [form, ...current]);
    } else {
      setProducts((current) => current.map((product, index) => (index === editingIndex ? form : product)));
    }

    closeForm();
  };

  const deleteProduct = (indexToDelete: number) => {
    setProducts((current) => current.filter((_, index) => index !== indexToDelete));
  };

  const refreshDemoData = () => {
    setProducts(demoProducts);
    setSearch("");
  };

  return (
    <div>
      <PageHeader
        title="Products"
      description="Manage product master details, supplier information, logistics, pricing and stock alert levels."
        action={
          <button
            className="inline-flex items-center gap-2 rounded bg-brand px-4 py-2 text-sm font-medium text-white"
            onClick={openAddForm}
            type="button"
          >
            <Plus className="h-4 w-4" />
            Add Record
          </button>
        }
      />

                       "Actions"
                ].map((heading) => (
                  <th
                    className={`border-b border-line px-3 py-2 text-left text-xs font-semibold uppercase text-muted ${
                      ["Cost", "Dealer Price", "Online Price", "Stock Alert"].includes(heading) ? "text-right" : ""
                    }`}
                    key={heading}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((product, visibleIndex) => {
                const productIndex = products.findIndex((item) => item.productCode === product.productCode);

                return (
                  <tr className="hover:bg-panel" key={`${product.productCode}-${visibleIndex}`}>
                    <td className="table-cell whitespace-nowrap font-medium">{product.productCode}</td>
                    <td className="table-cell">{product.productCategory}</td>
                    <td className="table-cell min-w-[220px]">{product.description}</td>
                    <td className="table-cell whitespace-nowrap">{product.brand}</td>
                    <td className="table-cell min-w-[180px]">{product.supplier}</td>
                    <td className="table-cell min-w-[160px]">{product.logistics}</td>
                    <td className="table-cell text-right">{formatNumber(product.cost)}</td>
                    <td className="table-cell text-right">{formatNumber(product.dealerPrice)}</td>
                    <td className="table-cell text-right">{formatNumber(product.onlinePrice)}</td>
                    <td className="table-cell text-right">{formatNumber(product.stockAlert)}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <button
                          className="inline-flex items-center gap-1 rounded border border-line px-2 py-1 text-xs hover:bg-white"
                          onClick={() => openEditForm(product, productIndex)}
                          type="button"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          className="inline-flex items-center gap-1 rounded border border-line px-2 py-1 text-xs text-red-600 hover:bg-white"
                          onClick={() => deleteProduct(productIndex)}
                          type="button"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleProducts.length === 0 && (
                <tr>
                  <td className="px-3 py-8 text-center text-sm text-muted" colSpan={11}>
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <form className="w-full max-w-4xl rounded border border-line bg-white shadow-lg" onSubmit={saveForm}>
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">{editingIndex === null ? "Add Record" : "Edit Record"}</h2>
                <p className="text-sm text-muted">Static demo product details only.</p>
              </div>
              <button className="rounded border border-line p-2 hover:bg-panel" onClick={closeForm} type="button">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid max-h-[70vh] gap-4 overflow-y-auto p-5 md:grid-cols-2">
              {textFields.map((field) => (
                <label className="text-sm font-medium" key={field.key}>
                  {field.label}
                  <input
                    className="field mt-1"
                    onChange={(event) => updateField(field.key, event.target.value)}
                    required={field.key === "productCode"}
                    value={String(form[field.key])}
                  />
                </label>
              ))}
              {numericFields.map((field) => (
                <label className="text-sm font-medium" key={field.key}>
                  {field.label}
                  <input
                    className="field mt-1 text-right"
                    min="0"
                    onChange={(event) => updateField(field.key, event.target.value)}
                    step={field.key === "stockAlert" ? "1" : "0.01"}
                    type="number"
                    value={Number(form[field.key])}
                  />
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
              <button className="rounded border border-line px-4 py-2 text-sm hover:bg-panel" onClick={closeForm} type="button">
                Cancel
              </button>
              <button className="rounded bg-brand px-4 py-2 text-sm font-medium text-white" type="submit">
                Save Record
              </button>
            </div>
          </form>
        </div>
      )} 
    </div>
  );
}
