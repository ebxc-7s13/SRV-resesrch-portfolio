"use client";

import { useState, useEffect, useCallback } from "react";

interface AdminLayoutProps {
  title: string;
  children: React.ReactNode;
}

export function AdminLayout({ title, children }: AdminLayoutProps) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const u = json?.data?.user || json?.user;
        if (u) setUser(u);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-line border-t-transparent rounded-full animate-spin" />
      </div>
    );
  if (!user || user.role !== "admin")
    return (
      <div className="min-h-screen bg-page flex items-center justify-center text-muted">
        Administrator access required.{" "}
        <a href="/admin" className="text-accent ml-2">
          Go to login
        </a>
      </div>
    );

  return (
    <main className="min-h-screen bg-page">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="/admin"
              className="text-muted hover:text-ink transition-colors"
            >
              ← Dashboard
            </a>
            <h1 className="text-ink page-title">{title}</h1>
          </div>
          <span className="text-sm text-muted">{user.name}</span>
        </div>
        {children}
      </div>
    </main>
  );
}

interface FieldConfig {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "checkbox" | "number";
  required?: boolean;
  options?: { value: string; label: string }[];
  rows?: number;
  placeholder?: string;
  helpText?: string;
}

interface ColumnConfig {
  key: string;
  label: string;
}

interface CmsListProps {
  title: string;
  apiBase: string;
  fields: FieldConfig[];
  columns: ColumnConfig[];
  statusField?: string;
}

function StatusBadge({ value, field }: { value: string; field: string }) {
  if (field === "status") {
    const colors: Record<string, string> = {
      completed: "bg-tint text-accent",
      ongoing: "bg-tint text-accent",
      under_review: "bg-tint text-accent",
      filed: "bg-tint text-accent",
      granted: "bg-tint text-accent",
      pending: "bg-tint text-accent",
      search_report: "bg-tint text-accent",
      published: "bg-tint text-accent",
    };
    return (
      <span
        className={`text-xs px-2 py-0.5 rounded-full ${colors[value] || "bg-panel text-muted"}`}
      >
        {value.replace(/_/g, " ")}
      </span>
    );
  }
  if (field === "published") {
    return (
      <span
        className={`text-xs px-2 py-0.5 rounded-full ${value ? "bg-tint text-accent" : "bg-panel text-muted"}`}
      >
        {value ? "Published" : "Draft"}
      </span>
    );
  }
  return (
    <span className="text-muted text-xs">
      {String(value ?? "").substring(0, 120)}
    </span>
  );
}

export function CmsList({ title, apiBase, fields, columns }: CmsListProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}?page=${page}&limit=20`);
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error || "Unable to load records");
      setError("");
      setTotal(json.data.pagination?.total ?? json.data.length);
      setTotalPages(json.data.pagination?.totalPages || 1);
      const data = json.data?.data || json.data;
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    }
    setLoading(false);
  }, [apiBase, page]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  function initForm(item?: any) {
    const data: any = {};
    fields.forEach((f) => {
      if (item && item[f.key] != null) {
        data[f.key] = f.type === "checkbox" ? !!item[f.key] : item[f.key];
      } else {
        data[f.key] =
          f.type === "checkbox" ? false : f.type === "number" ? 0 : "";
      }
    });
    setFormData(data);
    setEditing(item || null);
    setShowForm(true);
    setError("");
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const body = { ...formData };
      fields.forEach((f) => {
        if (f.type === "number") body[f.key] = parseInt(body[f.key]) || 0;
      });

      const url = editing ? `${apiBase}/${editing.id}` : apiBase;
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok) {
        setShowForm(false);
        fetchItems();
      } else {
        setError(json.error || "Save failed");
      }
    } catch {
      setError("Network error");
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
      const response = await fetch(`${apiBase}/${id}`, { method: "DELETE" });
      if (!response.ok)
        throw new Error((await response.json()).error || "Delete failed");
      fetchItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    }
  }

  if (showForm) {
    return (
      <AdminLayout title={editing ? `Edit ${title}` : `New ${title}`}>
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-danger text-sm mb-4">
            {error}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="space-y-4 max-w-3xl"
        >
          {fields.map((f) => (
            <div key={f.key}>
              <label
                htmlFor={`cms-${f.key}`}
                className="block text-sm font-medium text-muted mb-1"
              >
                {f.label} {f.required && <span className="text-danger">*</span>}
              </label>
              {f.type === "text" && (
                <input
                  id={`cms-${f.key}`}
                  type="text"
                  value={formData[f.key] || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, [f.key]: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-panel border border-line rounded-lg text-ink focus:outline-none focus:border-line text-sm"
                  placeholder={f.placeholder}
                  required={f.required}
                />
              )}
              {f.type === "textarea" && (
                <textarea
                  id={`cms-${f.key}`}
                  value={formData[f.key] || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, [f.key]: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-panel border border-line rounded-lg text-ink focus:outline-none focus:border-line text-sm resize-y"
                  rows={f.rows || 4}
                  placeholder={f.placeholder}
                  required={f.required}
                />
              )}
              {f.type === "select" && (
                <select
                  id={`cms-${f.key}`}
                  value={formData[f.key] || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, [f.key]: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-panel border border-line rounded-lg text-ink focus:outline-none focus:border-line text-sm"
                  required={f.required}
                >
                  <option value="">Select...</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
              {f.type === "checkbox" && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    id={`cms-${f.key}`}
                    type="checkbox"
                    checked={!!formData[f.key]}
                    onChange={(e) =>
                      setFormData({ ...formData, [f.key]: e.target.checked })
                    }
                    className="rounded border-line bg-panel text-accent"
                  />
                  <span className="text-sm text-muted">{f.label}</span>
                </label>
              )}
              {f.type === "number" && (
                <input
                  id={`cms-${f.key}`}
                  type="number"
                  value={formData[f.key] || 0}
                  onChange={(e) =>
                    setFormData({ ...formData, [f.key]: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-panel border border-line rounded-lg text-ink focus:outline-none focus:border-line text-sm"
                  min={0}
                  required={f.required}
                />
              )}
              {f.helpText && (
                <p className="text-xs text-muted mt-1">{f.helpText}</p>
              )}
            </div>
          ))}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-accent hover:bg-accent disabled:opacity-50 text-on-accent rounded-lg font-medium transition-colors"
            >
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-6 py-2.5 bg-panel hover:bg-panel text-ink rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={`${title} (${total})`}>
      <div className="mb-6">
        <button
          onClick={() => initForm()}
          className="px-4 py-2 bg-accent hover:bg-accent text-on-accent rounded-lg font-medium transition-colors text-sm"
        >
          + Add New
        </button>
      </div>
      {error && (
        <p role="alert" className="mb-4 text-danger">
          {error}
        </p>
      )}
      {loading ? (
        <div className="text-muted">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-muted bg-surface rounded-xl border border-line p-8 text-center">
          No items yet. Click &quot;Add New&quot; to create one.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-surface rounded-xl border border-line p-4 flex items-center justify-between gap-4 hover:border-line transition-colors"
            >
              <div className="flex-1 min-w-0">
                {columns.map((col) => (
                  <div key={col.key} className="text-sm">
                    {col.key === columns[0].key ? (
                      <span className="text-ink font-medium">
                        {String(item[col.key] ?? "").substring(0, 200)}
                      </span>
                    ) : (
                      <StatusBadge value={item[col.key]} field={col.key} />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => initForm(item)}
                  className="px-3 py-1.5 text-xs text-ink hover:text-ink bg-panel hover:bg-panel rounded transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="px-3 py-1.5 text-xs text-danger hover:text-danger bg-panel hover:bg-red-900/30 rounded transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <nav aria-label="Record pages" className="flex items-center gap-4 mt-6">
        <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </nav>
    </AdminLayout>
  );
}
