import Link from "next/link";

export const metadata = {
  alternates: { canonical: "/terms" },
  title: "Terms of Service",
  description: "Terms of service for this research portfolio website.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-950">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <Link
          href="/"
          className="text-indigo-400 hover:text-indigo-300 text-sm mb-8 inline-block"
        >
          ← Back to Home
        </Link>
        <h1 className="original-page-title text-7xl md:text-8xl font-bold text-white mb-8 text-center">
          Terms of Service
        </h1>
        <div className="space-y-6 text-slate-400">
          <p>
            <strong className="text-white">Last updated:</strong>{" "}
            {new Date().toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          <div>
            <h2 className="text-2xl font-bold text-white mb-3">Acceptance</h2>
            <p className="leading-relaxed">
              By accessing this website, you agree to these terms of service.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-3">
              Use of Content
            </h2>
            <p className="leading-relaxed">
              Research notes and project descriptions are provided for
              informational purposes. You may share links and evaluate the
              public source locally for personal purposes. You may not
              republish this portfolio, present it as your own website, or use
              the original code and content commercially without permission.
              Third-party assets retain their respective terms and credits.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-3">Contact Form</h2>
            <p className="leading-relaxed">
              When using the contact form, you agree to provide accurate
              information. Abuse of the contact form (spam, harassment) will
              result in IP blocking.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
