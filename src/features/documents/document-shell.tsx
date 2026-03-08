"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { VirtualizedSheet } from "@/features/spreadsheet/virtualized-sheet";
import { getDocumentById } from "@/lib/instantdb/metadata-store";
import type { DocumentMeta } from "@/types/metadata";
import type { WriteState } from "@/types/ui";

function formatTimestamp(value: number) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatWriteState(writeState: WriteState) {
  switch (writeState) {
    case "saving":
      return "Saving...";
    case "saved":
      return "Saved";
    case "reconnecting":
      return "Reconnecting...";
    case "offline":
      return "Offline";
    default:
      return "Idle";
  }
}

export function DocumentShell({ documentId }: { documentId: string }) {
  const { session } = useAuth();
  const [document, setDocument] = useState<DocumentMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [writeState, setWriteState] = useState<WriteState>("idle");

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
    <main className="h-screen overflow-hidden bg-[linear-gradient(180deg,_rgba(241,245,248,1),_rgba(249,248,245,1))] p-3 sm:p-4">
      <div className="flex h-full w-full flex-col gap-3">
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
              saving state: {formatWriteState(writeState).toLowerCase()}
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

        <div className="min-h-0 flex-1">
          <VirtualizedSheet
            document={document}
            onWriteStateChange={setWriteState}
          />
        </div>
      </div>
    </main>
  );
}
