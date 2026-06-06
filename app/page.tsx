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
        description="Manage sanitary ware and plumbing product master data, pricing, GST status and stock alerts."
        action={<button className="rounded bg-brand px-4 py-2 text-sm font-medium text-white">Add Product</button>}
      />
      <DataTable
        columns={[
          { key: "productCode", label: "Code" },
          { key: "productName", label: "Name" },
          { key: "brand", label: "Brand" },
          { key: "category", label: "Category" },
          { key: "supplier", label: "Supplier" },
          { key: "stock", label: "Stock", align: "right" },
          { key: "wac", label: "WAC", align: "right" },
          { key: "dealerPrice", label: "Dealer", align: "right" },
          { key: "retailPrice", label: "Retail", align: "right" },
          { key: "status", label: "Status" }
        ]}
        rows={products}
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

      <div className="overflow-hidden rounded border border-line bg-white">
        <div className="flex flex-col gap-3 border-b border-line p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              className="field pl-9"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by Product Code, category, description, brand, supplier or logistics"
              value={search}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex items-center gap-2 rounded border border-line px-3 py-2 text-sm hover:bg-panel"
              onClick={refreshDemoData}
              type="button"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              className="inline-flex items-center gap-2 rounded border border-line px-3 py-2 text-sm hover:bg-panel"
              type="button"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse">
            <thead className="bg-panel">
              <tr>
                {[
                  "Product Code",
                  "Product Category",
                  "Description",
                  "Brand",
                  "Supplier",
                  "Logistics",
                  "Cost",
                  "Dealer Price",
                  "Online Price",
                  "Stock Alert",
