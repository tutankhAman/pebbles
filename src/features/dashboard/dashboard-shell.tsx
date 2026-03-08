"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import {
  createDocument,
  deleteDocument,
  getMetadataDriverLabel,
  listDocuments,
  subscribeToMetadataChanges,
} from "@/lib/metadata/metadata-store";
import type { DocumentMeta } from "@/types/metadata";

function formatTimestamp(value: number) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function EmptyState() {
  return (
    <div className="border border-[var(--border-strong)] border-dashed bg-[rgba(248,252,246,0.72)] px-6 py-12 sm:px-8">
      <p className="text-2xl leading-tight">No documents yet.</p>
      <p className="mt-4 max-w-xl text-[0.86rem] text-[var(--muted)] leading-7">
        Create the first sheet to initialize the metadata layer, document room,
        and editor entry flow. New documents appear here as soon as the metadata
        store acknowledges them.
      </p>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="border border-[var(--border)] bg-[rgba(248,252,246,0.74)] px-6 py-8 text-[0.88rem] text-[var(--muted)] leading-7">
      {label}
    </div>
  );
}

function DocumentsList({
  copiedRoomId,
  deletingDocumentId,
  documents,
  onCopyRoom,
  onDelete,
}: {
  copiedRoomId: string | null;
  deletingDocumentId: string | null;
  documents: DocumentMeta[];
  onCopyRoom: (roomId: string) => void;
  onDelete: (document: DocumentMeta) => void;
}) {
  return (
    <div className="grid gap-px border border-[var(--border)] bg-[var(--border)]">
      {documents.map((document) => {
        const isDeleting = deletingDocumentId === document.id;
        const isCopied = copiedRoomId === document.roomId;

        return (
          <article
            className="grid gap-6 bg-[rgba(249,252,247,0.95)] px-6 py-6 sm:px-8 lg:grid-cols-[1.4fr_0.7fr_0.9fr_auto] lg:items-center"
            key={document.id}
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-2xl leading-tight">{document.title}</p>
                <button
                  className={`border px-3 py-1 text-[0.66rem] uppercase tracking-[0.22em] transition-colors ${
                    isCopied
                      ? "border-[var(--accent)] bg-[rgba(128,239,128,0.12)] text-[var(--foreground)]"
                      : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                  }`}
                  onClick={() => {
                    onCopyRoom(document.roomId);
                  }}
                  type="button"
                >
                  room {document.roomId}
                </button>
              </div>
            </div>

            <div>
              <p className="text-[0.68rem] text-[var(--muted)] uppercase tracking-[0.22em]">
                Owner
              </p>
              <p className="mt-3 text-[0.9rem] leading-6">
                {document.ownerName}
              </p>
            </div>

            <div>
              <p className="text-[0.68rem] text-[var(--muted)] uppercase tracking-[0.22em]">
                Last modified
              </p>
              <p className="mt-3 text-[0.9rem] leading-6">
                {formatTimestamp(document.lastModifiedAt)}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Link
                className="inline-flex min-h-12 items-center justify-center border border-[var(--border-strong)] px-5 text-[0.76rem] text-[var(--foreground)] uppercase tracking-[0.22em] transition-colors hover:border-[var(--accent)] hover:bg-[rgba(128,239,128,0.12)] hover:text-[var(--foreground)]"
                href={`/documents/${document.id}`}
              >
                Open
              </Link>
              <button
                className="inline-flex min-h-12 items-center justify-center border border-[var(--border)] px-5 text-[0.76rem] text-[var(--muted)] uppercase tracking-[0.22em] transition-colors hover:border-[#8b3a3a] hover:bg-[rgba(139,58,58,0.06)] hover:text-[#8b3a3a] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isDeleting}
                onClick={() => {
                  onDelete(document);
                }}
                type="button"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function DashboardShell() {
  const router = useRouter();
  const { authMode, isConfigured, isLoading, isPending, session, signOut } =
    useAuth();
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [documentTitle, setDocumentTitle] = useState("");
  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);
  const [isCreatingDocument, setIsCreatingDocument] = useState(false);
  const [pendingDeleteDocument, setPendingDeleteDocument] =
    useState<DocumentMeta | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!session) {
      setDocuments([]);
      return;
    }

    let ignore = false;

    const loadDocuments = async () => {
      const nextDocuments = await listDocuments();

      if (!ignore) {
        setDocuments(nextDocuments);
      }
    };

    loadDocuments().catch(() => {
      if (!ignore) {
        setDocuments([]);
      }
    });

    const unsubscribe = subscribeToMetadataChanges(() => {
      loadDocuments().catch(() => undefined);
    });

    return () => {
      ignore = true;
      unsubscribe();
    };
  }, [session]);

  useEffect(() => {
    if (!copiedRoomId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopiedRoomId((currentId) =>
        currentId === copiedRoomId ? null : currentId
      );
    }, 1500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copiedRoomId]);

  const identityLabel = session
    ? `${session.displayName} · ${authMode}`
    : "No active session";
  const recentDocument = documents.reduce<DocumentMeta | null>(
    (latest, item) => {
      if (!latest || item.lastModifiedAt > latest.lastModifiedAt) {
        return item;
      }

      return latest;
    },
    null
  );
  const trimmedTitle = documentTitle.trim();

  let content: ReactNode;

  if (isLoading) {
    content = <LoadingState label="Restoring session..." />;
  } else if (!session) {
    content = <LoadingState label="Waiting for identity setup..." />;
  } else if (documents.length === 0) {
    content = <EmptyState />;
  } else {
    content = (
      <DocumentsList
        copiedRoomId={copiedRoomId}
        deletingDocumentId={deletingDocumentId}
        documents={documents}
        onCopyRoom={(roomId) => {
          navigator.clipboard
            .writeText(roomId)
            .then(() => {
              setCopiedRoomId(roomId);
            })
            .catch(() => undefined);
        }}
        onDelete={(document) => {
          setPendingDeleteDocument(document);
        }}
      />
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--background)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(23,50,39,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(23,50,39,0.05)_1px,transparent_1px)] bg-[size:96px_96px] opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-[radial-gradient(circle_at_top_left,rgba(190,214,181,0.52),transparent_34%),radial-gradient(circle_at_78%_18%,rgba(128,239,128,0.24),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.72),transparent)] [animation:drift_14s_ease-in-out_infinite_alternate]" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-[96rem] flex-col justify-center gap-6 px-6 py-8 sm:px-10 sm:py-10 lg:px-16 lg:py-16">
        <nav className="w-full border border-[var(--border-strong)] bg-[rgba(248,252,246,0.84)] shadow-[0_18px_48px_rgba(23,50,39,0.08)] [animation:section-enter_650ms_cubic-bezier(0.16,1,0.3,1)_both]">
          <div className="flex flex-col gap-5 px-6 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                className="inline-flex border border-[var(--border-strong)] px-3 py-2 text-[0.72rem] text-[var(--foreground)] uppercase tracking-[0.28em]"
                href="/"
              >
                Pebbles
              </Link>
              <p className="max-w-md text-[0.72rem] text-[var(--muted)] uppercase tracking-[0.26em]">
                Dashboard workspace
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[0.72rem] text-[var(--muted)] uppercase tracking-[0.22em]">
              <span className="border border-[var(--border)] px-3 py-2">
                driver: {getMetadataDriverLabel()}
              </span>
              <span className="border border-[var(--border)] px-3 py-2">
                auth: {isConfigured ? "configured" : "guest-ready"}
              </span>
              <Link
                className="border border-[var(--border)] px-3 py-2 transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                href="/"
              >
                Home
              </Link>
              {session ? (
                <button
                  className="border border-[var(--border)] px-3 py-2 transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isPending}
                  onClick={() => {
                    signOut().catch(() => undefined);
                  }}
                  type="button"
                >
                  Sign out
                </button>
              ) : null}
            </div>
          </div>
        </nav>

        <div className="grid w-full overflow-hidden border border-[var(--border-strong)] bg-[var(--panel)] shadow-[0_30px_90px_rgba(23,50,39,0.1)] [animation:section-enter_800ms_cubic-bezier(0.16,1,0.3,1)_both] xl:grid-cols-[0.92fr_1.08fr]">
          <section className="flex flex-col justify-between border-[var(--border)] border-b px-6 py-8 sm:px-10 sm:py-10 xl:min-h-[50rem] xl:border-r xl:border-b-0 xl:px-14 xl:py-14">
            <div className="space-y-10">
              <div className="flex flex-wrap items-center gap-3 text-[0.72rem] text-[var(--muted)] uppercase tracking-[0.28em]">
                <span className="border border-[var(--border-strong)] px-3 py-2">
                  Dashboard
                </span>
                <span>Document control surface</span>
              </div>

              <div className="space-y-6">
                <h1 className="max-w-4xl text-5xl leading-[0.94] sm:text-6xl">
                  Create, inspect, and launch collaborative spreadsheet rooms.
                </h1>
                <p className="max-w-2xl text-[0.95rem] text-[var(--muted)] leading-8 sm:text-[1rem]">
                  Metadata-backed sheets, identity, and document launch in one
                  place.
                </p>
              </div>

              <div className="grid gap-px border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2">
                <div className="space-y-3 bg-[rgba(249,252,247,0.94)] px-5 py-5">
                  <p className="text-[0.68rem] text-[var(--muted)] uppercase tracking-[0.22em]">
                    Active identity
                  </p>
                  <div className="flex items-center gap-3">
                    <span
                      className="size-4 border border-[var(--border-strong)]"
                      style={{
                        backgroundColor:
                          session?.color ?? "var(--panel-strong)",
                      }}
                    />
                    <div>
                      <p className="text-[0.94rem] leading-6">
                        {identityLabel}
                      </p>
                      <p className="text-[0.78rem] text-[var(--muted)] leading-6">
                        {session
                          ? `user id: ${session.userId}`
                          : "identity required"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 bg-[rgba(249,252,247,0.94)] px-5 py-5">
                  <p className="text-[0.68rem] text-[var(--muted)] uppercase tracking-[0.22em]">
                    Latest activity
                  </p>
                  <p className="text-[0.94rem] leading-6">
                    {recentDocument
                      ? recentDocument.title
                      : "No collaborative documents yet"}
                  </p>
                  <p className="text-[0.78rem] text-[var(--muted)] leading-6">
                    {recentDocument
                      ? formatTimestamp(recentDocument.lastModifiedAt)
                      : "Create the first room-backed spreadsheet to begin."}
                  </p>
                </div>
              </div>

              <div className="grid gap-px border border-[var(--border)] bg-[var(--border)] text-sm sm:grid-cols-3">
                {[
                  {
                    label: "Store",
                    value: getMetadataDriverLabel(),
                  },
                  {
                    label: "Ownership",
                    value: session ? session.displayName : "Pending identity",
                  },
                  {
                    label: "Documents",
                    value:
                      documents.length === 1
                        ? "1 active document"
                        : `${documents.length} active documents`,
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
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-[linear-gradient(180deg,rgba(228,239,226,0.82),rgba(248,252,246,0.96))] px-6 py-8 sm:px-10 sm:py-10 xl:px-12 xl:py-12">
            <div className="border border-[var(--border-strong)] bg-[rgba(248,252,246,0.9)] shadow-[0_20px_60px_rgba(23,50,39,0.08)]">
              <div className="grid gap-px border-[var(--border)] border-b bg-[var(--border)] lg:grid-cols-[1fr_auto]">
                <div className="space-y-3 bg-[rgba(249,252,247,0.95)] px-6 py-6 sm:px-8">
                  <p className="text-[0.68rem] text-[var(--muted)] uppercase tracking-[0.24em]">
                    Documents
                  </p>
                  <h2 className="text-3xl leading-tight">
                    Metadata-backed sheets ready to open.
                  </h2>
                  <p className="max-w-2xl text-[0.84rem] text-[var(--muted)] leading-7">
                    Open, create, or remove sheets from here.
                  </p>
                </div>

                <div className="flex flex-col justify-center gap-3 bg-[rgba(249,252,247,0.95)] px-6 py-6 sm:px-8">
                  <p className="text-[0.68rem] text-[var(--muted)] uppercase tracking-[0.24em]">
                    Count
                  </p>
                  <p className="text-4xl leading-none">{documents.length}</p>
                </div>
              </div>

              <div className="border-[var(--border)] border-b bg-[rgba(255,255,255,0.56)] px-6 py-6 sm:px-8 sm:py-8">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                  <div className="max-w-xl space-y-3">
                    <p className="text-[0.68rem] text-[var(--muted)] uppercase tracking-[0.24em]">
                      Create document
                    </p>
                    <p className="text-[0.84rem] text-[var(--muted)] leading-7">
                      Create a new sheet and open it immediately.
                    </p>
                  </div>

                  <button
                    className="inline-flex min-h-14 items-center justify-center border border-[var(--accent)] bg-[var(--accent)] px-6 text-sm text-white uppercase tracking-[0.22em] transition-colors hover:bg-transparent hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isCreatingDocument || !session}
                    onClick={() => {
                      if (!session) {
                        return;
                      }

                      setIsCreatingDocument(true);
                      createDocument(session, {
                        title: trimmedTitle,
                      })
                        .then((document) => {
                          setDocumentTitle("");
                          router.push(`/documents/${document.id}`);
                        })
                        .catch(() => undefined)
                        .finally(() => {
                          setIsCreatingDocument(false);
                        });
                    }}
                    type="button"
                  >
                    {isCreatingDocument ? "Creating..." : "Create document"}
                  </button>
                </div>

                <label className="mt-5 block">
                  <span className="text-[0.68rem] text-[var(--muted)] uppercase tracking-[0.24em]">
                    New document title
                  </span>
                  <input
                    className="mt-3 w-full border border-[var(--border)] bg-white px-5 py-4 text-[15px] outline-none transition-colors placeholder:text-[var(--muted)]/70 focus:border-[var(--accent)]"
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setDocumentTitle(event.target.value)
                    }
                    placeholder="Quarterly forecast"
                    value={documentTitle}
                  />
                </label>

                <p className="mt-4 max-w-xl text-[0.78rem] text-[var(--muted)] leading-6">
                  {trimmedTitle
                    ? `Ready to create: ${trimmedTitle}`
                    : "Optional title. The sheet can still be created without one."}
                </p>
              </div>

              {pendingDeleteDocument ? (
                <div className="border-[var(--border)] border-b bg-[rgba(139,58,58,0.04)] px-6 py-6 sm:px-8 sm:py-8">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                    <div className="max-w-2xl space-y-3">
                      <p className="text-[#8b3a3a] text-[0.68rem] uppercase tracking-[0.24em]">
                        Delete sheet
                      </p>
                      <p className="text-[0.9rem] leading-7">
                        Remove{" "}
                        <span className="font-medium">
                          {pendingDeleteDocument.title}
                        </span>{" "}
                        from the available sheets list.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        className="inline-flex min-h-12 items-center justify-center border border-[var(--border)] px-5 text-[0.76rem] text-[var(--foreground)] uppercase tracking-[0.22em] transition-colors hover:border-[var(--foreground)]"
                        onClick={() => {
                          setPendingDeleteDocument(null);
                        }}
                        type="button"
                      >
                        Cancel
                      </button>
                      <button
                        className="inline-flex min-h-12 items-center justify-center border border-[#8b3a3a] bg-[#8b3a3a] px-5 text-[0.76rem] text-white uppercase tracking-[0.22em] transition-colors hover:bg-transparent hover:text-[#8b3a3a] disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={
                          deletingDocumentId === pendingDeleteDocument.id
                        }
                        onClick={() => {
                          const documentId = pendingDeleteDocument.id;

                          setDeletingDocumentId(documentId);
                          deleteDocument(documentId)
                            .then(() => {
                              setPendingDeleteDocument(null);
                            })
                            .catch(() => undefined)
                            .finally(() => {
                              setDeletingDocumentId((currentId) =>
                                currentId === documentId ? null : currentId
                              );
                            });
                        }}
                        type="button"
                      >
                        {deletingDocumentId === pendingDeleteDocument.id
                          ? "Deleting..."
                          : "Confirm delete"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="px-6 py-6 sm:px-8 sm:py-8">{content}</div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
