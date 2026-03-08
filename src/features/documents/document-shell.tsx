"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { CollaboratorBar } from "@/features/documents/collaborator-bar";
import { VirtualizedSheet } from "@/features/spreadsheet/virtualized-sheet";
import { getDocumentById } from "@/lib/metadata/metadata-store";
import type { CollaborationPresenceSnapshot } from "@/types/collaboration";
import type { DocumentMeta } from "@/types/metadata";
import type { WriteState } from "@/types/ui";

const SPREADSHEET_ICON_CELLS = [
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

const DEFAULT_COLLABORATION_SNAPSHOT: CollaborationPresenceSnapshot = {
  activeCell: null,
  lastRemoteLatencyMs: null,
  peers: [],
  status: "idle",
};

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
  const [collaboration, setCollaboration] =
    useState<CollaborationPresenceSnapshot>(DEFAULT_COLLABORATION_SNAPSHOT);

  useEffect(() => {
    let isCancelled = false;

    const loadDocument = async () => {
      const nextDocument = await getDocumentById(documentId);

      if (!isCancelled) {
        setCollaboration(DEFAULT_COLLABORATION_SNAPSHOT);
        setDocument(nextDocument);
        setIsLoading(false);
      }
    };

    loadDocument().catch(() => {
      if (!isCancelled) {
        setDocument(null);
        setIsLoading(false);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [documentId]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,_rgba(255,255,255,0.52),transparent_24%),var(--background)] px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-5xl border border-[var(--border-strong)] bg-[var(--panel)] px-6 py-8 text-[var(--muted)] shadow-[0_18px_48px_rgba(23,50,39,0.08)]">
          Loading document metadata...
        </div>
      </main>
    );
  }

  if (!document) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,_rgba(255,255,255,0.52),transparent_24%),var(--background)] px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-5xl border border-[var(--border-strong)] bg-[var(--panel)] px-6 py-8 shadow-[0_18px_48px_rgba(23,50,39,0.08)]">
          <p className="text-[1.15rem]">Document not found</p>
          <p className="mt-2 text-[var(--muted)] leading-7">
            Create a document from the dashboard first, then come back here to
            continue with the editor phases.
          </p>
          <Link
            className="mt-5 inline-flex items-center justify-center border border-[var(--accent)] bg-[var(--accent)] px-5 py-3 text-[0.78rem] text-white uppercase tracking-[0.18em]"
            href="/dashboard"
          >
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen overflow-hidden bg-[#f8f9fa]">
      <div className="flex h-full w-full flex-col">
        <header className="relative z-40 overflow-visible border-[#e0e0e0] border-b bg-[linear-gradient(180deg,#ffffff,rgba(255,255,255,0.96))] px-3 py-2 shadow-[0_1px_0_rgba(60,64,67,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#0f9d58]">
                <div className="grid h-4 w-4 grid-cols-3 grid-rows-3 gap-[1px]">
                  {SPREADSHEET_ICON_CELLS.map((cell) => (
                    <span className="bg-white/90" key={cell} />
                  ))}
                </div>
              </div>
              <div className="min-w-0">
                <h1 className="truncate font-normal text-[#202124] text-[1.125rem] leading-tight tracking-[-0.01em]">
                  {document.title}
                </h1>
                <p className="truncate text-[#5f6368] text-[0.6875rem] leading-4">
                  {document.ownerName} ·{" "}
                  {formatTimestamp(document.lastModifiedAt)}
                </p>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
              <CollaboratorBar
                collaboration={collaboration}
                session={session}
              />
              <span className="hidden h-8 items-center border border-[#dadce0] bg-[#f8f9fa] px-3 font-medium text-[#5f6368] text-[0.6875rem] leading-none sm:inline-flex">
                {formatWriteState(writeState)}
              </span>
              <Link
                className="inline-flex h-8 items-center justify-center border border-[#dadce0] bg-[#f8f9fa] px-4 font-medium text-[#3c4043] text-[0.6875rem] leading-none transition-colors hover:bg-[#eef3fd] hover:text-[#1a73e8]"
                href="/dashboard"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1">
          <VirtualizedSheet
            document={document}
            onCollaborationSnapshotChange={setCollaboration}
            onDocumentUpdated={setDocument}
            onWriteStateChange={setWriteState}
            session={session}
          />
        </div>
      </div>
    </main>
  );
}
