export default function Loading() {
  return (
    <main className="shell py-20" aria-busy="true" aria-label="Loading page">
      <p role="status" className="eyebrow">
        Loading…
      </p>
      <div className="mt-8 h-24 rounded-lg bg-panel" />
      <div className="mt-6 h-48 rounded-lg bg-surface border border-line" />
    </main>
  );
}
