import Link from "next/link";

const placeholderDocuments = [
  {
    id: "market-map",
    lastModified: "Pending metadata integration",
    owner: "Phase 1 placeholder",
    title: "Market Expansion Model",
  },
  {
    id: "pricing-grid",
    lastModified: "Pending metadata integration",
    owner: "Phase 1 placeholder",
    title: "Pricing Scenario Sheet",
  },
];

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_rgba(244,243,238,1),_rgba(235,240,244,1))] px-6 py-8 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 border-[var(--border)] border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[0.72rem] text-[var(--accent)] uppercase tracking-[0.3em]">
              Dashboard Skeleton
            </p>
            <h1 className="mt-2 font-semibold text-3xl tracking-tight sm:text-4xl">
              Documents
            </h1>
            <p className="mt-3 max-w-2xl text-[var(--muted)] leading-7">
              Phase 0 route placeholder for the metadata-backed dashboard. Phase
              1 will replace this static list with Firebase Auth and InstantDB
              data.
            </p>
          </div>
          <Link
            className="inline-flex items-center justify-center rounded-full bg-[var(--foreground)] px-5 py-3 font-medium text-[var(--background)]"
            href="/documents/example-sheet"
          >
            Open placeholder editor
          </Link>
        </div>

        <div className="mt-8 grid gap-4">
          {placeholderDocuments.map((document) => (
            <article
              className="grid gap-4 rounded-[1.75rem] border border-[var(--border)] bg-white/80 p-5 shadow-[0_10px_32px_rgba(16,24,40,0.08)] backdrop-blur sm:grid-cols-[1.4fr_0.8fr_0.8fr_auto] sm:items-center"
              key={document.id}
            >
              <div>
                <p className="font-medium text-lg">{document.title}</p>
                <p className="mt-1 font-mono text-[0.7rem] text-[var(--muted)] uppercase tracking-[0.28em]">
                  {document.id}
                </p>
              </div>
              <div>
                <p className="font-mono text-[0.68rem] text-[var(--muted)] uppercase tracking-[0.24em]">
                  Owner
                </p>
                <p className="mt-2 text-sm">{document.owner}</p>
              </div>
              <div>
                <p className="font-mono text-[0.68rem] text-[var(--muted)] uppercase tracking-[0.24em]">
                  Last modified
                </p>
                <p className="mt-2 text-sm">{document.lastModified}</p>
              </div>
              <Link
                className="inline-flex items-center justify-center rounded-full border border-[var(--border)] px-4 py-2.5 text-sm transition-colors hover:bg-[var(--panel)]"
                href={`/documents/${document.id}`}
              >
                Open
              </Link>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
