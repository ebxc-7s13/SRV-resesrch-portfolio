"use client";
import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminCms";
type Message = {
  id: number;
  name: string;
  email: string;
  subject: string;
  message?: string;
  read: number;
  created_at: string;
};
export default function Messages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [selected, setSelected] = useState<Message | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/admin/messages?page=${page}`, { signal: controller.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setMessages(j.data.data);
        setPages(j.data.pagination.totalPages || 1);
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setError(e.message || "Unable to load messages");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [page]);
  async function open(msg: Message) {
    if (selected?.id === msg.id) {
      setSelected(null);
      return;
    }
    try {
      const r = await fetch("/api/admin/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: msg.id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setSelected(j.data);
      setMessages((items) =>
        items.map((m) => (m.id === msg.id ? { ...m, read: 1 } : m)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open message");
    }
  }
  return (
    <AdminLayout title="Contact messages">
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Loading messages…</p>
      ) : !messages.length ? (
        <p>No messages on this page.</p>
      ) : (
        messages.map((msg) => (
          <article key={msg.id} className="message-card">
            <button
              className="message-trigger"
              aria-expanded={selected?.id === msg.id}
              aria-controls={`message-${msg.id}`}
              onClick={() => open(msg)}
            >
              <span>
                {msg.subject} {!msg.read && <small>Unread</small>}
              </span>
              <span>
                {msg.name} · {new Date(msg.created_at).toLocaleDateString()}
              </span>
            </button>
            {selected?.id === msg.id && (
              <div id={`message-${msg.id}`} className="message-body">
                <a href={`mailto:${msg.email}`}>{msg.email}</a>
                <p className="whitespace-pre-wrap">{selected.message}</p>
              </div>
            )}
          </article>
        ))
      )}
      <nav aria-label="Message pages" className="flex gap-4 mt-6">
        <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </nav>
    </AdminLayout>
  );
}
