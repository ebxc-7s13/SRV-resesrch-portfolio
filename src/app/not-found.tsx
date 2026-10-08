import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
      <div className="text-center">
        <div className="text-9xl font-bold text-slate-800">404</div>
        <h1 className="text-3xl font-bold text-white mt-4 mb-2">
          Page Not Found
        </h1>
        <p className="text-slate-400 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors inline-block"
        >
          Go Home
        </Link>
      </div>
    </main>
  );
}
