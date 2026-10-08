import Link from "next/link";

export const metadata = {
  alternates: { canonical: "/privacy" },
  title: "Privacy Policy",
  description: "Privacy policy for this research portfolio website.",
};

export default function PrivacyPage() {
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
          Privacy Policy
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
            <h2 className="text-2xl font-bold text-white mb-3">
              Information Collection
            </h2>
            <p className="leading-relaxed">
              When you use the contact form, we collect your name, email
              address, and message content. This information is stored securely
              and is only used to respond to your inquiry.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-3">
              Data Security
            </h2>
            <p className="leading-relaxed">
              We implement industry-standard security measures including HTTPS
              encryption, secure authentication, and regular security audits to
              protect your data.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-3">Cookies</h2>
            <p className="leading-relaxed">
              We use httpOnly, secure cookies solely for authentication
              purposes. These cookies cannot be accessed by JavaScript and are
              sent only over HTTPS.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-3">Contact</h2>
            <p className="leading-relaxed">
              If you have questions about this policy, please use the contact
              form on this website.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
