"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

type Customer = {
  id: string;
  customer_code: string;
  company_name: string;
  contact_person: string | null;
  contact_number: string | null;
  email: string | null;
  billing_address: string | null;
  delivery_address: string | null;
  credit_terms: string | null;
  created_at: string;
  updated_at: string;
};

type CustomerForm = {
  id: string;
  customerCode: string;
  companyName: string;
  contactPerson: string;
  contactNumber: string;
  email: string;
  billingAddress: string;
  deliveryAddress: string;
  creditTerms: string;
};

const emptyForm: CustomerForm = {
  id: "",
  customerCode: "",
  companyName: "",
  contactPerson: "",
  contactNumber: "",
  email: "",
  billingAddress: "",
  deliveryAddress: "",
  creditTerms: "",
};

export function CustomerManager({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/customers", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to load customers.",
        );
      }

      setCustomers(data.customers || []);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load customers.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial Supabase API hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCustomers();
  }, [loadCustomers]);

  const filteredCustomers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return customers;
    }

    return customers.filter((customer) =>
      [
        customer.customer_code,
        customer.company_name,
        customer.contact_person,
        customer.contact_number,
        customer.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [customers, search]);

  function updateForm(
    field: keyof CustomerForm,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openAddForm() {
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  function openEditForm(customer: Customer) {
    setForm({
      id: customer.id,
      customerCode: customer.customer_code || "",
      companyName: customer.company_name || "",
      contactPerson: customer.contact_person || "",
      contactNumber: customer.contact_number || "",
      email: customer.email || "",
      billingAddress: customer.billing_address || "",
      deliveryAddress: customer.delivery_address || "",
      creditTerms: customer.credit_terms || "",
    });

    setError("");
    setShowForm(true);
  }

  async function saveCustomer() {
    if (!form.companyName.trim()) {
      setError("Company name is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/customers", {
        method: form.id ? "PATCH" : "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to save customer.",
        );
      }

      setShowForm(false);
      setForm(emptyForm);

      await loadCustomers();

      notify(
        form.id
          ? "Customer updated in Supabase"
          : "Customer added to Supabase",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save customer.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteCustomer(customer: Customer) {
    const confirmed = window.confirm(
      `Delete ${customer.company_name}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch("/api/customers", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          id: customer.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to delete customer.",
        );
      }

      await loadCustomers();
      notify("Customer deleted from Supabase");
    } catch (requestError) {
      notify(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete customer.",
      );
    }
  }

  return (
    <>
      <div className="page-head row between">
        <div>
          <h2>Customers</h2>
          <p>
            {customers.length} customer records saved in
            Supabase
          </p>
        </div>

        <div className="row">
          <button
            className="btn"
            onClick={loadCustomers}
          >
            <RefreshCw size={13} />
            Refresh
          </button>

          <button
            className="btn primary"
            onClick={openAddForm}
          >
            <Plus size={13} />
            Add customer
          </button>
        </div>
      </div>

      <div className="card">
        <div className="pad toolbar">
          <input
            className="input"
            placeholder="Search customer, code, contact or email"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        {loading ? (
          <div className="empty">
            Loading customers from Supabase...
          </div>
        ) : error ? (
          <div className="empty danger-text">
            {error}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="empty">
            No customers saved in Supabase.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact person</th>
                  <th>Contact number</th>
                  <th>Email</th>
                  <th>Billing address</th>
                  <th>Delivery address</th>
                  <th>Credit terms</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <b>{customer.company_name}</b>
                      <div className="muted">
                        {customer.customer_code}
                      </div>
                    </td>

                    <td>
                      {customer.contact_person || "—"}
                    </td>

                    <td>
                      {customer.contact_number || "—"}
                    </td>

                    <td>{customer.email || "—"}</td>

                    <td>
                      {customer.billing_address || "—"}
                    </td>

                    <td>
                      {customer.delivery_address || "—"}
                    </td>

                    <td>
                      {customer.credit_terms || "—"}
                    </td>

                    <td>
                      <div className="row">
                        <button
                          className="btn sm"
                          onClick={() =>
                            openEditForm(customer)
                          }
                        >
                          <Pencil size={11} />
                          Edit
                        </button>

                        <button
                          className="btn sm danger"
                          onClick={() =>
                            deleteCustomer(customer)
                          }
                        >
                          <Trash2 size={11} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-head">
              <b>
                {form.id
                  ? "Edit customer"
                  : "Add customer"}
              </b>

              <button
                className="icon-btn"
                onClick={() => setShowForm(false)}
              >
                <X size={15} />
              </button>
            </div>

            <div className="modal-body">
              <div className="grid-2">
                <div className="field">
                  <label>Customer code</label>
                  <input
                    className="input"
                    placeholder="Assigned automatically"
                    value={form.customerCode}
                    onChange={(event) =>
                      updateForm(
                        "customerCode",
                        event.target.value,
                      )
                    }
                  />
                </div>

                <div className="field">
                  <label>Company name *</label>
                  <input
                    className="input"
                    value={form.companyName}
                    onChange={(event) =>
                      updateForm(
                        "companyName",
                        event.target.value,
                      )
                    }
                  />
                </div>

                <div className="field">
                  <label>Contact person</label>
                  <input
                    className="input"
                    value={form.contactPerson}
                    onChange={(event) =>
                      updateForm(
                        "contactPerson",
                        event.target.value,
                      )
                    }
                  />
                </div>

                <div className="field">
                  <label>Contact number</label>
                  <input
                    className="input"
                    value={form.contactNumber}
                    onChange={(event) =>
                      updateForm(
                        "contactNumber",
                        event.target.value,
                      )
                    }
                  />
                </div>

                <div className="field">
                  <label>Email</label>
                  <input
                    className="input"
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      updateForm(
                        "email",
                 
