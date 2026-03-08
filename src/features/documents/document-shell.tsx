"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { getDocumentById } from "@/lib/instantdb/metadata-store";
import type { DocumentMeta } from "@/types/metadata";

const previewColumns = ["A", "B", "C", "D", "E", "F"] as const;

function formatTimestamp(value: number) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function DocumentShell({ documentId }: { documentId: string }) {
  const { session } = useAuth();
  const [document, setDocument] = useState<DocumentMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    const loadDocument = () => {
      const nextDocument = getDocumentById(documentId);

      if (!isCancelled) {
        setDocument(nextDocument);
        setIsLoading(false);
      }
    };

    loadDocument();

    return () => {
      isCancelled = true;
    };
  }, [documentId]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,_rgba(241,245,248,1),_rgba(249,248,245,1))] px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-5xl rounded-[1.75rem] border border-[var(--border)] bg-white/80 px-6 py-8 text-[var(--muted)] shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
          Loading document metadata...
        </div>
      </main>
    );
  }

  if (!document) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,_rgba(241,245,248,1),_rgba(249,248,245,1))] px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-5xl rounded-[1.75rem] border border-[var(--border)] bg-white/80 px-6 py-8 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
          <p className="font-medium text-lg">Document not found</p>
          <p className="mt-2 text-[var(--muted)] leading-7">
            Create a document from the dashboard first, then come back here to
            continue with the editor phases.
          </p>
          <Link
            className="mt-5 inline-flex items-center justify-center rounded-full bg-[var(--foreground)] px-5 py-3 font-medium text-[var(--background)]"
            href="/dashboard"
          >
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_rgba(241,245,248,1),_rgba(249,248,245,1))] px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <header className="flex flex-col gap-3 rounded-[1.75rem] border border-[var(--border)] bg-white/78 px-5 py-4 shadow-[0_18px_48px_rgba(15,23,42,0.09)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-[0.7rem] text-[var(--accent)] uppercase tracking-[0.28em]">
              Editor skeleton
            </p>
            <h1 className="mt-2 font-semibold text-2xl tracking-tight">
              {document.title}
            </h1>
            <p className="mt-2 max-w-2xl text-[var(--muted)] text-sm leading-6">
              Owner: {document.ownerName} · Last modified:{" "}
              {formatTimestamp(document.lastModifiedAt)} · Room:{" "}
              {document.roomId}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1 font-mono text-[var(--muted)] text-xs">
              saving state: idle
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1 font-mono text-[var(--muted)] text-xs">
              {session ? `viewer: ${session.displayName}` : "viewer: anonymous"}
            </span>
            <Link
              className="inline-flex items-center justify-center rounded-full border border-[var(--border)] px-4 py-2 text-sm"
              href="/dashboard"
            >
              Dashboard
            </Link>
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
                      {rowNumber === 1 && column === "A" ? document.id : ""}
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
