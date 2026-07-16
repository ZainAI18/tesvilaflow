"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { authFetch } from "@/lib/client-auth";

type Product = {
  id: string;
  sku: string;
  product_model: string;
  product_type: string;
  description: string;
  brand: string;
  cost_price: number;
  selling_price: number;
  opening_stock: number;
  current_stock: number;
  reserved_stock: number;
  minimum_stock: number;
};

type ProductForm = {
  sku: string;
  productModel: string;
  productType: string;
  description: string;
  brand: string;
  costPrice: string;
  sellingPrice: string;
  openingStock: string;
  minimumStock: string;
};

const emptyForm: ProductForm = {
  sku: "",
  productModel: "",
  productType: "",
  description: "",
  brand: "TESVILA",
  costPrice: "0",
  sellingPrice: "0",
  openingStock: "0",
  minimumStock: "0",
};

const money = (value: number) =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(value);

export function ProductManager({
  search,
  setSearch,
  notify,
}: {
  search: string;
  setSearch: (value: string) => void;
  notify: (message: string) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadProducts() {
    setLoading(true);

    try {
      const response = await authFetch("/api/products", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load products");
      }

      setProducts(result.products || []);
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Unable to load products",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Initial API hydration intentionally updates the product manager state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProducts();
    // loadProducts is intentionally used only for initial hydration here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateForm(field: keyof ProductForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveProduct() {
    setSaving(true);

    try {
      const response = await authFetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save product");
      }

      notify(`${form.productModel} saved successfully`);
      setForm(emptyForm);
      setShowForm(false);
      await loadProducts();
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Unable to save product",
      );
    } finally {
      setSaving(false);
    }
  }

  const filteredProducts = products.filter((product) =>
    (
      product.product_model +
      product.sku +
      product.product_type +
      product.brand
    )
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <>
      <div className="page-head row between">
        <div>
          <h2>Products</h2>
          <p>{products.length} products saved in Supabase</p>
        </div>

        <div className="row">
          <button
            className="btn primary"
            onClick={() => setShowForm(true)}
          >
            <Plus size={13} /> Add product
          </button>
        </div>
      </div>

      <div className="card">
        <div className="pad toolbar">
          <input
            className="input"
            placeholder="Search model, SKU, type or brand"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Model / SKU</th>
                <th>Product Type</th>
                <th>Brand</th>
                <th>Description</th>
                <th>Cost</th>
                <th>Selling Price</th>
                <th>Current Stock</th>
                <th>Minimum Stock</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8}>Loading products...</td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <b>{product.product_model}</b>
                      <div className="muted">{product.sku}</div>
                    </td>
                    <td>{product.product_type}</td>
                    <td>{product.brand}</td>
                    <td>{product.description}</td>
                    <td>{money(Number(product.cost_price))}</td>
                    <td>
                      <b>{money(Number(product.selling_price))}</b>
                    </td>
                    <td>
                      <span
                        className={`status ${
                          Number(product.current_stock) <=
                          Number(product.minimum_stock)
                            ? "red"
                            : ""
                        }`}
                      >
                        {Number(product.current_stock)} units
                      </span>
                    </td>
                    <td>{Number(product.minimum_stock)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-head">
              <b>Add product</b>

              <button
                className="icon-btn"
                onClick={() => setShowForm(false)}
              >
                <X size={15} />
              </button>
            </div>

            <div className="modal-body">
              <div className="grid-2">
                <ProductField
                  label="Product model"
                  value={form.productModel}
                  onChange={(value) =>
                    updateForm("productModel", value)
                  }
                />

                <ProductField
                  label="SKU"
                  value={form.sku}
                  onChange={(value) => updateForm("sku", value)}
                />

                <ProductField
                  label="Product type"
                  value={form.productType}
                  onChange={(value) =>
                    updateForm("productType", value)
                  }
                />

                <ProductField
                  label="Brand"
                  value={form.brand}
                  onChange={(value) => updateForm("brand", value)}
                />

                <ProductField
                  label="Description"
                  value={form.description}
                  onChange={(value) =>
                    updateForm("description", value)
                  }
                />

                <ProductField
                  label="Cost price"
                  value={form.costPrice}
                  type="number"
                  onChange={(value) =>
                    updateForm("costPrice", value)
                  }
                />

                <ProductField
                  label="Selling price"
                  value={form.sellingPrice}
                  type="number"
                  onChange={(value) =>
                    updateForm("sellingPrice", value)
                  }
                />

                <ProductField
                  label="Opening stock"
                  value={form.openingStock}
                  type="number"
                  onChange={(value) =>
                    updateForm("openingStock", value)
                  }
                />

                <ProductField
                  label="Minimum stock"
                  value={form.minimumStock}
                  type="number"
                  onChange={(value) =>
                    updateForm("minimumStock", value)
                  }
                />
              </div>

              <div
                className="row"
                style={{
                  justifyContent: "flex-end",
                  marginTop: 20,
                }}
              >
                <button
                  className="btn"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>

                <button
                  className="btn primary"
                  disabled={saving}
                  onClick={saveProduct}
                >
                  {saving ? "Saving..." : "Save product"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ProductField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        className="input"
        type={type}
        min={type === "number" ? "0" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
