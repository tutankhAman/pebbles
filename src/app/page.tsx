import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(80,95,180,0.18),_transparent_28%),radial-gradient(circle_at_80%_20%,_rgba(33,162,152,0.16),_transparent_24%),linear-gradient(180deg,_rgba(248,248,244,0.96),_rgba(240,244,248,0.96))]" />
      <section className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-between px-6 py-10 sm:px-10 lg:px-16">
        <header className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[0.7rem] text-[var(--muted)] uppercase tracking-[0.35em]">
              Phase 0
            </p>
            <h1 className="mt-2 font-semibold text-2xl tracking-tight sm:text-3xl">
              Pebbles
            </h1>
          </div>
          <span className="rounded-full border border-[var(--border)] bg-white/70 px-3 py-1 font-mono text-[var(--muted)] text-xs shadow-sm backdrop-blur">
            collaborative spreadsheet scaffold
          </span>
        </header>

        <div className="grid gap-10 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="font-mono text-[0.75rem] text-[var(--accent)] uppercase tracking-[0.32em]">
                Trademarkia assignment foundation
              </p>
              <h2 className="max-w-3xl font-semibold text-4xl tracking-tight sm:text-5xl lg:text-6xl">
                Strict setup first. Then auth, grid, formulas, and
                collaboration.
              </h2>
              <p className="max-w-2xl text-[var(--muted)] text-lg leading-8">
                The repository now has a stable App Router shell, shared type
                contracts, planning docs, and placeholder routes for the
                dashboard and editor. This is the base for multi-agent
                implementation.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex items-center justify-center rounded-full bg-[var(--foreground)] px-5 py-3 font-medium text-[var(--background)] transition-transform hover:-translate-y-0.5"
                href="/dashboard"
              >
                Open dashboard skeleton
              </Link>
              <Link
                className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-white/70 px-5 py-3 font-medium shadow-sm backdrop-blur transition-colors hover:bg-white"
                href="/documents/example-sheet"
              >
                Open editor skeleton
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-[var(--border)] bg-white/75 p-6 shadow-[0_24px_80px_rgba(16,24,40,0.12)] backdrop-blur">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                "strict TypeScript",
                "Tailwind CSS",
                "route skeleton",
                "shared contracts",
                "architecture docs",
                "build scripts",
              ].map((item) => (
                <div
                  className="rounded-2xl border border-[var(--border)] bg-[rgba(248,249,250,0.84)] px-4 py-4"
                  key={item}
                >
                  <p className="font-mono text-[0.68rem] text-[var(--muted)] uppercase tracking-[0.25em]">
                    ready
                  </p>
                  <p className="mt-2 font-medium text-sm">{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl bg-[var(--panel)] px-4 py-4">
              <p className="font-mono text-[0.68rem] text-[var(--muted)] uppercase tracking-[0.25em]">
                next
              </p>
              <p className="mt-2 text-sm leading-7">
                Phase 1 will add Firebase Auth, InstantDB metadata, and the
                dashboard&apos;s real document lifecycle. Phase 2 onward will
                build the sparse sheet model and collaboration path.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
