import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--background)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(23,50,39,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(23,50,39,0.05)_1px,transparent_1px)] bg-[size:96px_96px] opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-[radial-gradient(circle_at_top_left,rgba(190,214,181,0.52),transparent_34%),radial-gradient(circle_at_78%_18%,rgba(90,141,115,0.2),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.72),transparent)] [animation:drift_14s_ease-in-out_infinite_alternate]" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-[96rem] flex-col justify-center gap-6 px-6 py-8 sm:px-10 sm:py-10 lg:px-16 lg:py-16">
        <nav className="w-full border border-[var(--border-strong)] bg-[rgba(248,252,246,0.84)] shadow-[0_18px_48px_rgba(23,50,39,0.08)] [animation:section-enter_650ms_cubic-bezier(0.16,1,0.3,1)_both]">
          <div className="flex flex-col gap-5 px-6 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="inline-flex border border-[var(--border-strong)] px-3 py-2 text-[0.72rem] text-[var(--foreground)] uppercase tracking-[0.28em]">
                Pebbles
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[0.72rem] text-[var(--muted)] uppercase tracking-[0.22em]">
              <span className="border border-[var(--border)] px-3 py-2">
                Yjs + Durable Objects
              </span>
              <Link
                className="border border-[var(--border)] px-3 py-2 transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                href="/dashboard"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </nav>

        <div className="grid w-full overflow-hidden border border-[var(--border-strong)] bg-[var(--panel)] shadow-[0_30px_90px_rgba(23,50,39,0.1)] [animation:section-enter_800ms_cubic-bezier(0.16,1,0.3,1)_both] lg:grid-cols-[1.15fr_0.85fr]">
          <div className="flex flex-col justify-between border-[var(--border)] border-b px-6 py-8 sm:px-10 sm:py-10 lg:min-h-[42rem] lg:border-b-0 lg:px-14 lg:py-14">
            <div className="space-y-10">
              <div className="flex flex-wrap items-center gap-3 text-[0.72rem] text-[var(--muted)] uppercase tracking-[0.28em]">
                <span className="border border-[var(--border-strong)] px-3 py-2">
                  Pebbles
                </span>
                <span>Real-time spreadsheet infrastructure</span>
              </div>

              <div className="space-y-6">
                <h1 className="max-w-4xl text-5xl leading-[0.94] sm:text-6xl lg:text-7xl">
                  Collaborative sheets with instant local edits, durable sync,
                  and formulas kept off the UI thread.
                </h1>
                <p className="max-w-2xl text-[0.95rem] text-[var(--muted)] leading-8 sm:text-[1rem]">
                  Pebbles is a lightweight spreadsheet workspace built for fast
                  editing at scale. Cell input lives in Yjs for conflict free
                  collaboration, document metadata and room persistence live in
                  Cloudflare Durable Objects, and HyperFormula runs in a worker
                  so large recalculations do not stall interaction.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  className="inline-flex min-h-14 items-center justify-center border border-[var(--accent)] bg-[var(--accent)] px-6 text-sm text-white uppercase tracking-[0.22em] transition-colors hover:bg-transparent hover:text-[var(--accent)]"
                  href="/dashboard"
                >
                  Open dashboard
                </Link>
              </div>
            </div>

            <div className="mt-12 grid gap-px border border-[var(--border)] bg-[var(--border)] text-sm sm:grid-cols-3">
              {[
                {
                  label: "Grid scale",
                  value: "1M logical cells",
                  detail:
                    "Sparse storage plus viewport virtualization keeps the sheet scrollable.",
                },
                {
                  label: "Sync path",
                  value: "BroadcastChannel + WebSocket",
                  detail:
                    "Local tabs stay near-instant while cross-device peers converge through the document room.",
                },
                {
                  label: "Computation",
                  value: "Worker-backed formulas",
                  detail:
                    "Raw input remains authoritative and computed values stay derived.",
                },
              ].map((item) => (
                <div
                  className="space-y-3 bg-[rgba(249,252,247,0.94)] px-5 py-5"
                  key={item.label}
                >
                  <p className="text-[0.68rem] text-[var(--muted)] uppercase tracking-[0.22em]">
                    {item.label}
                  </p>
                  <p className="font-medium text-[0.94rem] text-[var(--foreground)] leading-6">
                    {item.value}
                  </p>
                  <p className="text-[0.78rem] text-[var(--muted)] leading-6">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid bg-[linear-gradient(180deg,rgba(228,239,226,0.82),rgba(248,252,246,0.96))] lg:grid-rows-[auto_auto_1fr]">
            <div className="border-[var(--border)] border-b px-6 py-6 sm:px-10 sm:py-8">
              <p className="text-[0.68rem] text-[var(--muted)] uppercase tracking-[0.26em]">
                Document flow
              </p>
              <p className="mt-4 max-w-md text-[var(--foreground)] text-sm leading-7">
                Every edit applies locally first, syncs across browser tabs,
                then propagates to other devices through the collaboration room
                while presence remains visible in the same session.
              </p>
            </div>

            <div className="grid gap-px border-[var(--border)] border-b bg-[var(--border)] sm:grid-cols-2">
              {[
                "Yjs cells keep authored input as the source of truth.",
                "Durable Objects store metadata, room state, and recovery snapshots.",
                "Firebase Auth bootstraps identity before joining a sheet.",
                "The editor renders only the visible window of the grid.",
              ].map((line) => (
                <div
                  className="bg-[rgba(249,252,247,0.95)] px-5 py-5 text-[0.8rem] text-[var(--muted)] leading-6"
                  key={line}
                >
                  {line}
                </div>
              ))}
            </div>

            <div className="grid gap-px bg-[var(--border)]">
              {[
                {
                  step: "01",
                  title: "Capture",
                  body: "The active cell stores raw text, numbers, or formulas in the shared Yjs map using canonical row and column keys.",
                },
                {
                  step: "02",
                  title: "Evaluate",
                  body: "HyperFormula receives targeted updates from the main thread worker client and returns computed values without blocking input.",
                },
                {
                  step: "03",
                  title: "Persist",
                  body: "The collaboration room keeps the document live in memory and writes durable state so sheets recover cleanly after clients disconnect.",
                },
              ].map((item) => (
                <div
                  className="grid gap-4 bg-[rgba(248,252,246,0.94)] px-6 py-6 sm:grid-cols-[auto_1fr] sm:items-start sm:px-10"
                  key={item.step}
                >
                  <div className="border border-[var(--border-strong)] px-3 py-2 text-[0.7rem] text-[var(--muted)] uppercase tracking-[0.24em]">
                    {item.step}
                  </div>
                  <div>
                    <h2 className="text-2xl">{item.title}</h2>
                    <p className="mt-3 max-w-lg text-[0.8rem] text-[var(--muted)] leading-7">
                      {item.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
