const previewColumns = ["A", "B", "C", "D", "E", "F"] as const;

interface DocumentPageProps {
  params: Promise<{
    documentId: string;
  }>;
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { documentId } = await params;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_rgba(241,245,248,1),_rgba(249,248,245,1))] px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <header className="flex flex-col gap-3 rounded-[1.75rem] border border-[var(--border)] bg-white/78 px-5 py-4 shadow-[0_18px_48px_rgba(15,23,42,0.09)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-[0.7rem] text-[var(--accent)] uppercase tracking-[0.28em]">
              Editor Skeleton
            </p>
            <h1 className="mt-2 font-semibold text-2xl tracking-tight">
              {documentId}
            </h1>
            <p className="mt-2 max-w-2xl text-[var(--muted)] text-sm leading-6">
              Phase 0 placeholder route. Future phases will mount the sparse
              grid, collaboration room, presence, write-state indicator, and
              HyperFormula worker integration here.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1 font-mono text-[var(--muted)] text-xs">
              saving state: idle
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1 font-mono text-[var(--muted)] text-xs">
              presence: 0 users
            </span>
          </div>
        </header>

        <section className="overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-white/82 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
          <div className="grid grid-cols-[5rem_repeat(6,minmax(9rem,1fr))] border-[var(--border)] border-b bg-[rgba(236,241,244,0.9)]">
            <div className="border-[var(--border)] border-r px-3 py-3" />
            {previewColumns.map((column) => (
              <div
                className="border-[var(--border)] border-r px-3 py-3 font-mono text-[var(--muted)] text-xs tracking-[0.24em] last:border-r-0"
                key={column}
              >
                {column}
              </div>
            ))}
          </div>

          <div className="grid">
            {Array.from({ length: 8 }, (_, rowIndex) => {
              const rowNumber = rowIndex + 1;
              return (
                <div
                  className="grid grid-cols-[5rem_repeat(6,minmax(9rem,1fr))] border-[var(--border)] border-b last:border-b-0"
                  key={rowNumber}
                >
                  <div className="border-[var(--border)] border-r bg-[rgba(248,249,250,0.9)] px-3 py-4 font-mono text-[var(--muted)] text-xs tracking-[0.18em]">
                    {rowNumber}
                  </div>
                  {previewColumns.map((column) => (
                    <div
                      className="border-[var(--border)] border-r px-3 py-4 text-[var(--muted)] text-sm last:border-r-0"
                      key={`${rowNumber}:${column}`}
                    >
                      {rowNumber === 1 && column === "A"
                        ? "Phase 0 scaffold"
                        : ""}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
