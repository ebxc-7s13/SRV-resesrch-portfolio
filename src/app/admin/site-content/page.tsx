"use client";

import { useState, useEffect, useCallback } from "react";
import { contentRegistry } from "@/lib/content-registry";
import { AdminLayout } from "@/components/AdminCms";

interface SiteContentItem {
  id?: number;
  page: string;
  key: string;
  value: string;
}

// Predefined content keys organized by page

export default function AdminSiteContentPage() {
  const [items, setItems] = useState<SiteContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPage, setSelectedPage] = useState("home");
  const [editingItem, setEditingItem] = useState<SiteContentItem | null>(null);
  const [formValue, setFormValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/site-content");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unable to load content");
      const data = json.data?.data || json.data;
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setMessage("Unable to load or change content. Please retry.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  function getValue(page: string, key: string): string {
    const item = items.find((i) => i.page === page && i.key === key);
    return item?.value || "";
  }

  function handleEdit(page: string, key: string) {
    const item = items.find((i) => i.page === page && i.key === key);
    setEditingItem(item || { page, key, value: "" });
    setFormValue(item?.value || "");
    setMessage("");
  }

  async function handleSave() {
    if (!editingItem) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/site-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: editingItem.page,
          key: editingItem.key,
          value: formValue,
        }),
      });
      if (res.ok) {
        setMessage("Saved successfully");
        setEditingItem(null);
        fetchItems();
      } else {
        const json = await res.json();
        setMessage(json.error || "Save failed");
      }
    } catch {
      setMessage("Network error");
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this content entry?")) return;
    try {
      const res = await fetch(`/api/admin/site-content?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      fetchItems();
    } catch {
      setMessage("Unable to load or change content. Please retry.");
    }
  }

  const registryKeys = contentRegistry[selectedPage] || [];

  return (
    <AdminLayout title="Site Content Editor">
      <div className="space-y-6 max-w-4xl">
        <p className="text-sm text-muted">
          Edit the supported public headings and descriptions below. Saved
          changes appear on the next page load.
        </p>

        {/* Page selector */}
        <div className="flex flex-wrap gap-2">
          {Object.keys(contentRegistry).map((page) => (
            <button
              key={page}
              onClick={() => {
                setSelectedPage(page);
                setEditingItem(null);
                setMessage("");
              }}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                selectedPage === page
                  ? "bg-accent text-on-accent"
                  : "bg-panel text-muted hover:text-ink hover:bg-panel"
              }`}
            >
              {page.charAt(0).toUpperCase() + page.slice(1)}
            </button>
          ))}
        </div>

        {/* Editing form */}
        {editingItem && (
          <div className="bg-surface rounded-xl border border-line p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-ink">
                Editing: {editingItem.page} / {editingItem.key}
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-muted hover:text-ink text-sm"
              >
                Cancel
              </button>
            </div>
            {editingItem.key.includes("description") ||
            editingItem.key.includes("subtitle") ||
            editingItem.key.includes("quote") ? (
              <textarea
                aria-label="Content value"
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                className="w-full px-4 py-2.5 bg-panel border border-line rounded-lg text-ink focus:outline-none focus:border-line text-sm resize-y"
                rows={5}
              />
            ) : (
              <input
                type="text"
                aria-label="Content value"
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                className="w-full px-4 py-2.5 bg-panel border border-line rounded-lg text-ink focus:outline-none focus:border-line text-sm"
              />
            )}
            {message && (
              <p
                className={`text-sm mt-2 ${message.includes("error") || message.includes("Error") ? "text-danger" : "text-accent"}`}
              >
                {message}
              </p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-accent hover:bg-accent disabled:opacity-50 text-on-accent rounded-lg font-medium text-sm transition-colors"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setEditingItem(null)}
                className="px-5 py-2 bg-panel hover:bg-panel text-ink rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {message && <p role="status">{message}</p>}
        {/* Content list for selected page */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            {selectedPage.charAt(0).toUpperCase() + selectedPage.slice(1)} Page
            Content
          </h3>
          {loading ? (
            <div className="text-muted text-sm">Loading...</div>
          ) : registryKeys.length === 0 && selectedPage !== "custom" ? (
            <div className="text-muted text-sm">
              No predefined keys for this page.
            </div>
          ) : (
            <>
              {registryKeys.map((field) => {
                const value = getValue(selectedPage, field.key);
                const dbItem = items.find(
                  (i) => i.page === selectedPage && i.key === field.key,
                );
                return (
                  <div
                    key={field.key}
                    className="bg-surface rounded-lg border border-line p-4 hover:border-line transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-muted mb-0.5">
                          {field.label}
                        </div>
                        <div className="text-sm text-ink truncate">
                          {value || (
                            <span className="text-muted italic">Not set</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleEdit(selectedPage, field.key)}
                          className="px-3 py-1.5 text-xs text-ink hover:text-ink bg-panel hover:bg-panel rounded transition-colors"
                        >
                          {value ? "Edit" : "Set"}
                        </button>
                        {dbItem?.id && (
                          <button
                            onClick={() => handleDelete(dbItem.id!)}
                            className="px-3 py-1.5 text-xs text-danger hover:text-danger bg-panel hover:bg-red-900/30 rounded transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Custom content for this page */}
              {items
                .filter(
                  (i) =>
                    i.page === selectedPage &&
                    !registryKeys.find((f) => f.key === i.key),
                )
                .map((item) => (
                  <div
                    key={item.key}
                    className="bg-surface rounded-lg border border-line p-4 hover:border-line transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-muted mb-0.5">
                          {item.key} (legacy entry; not displayed publicly)
                        </div>
                        <div className="text-sm text-ink truncate">
                          {item.value || (
                            <span className="text-muted italic">Empty</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {item.id && (
                          <button
                            onClick={() => handleDelete(item.id!)}
                            className="px-3 py-1.5 text-xs text-danger hover:text-danger bg-panel hover:bg-red-900/30 rounded transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
