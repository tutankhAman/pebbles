import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--background)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(23,50,39,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(23,50,39,0.05)_1px,transparent_1px)] bg-[size:96px_96px] opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-[radial-gradient(circle_at_top_left,rgba(190,214,181,0.52),transparent_34%),radial-gradient(circle_at_78%_18%,rgba(90,141,115,0.2),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.72),transparent)] [animation:drift_14s_ease-in-out_infinite_alternate]" />

      <section className="fluid-shell relative mx-auto flex min-h-screen w-full max-w-[96rem] flex-col justify-center">
        <nav className="w-full border border-[var(--border-strong)] bg-[rgba(248,252,246,0.84)] shadow-[0_18px_48px_rgba(23,50,39,0.08)] [animation:section-enter_650ms_cubic-bezier(0.16,1,0.3,1)_both]">
          <div className="fluid-panel-tight flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="fluid-overline inline-flex border border-[var(--border-strong)] px-3 py-2 text-[var(--foreground)] uppercase">
                Pebbles
              </span>
            </div>

            <div className="fluid-label flex flex-wrap items-center gap-3 text-[var(--muted)] uppercase">
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
          <div className="fluid-panel flex flex-col justify-between border-[var(--border)] border-b lg:min-h-[42rem] lg:border-b-0">
            <div className="space-y-10">
              <div className="fluid-overline flex flex-wrap items-center gap-3 text-[var(--muted)] uppercase">
                <span className="border border-[var(--border-strong)] px-3 py-2">
                  Pebbles
                </span>
                <span>Real-time spreadsheet infrastructure</span>
              </div>

              <div className="space-y-5">
                <h1 className="fluid-display max-w-4xl">
                  Collaborative sheets with instant local edits, durable sync,
                  and formulas kept off the UI thread.
                </h1>
                <p className="fluid-body max-w-2xl text-[var(--muted)]">
                  Pebbles is a lightweight collaborative spreadsheet with live
                  sync, durable rooms, and worker-backed formulas.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  className="fluid-button inline-flex min-h-12 items-center justify-center border border-[var(--accent)] bg-[var(--accent)] px-5 text-white uppercase transition-colors hover:bg-transparent hover:text-[var(--accent)]"
                  href="/dashboard"
                >
                  Open dashboard
                </Link>
              </div>
            </div>

            <div className="mt-10 grid gap-px border border-[var(--border)] bg-[var(--border)] text-sm sm:grid-cols-3">
              {[
                {
                  label: "Grid scale",
                  value: "1M logical cells",
                  detail: "Sparse storage and viewport virtualization.",
                },
                {
                  label: "Sync path",
                  value: "BroadcastChannel + WebSocket",
                  detail: "Fast local tabs and cross-device collaboration.",
                },
                {
                  label: "Computation",
                  value: "Worker-backed formulas",
                  detail: "Computed values stay off the main UI thread.",
                },
              ].map((item) => (
                <div
                  className="space-y-3 bg-[rgba(249,252,247,0.94)] px-5 py-5"
                  key={item.label}
                >
                  <p className="fluid-label text-[var(--muted)] uppercase">
                    {item.label}
                  </p>
                  <p className="fluid-body-tight font-medium text-[var(--foreground)]">
                    {item.value}
                  </p>
                  <p className="fluid-micro text-[var(--muted)]">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid bg-[linear-gradient(180deg,rgba(228,239,226,0.82),rgba(248,252,246,0.96))] lg:grid-rows-[auto_auto_1fr]">
            <div className="fluid-panel-tight border-[var(--border)] border-b">
              <p className="fluid-label text-[var(--muted)] uppercase">
                Document flow
              </p>
              <p className="fluid-body-tight mt-3 max-w-md text-[var(--foreground)]">
                Edits apply locally, sync across tabs, then converge in the
                shared room.
              </p>
            </div>

            <div className="grid gap-px border-[var(--border)] border-b bg-[var(--border)] sm:grid-cols-2">
              {[
                "Yjs stores authored cell input.",
                "Durable Objects persist metadata and rooms.",
                "Firebase Auth establishes identity.",
                "The editor renders only the visible grid.",
              ].map((line) => (
                <div
                  className="fluid-micro bg-[rgba(249,252,247,0.95)] px-5 py-5 text-[var(--muted)]"
                  key={line}
                >
                  {line}
                </div>
              ))}
            </div>

            <div className="relative grid gap-px bg-[var(--border)]">
              {[
                {
                  step: "01",
                  title: "Capture",
                  body: "Raw cell input is stored in the shared Yjs map.",
                  Visual: CaptureVisual,
                },
                {
                  step: "02",
                  title: "Evaluate",
                  body: "HyperFormula recomputes off the main thread.",
                  Visual: EvaluateVisual,
                },
                {
                  step: "03",
                  title: "Persist",
                  body: "Room state is kept durable for clean recovery.",
                  Visual: PersistVisual,
                },
              ].map((item) => (
                <div
                  className="group fluid-panel-tight relative grid gap-4 bg-[rgba(248,252,246,0.94)] transition-colors duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[#ffffff] sm:grid-cols-[auto_1fr_auto] sm:items-center"
                  key={item.step}
                >
                  <div className="absolute inset-y-0 left-0 w-[2px] scale-y-0 bg-[var(--accent)] opacity-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-y-100 group-hover:opacity-100" />

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--border-strong)] bg-[var(--panel)] font-mono text-[var(--muted)] text-sm uppercase transition-colors duration-500 group-hover:border-[var(--accent)] group-hover:bg-[rgba(190,214,181,0.1)] group-hover:text-[var(--accent)]">
                    {item.step}
                  </div>
                  <div className="pr-4">
                    <h2 className="fluid-title text-[var(--foreground)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1">
                      {item.title}
                    </h2>
                    <p className="fluid-micro mt-1.5 max-w-lg text-[var(--muted)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1">
                      {item.body}
                    </p>
                  </div>
                  <div className="hidden rounded-xl shadow-sm ring-1 ring-black/5 sm:block">
                    <item.Visual />
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

function CaptureVisual() {
  const cells = [
    "cell-1",
    "cell-2",
    "cell-3",
    "cell-4",
    "cell-5",
    "cell-6",
    "cell-7",
    "cell-8",
    "cell-9",
  ] as const;

  return (
    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--panel)] transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 group-hover:border-[rgba(90,141,115,0.4)] group-hover:shadow-[0_8px_24px_-6px_rgba(23,50,39,0.12)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(190,214,181,0.4),transparent_70%)] opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
      <div className="grid grid-cols-3 gap-[3px] p-[3px]">
        {cells.map((cell, index) => (
          <div
            className={`h-1.5 w-1.5 rounded-[1px] border border-[var(--border-strong)] transition-all duration-500 ${
              index === 4
                ? "border-[var(--accent)] bg-[var(--accent)] shadow-[0_0_8px_rgba(90,141,115,0.6)] group-hover:scale-125"
                : "bg-transparent group-hover:border-[rgba(90,141,115,0.3)]"
            }`}
            key={cell}
          />
        ))}
      </div>
    </div>
  );
}

function EvaluateVisual() {
  return (
    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--panel)] transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 group-hover:border-[rgba(90,141,115,0.4)] group-hover:shadow-[0_8px_24px_-6px_rgba(23,50,39,0.12)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(190,214,181,0.4),transparent_70%)] opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
      <div className="relative h-6 w-6">
        <div className="absolute top-0 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full border border-[var(--border-strong)] transition-all duration-500 group-hover:scale-110 group-hover:border-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:shadow-[0_0_8px_rgba(90,141,115,0.5)]" />
        <div className="absolute bottom-0 left-0 h-2 w-2 rounded-full border border-[var(--border-strong)] transition-all duration-500 group-hover:border-[var(--accent)]" />
        <div className="absolute right-0 bottom-0 h-2 w-2 rounded-full border border-[var(--border-strong)] transition-all delay-100 duration-500 group-hover:scale-110 group-hover:border-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:shadow-[0_0_8px_rgba(90,141,115,0.5)]" />
        <div className="absolute top-[10px] left-[10px] h-3 w-[1px] -rotate-[35deg] bg-[var(--border-strong)] transition-colors duration-500 group-hover:bg-[var(--accent)]" />
        <div className="absolute top-[10px] right-[10px] h-3 w-[1px] rotate-[35deg] bg-[var(--border-strong)] transition-colors duration-500 group-hover:bg-[var(--accent)]" />
      </div>
    </div>
  );
}

function PersistVisual() {
  return (
    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--panel)] transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 group-hover:border-[rgba(90,141,115,0.4)] group-hover:shadow-[0_8px_24px_-6px_rgba(23,50,39,0.12)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(190,214,181,0.4),transparent_70%)] opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
      <div className="relative flex flex-col items-center justify-center gap-[3px]">
        <div className="h-1.5 w-6 rounded-[2px] border border-[var(--border-strong)] bg-transparent transition-all duration-500 group-hover:-translate-y-0.5 group-hover:border-[var(--accent)] group-hover:bg-[rgba(190,214,181,0.15)]" />
        <div className="h-1.5 w-6 rounded-[2px] border border-[var(--border-strong)] bg-transparent transition-all delay-75 duration-500 group-hover:border-[var(--accent)] group-hover:bg-[rgba(190,214,181,0.35)]" />
        <div className="h-1.5 w-6 rounded-[2px] border border-[var(--border-strong)] bg-transparent transition-all delay-150 duration-500 group-hover:translate-y-0.5 group-hover:border-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:shadow-[0_2px_8px_rgba(90,141,115,0.5)]" />
      </div>
    </div>
  );
}
