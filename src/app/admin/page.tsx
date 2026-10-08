"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}

interface Stats {
  posts: number;
  projects: number;
  messages: number;
  unreadMessages: number;
  theses: number;
  patents: number;
  timeline: number;
  themes: number;
  publications: number;
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Stats>({
    posts: 0,
    projects: 0,
    messages: 0,
    unreadMessages: 0,
    theses: 0,
    patents: 0,
    timeline: 0,
    themes: 0,
    publications: 0,
  });
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats");
      const json = await res.json();
      if (!res.ok) throw new Error();
      setStats(json.data);
    } catch {
      setError("Unable to load statistics. Please retry.");
    }
  }, []);
  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) return;
        const json = await res.json();
        const u = json.data?.user || json.user;
        if (active && u?.role === "admin") {
          setUser(u);
          fetchStats();
        }
      })
      .catch(() => {
        if (active)
          setError("Unable to load administrator data. Please retry.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchStats]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoggingIn(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (res.ok) {
        const userData = json.data?.user || json.user;
        if (userData) {
          setUser(userData);
          fetchStats();
        } else setError("Login succeeded but user data is missing");
      } else {
        setError(json.error || "Login failed");
      }
    } catch {
      setError("Network error");
    }
    setLoggingIn(false);
  }

  async function handleLogout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error();
    } catch {
      setError("Sign out failed. Please retry.");
      return;
    }
    setUser(null);
    setStats({
      posts: 0,
      projects: 0,
      messages: 0,
      unreadMessages: 0,
      theses: 0,
      patents: 0,
      timeline: 0,
      themes: 0,
      publications: 0,
    });
  }

  if (loading)
    return (
      <main className="min-h-screen bg-page flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-line border-t-transparent rounded-full animate-spin" />
      </main>
    );

  if (!user)
    return (
      <main className="min-h-screen bg-page flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-ink page-title">Research Admin</h1>
            <p className="text-muted text-sm mt-1">
              Sign in to manage your research portfolio
            </p>
          </div>
          <form
            onSubmit={handleLogin}
            className="bg-surface rounded-xl border border-line p-8 space-y-4"
          >
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-danger text-sm">
                {error}
              </div>
            )}
            <div>
              <label
                htmlFor="admin-email"
                className="block text-sm font-medium text-muted mb-1"
              >
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-panel border border-line rounded-lg text-ink focus:outline-none focus:border-line text-sm"
                required
                autoComplete="username"
              />
            </div>
            <div>
              <label
                htmlFor="admin-password"
                className="block text-sm font-medium text-muted mb-1"
              >
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-panel border border-line rounded-lg text-ink focus:outline-none focus:border-line text-sm"
                required
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-2.5 bg-accent hover:bg-accent disabled:opacity-50 text-on-accent rounded-lg font-medium transition-colors"
            >
              {loggingIn ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </main>
    );

  const cmsSections = [
    {
      label: "Research Projects",
      href: "/admin/projects",
      icon: "🔬",
      count: stats.projects,
      color: "indigo",
    },
    {
      label: "Publications",
      href: "/admin/publications",
      icon: "📄",
      count: stats.publications,
      color: "emerald",
    },
    {
      label: "Research Notes",
      href: "/admin/posts",
      icon: "✎",
      count: stats.posts,
      color: "emerald",
    },
    {
      label: "Theses",
      href: "/admin/theses",
      icon: "🎓",
      count: stats.theses,
      color: "blue",
    },
    {
      label: "Patents",
      href: "/admin/patents",
      icon: "📋",
      count: stats.patents,
      color: "amber",
    },
    {
      label: "Timeline",
      href: "/admin/timeline",
      icon: "📅",
      count: stats.timeline,
      color: "violet",
    },
    {
      label: "Research Themes",
      href: "/admin/themes",
      icon: "🏷️",
      count: stats.themes,
      color: "cyan",
    },
    {
      label: "Site Content",
      href: "/admin/site-content",
      icon: "📝",
      count: 0,
      color: "teal",
    },
    {
      label: "Contact Messages",
      href: "/admin/messages",
      icon: "✉️",
      count: stats.messages,
      color: "rose",
      badge: stats.unreadMessages,
    },
  ];

  return (
    <main className="min-h-screen bg-page">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-ink page-title">Research Dashboard</h1>
            <p className="text-muted text-sm mt-1">Welcome, {user.name}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-muted hover:text-ink border border-line hover:border-line rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>

        {error && <p role="alert">{error}</p>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {cmsSections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="block bg-surface rounded-xl border border-line p-5 hover:border-line transition-colors group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">{s.icon}</span>
                <div className="flex items-center gap-2">
                  {s.badge ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-danger">
                      {s.badge} new
                    </span>
                  ) : null}
                  <span className={`text-2xl font-bold text-${s.color}-400`}>
                    {s.count}
                  </span>
                </div>
              </div>
              <h3 className="text-sm font-semibold text-ink group-hover:text-accent transition-colors">
                {s.label}
              </h3>
            </Link>
          ))}
        </div>

        <div className="mt-8 text-center text-xs text-muted">
          <p>
            To rotate an existing account, use{" "}
            <code>npm run db:rotate-admin</code> with the ROTATE_ADMIN_*
            environment variables. Previous sessions are revoked.
          </p>
        </div>
      </div>
    </main>
  );
}
