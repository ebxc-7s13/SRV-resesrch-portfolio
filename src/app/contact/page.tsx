"use client";
import { SiteText } from "@/components/SiteContent";
import PageHeader from "@/components/ui/PageHeader";

import { useState } from "react";

export default function ContactPage() {
  const [formState, setFormState] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });

  const [timestamp, setTimestamp] = useState(() => Date.now().toString());

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormState({ status: "loading", message: "" });

    const form = e.currentTarget;
    const formData = new FormData(form);

    const data = {
      name: formData.get("name"),
      email: formData.get("email"),
      subject: formData.get("subject"),
      message: formData.get("message"),
      website: formData.get("website"),
      timestamp: formData.get("timestamp"),
    };

    const elapsed = Date.now() - parseInt(timestamp);
    if (elapsed < 3000) {
      setFormState({
        status: "error",
        message: "Please take your time filling out the form.",
      });
      return;
    }

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (res.ok) {
        setFormState({
          status: "success",
          message: "Message sent successfully! I'll get back to you soon.",
        });
        form.reset();
      } else {
        setFormState({
          status: "error",
          message: result.error || "Something went wrong.",
        });
      }
    } catch {
      setFormState({
        status: "error",
        message: "Network error. Please try again.",
      });
    }
  }

  return (
    <main className="min-h-screen bg-slate-950">
      <PageHeader
        index="09"
        label="Start a conversation"
        title={
          <SiteText page="contact" name="hero_title">
            Get in <span>Touch</span>
          </SiteText>
        }
        description={
          <SiteText page="contact" name="hero_subtitle">
            Interested in research collaboration, have questions about my work,
            or want to discuss biomedical imaging and diagnostics? I&apos;d love
            to hear from you.
          </SiteText>
        }
      />
      <section className="shell contact-layout">
        <aside className="contact-brief">
          <div className="contact-signal" aria-hidden="true">
            <span />
            <span />
            <span />
            <i>↗</i>
          </div>
          <div className="eyebrow">Research / Collaboration</div>
          <h2>Bring your questions.</h2>
          <p>
            Tell me about your research, the problem you are exploring, or the
            work that brought you here.
          </p>
          <div className="contact-topics">
            <span>Biomedical imaging</span>
            <span>Computational methods</span>
            <span>Research instrumentation</span>
          </div>
        </aside>
        <div className="contact-form-panel">
          <div className="contact-form-heading">
            <h2>Your message</h2>
            <span>All fields marked * are required.</span>
          </div>
          {formState.status === "success" ? (
              <div className="text-center py-6" role="status">
              <div className="message-confirmation" aria-hidden="true">
                ✓
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Message Sent!
              </h2>
              <p className="text-slate-400 mb-6">{formState.message}</p>
              <button
                onClick={() => {
                  setTimestamp(Date.now().toString());
                  setFormState({ status: "idle", message: "" });
                }}
                className="button"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-4"
              aria-busy={formState.status === "loading"}
            >
              {/* Honeypot */}
              <div
                style={{ position: "absolute", left: "-9999px" }}
                aria-hidden="true"
              >
                <label htmlFor="website">Leave this empty</label>
                <input
                  type="text"
                  id="website"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>
              <input type="hidden" name="timestamp" value={timestamp} />

              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-slate-400 mb-2"
                >
                  Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  maxLength={100}
                  autoComplete="name"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 text-sm"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-slate-400 mb-2"
                >
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  maxLength={255}
                  autoComplete="email"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 text-sm"
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label
                  htmlFor="subject"
                  className="block text-sm font-medium text-slate-400 mb-2"
                >
                  Subject *
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  required
                  maxLength={200}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 text-sm"
                  placeholder="Research collaboration, question about your work..."
                />
              </div>
              <div>
                <label
                  htmlFor="message"
                  className="block text-sm font-medium text-slate-400 mb-2"
                >
                  Message *
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  minLength={10}
                  maxLength={5000}
                  rows={4}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 text-sm resize-y"
                  placeholder="Tell me about your research interests or question..."
                />
              </div>

              {formState.status === "error" && (
                <div
                  role="alert"
                  className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm"
                >
                  {formState.message}
                </div>
              )}

              <button
                type="submit"
                disabled={formState.status === "loading"}
                className="button contact-submit"
              >
                {formState.status === "loading" ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Sending...
                  </span>
                ) : (
                  "Send Message"
                )}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
