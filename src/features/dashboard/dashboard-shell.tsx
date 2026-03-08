"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useAuth } from "@/features/auth/auth-provider";
import {
  createDocument,
  getMetadataDriverLabel,
  listDocuments,
  subscribeToMetadataChanges,
} from "@/lib/instantdb/metadata-store";
import type { DocumentMeta } from "@/types/metadata";

function formatTimestamp(value: number) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function EmptyState() {
  return (
    <div className="rounded-[1.75rem] border border-[var(--border)] border-dashed bg-white/60 px-6 py-10 text-center">
      <p className="font-medium text-lg">No documents yet</p>
      <p className="mt-2 text-[var(--muted)] leading-7">
        Create your first spreadsheet document to start wiring the rest of the
        collaboration stack.
      </p>
    </div>
  );
}

function IdentityOnboarding() {
  const {
    errorMessage,
    isConfigured,
    isPending,
    setGuestIdentity,
    signInWithGoogle,
  } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [isSavingGuest, startGuestTransition] = useTransition();

  return (
    <section className="grid gap-6 rounded-[2rem] border border-[var(--border)] bg-white/85 p-6 shadow-[0_18px_48px_rgba(16,24,40,0.1)] backdrop-blur lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-4">
        <p className="font-mono text-[0.72rem] text-[var(--accent)] uppercase tracking-[0.3em]">
          Identity setup
        </p>
        <h2 className="font-semibold text-3xl tracking-tight sm:text-4xl">
          Pick a session identity before you enter the workspace.
        </h2>
        <p className="max-w-xl text-[var(--muted)] leading-8">
          Phase 1 requires a stable display name and session color. You can use
          Google sign-in when Firebase is configured, or continue as a local
          guest for development.
        </p>
      </div>

      <div className="space-y-4 rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-5">
        <label className="block">
          <span className="font-mono text-[0.68rem] text-[var(--muted)] uppercase tracking-[0.24em]">
            Display name
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 outline-none transition-colors focus:border-[var(--accent)]"
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setDisplayName(event.target.value)
            }
            placeholder="Ada Lovelace"
            value={displayName}
          />
        </label>

        <button
          className="inline-flex w-full items-center justify-center rounded-full bg-[var(--foreground)] px-5 py-3 font-medium text-[var(--background)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!displayName.trim() || isSavingGuest}
          onClick={() => {
            startGuestTransition(() => {
              setGuestIdentity(displayName);
            });
          }}
          type="button"
        >
          {isSavingGuest ? "Saving guest identity..." : "Continue as guest"}
        </button>

        <button
          className="inline-flex w-full items-center justify-center rounded-full border border-[var(--border)] bg-white px-5 py-3 font-medium disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!isConfigured || isPending}
          onClick={signInWithGoogle}
          type="button"
        >
          {isConfigured ? "Sign in with Google" : "Google sign-in unavailable"}
        </button>

        {errorMessage ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function DashboardShell() {
  const router = useRouter();
  const { authMode, isConfigured, isLoading, isPending, session, signOut } =
    useAuth();
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [documentTitle, setDocumentTitle] = useState("");
  const [isCreatingDocument, setIsCreatingDocument] = useState(false);

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

  const identityLabel = useMemo(() => {
    if (!session) {
      return "No active session";
    }

    return `${session.displayName} · ${authMode}`;
  }, [authMode, session]);

  let content: ReactNode;

  if (isLoading) {
    content = (
      <div className="rounded-[1.75rem] border border-[var(--border)] bg-white/70 px-6 py-8 text-[var(--muted)]">
        Restoring session...
      </div>
    );
  } else if (!session) {
    content = <IdentityOnboarding />;
  } else if (documents.length === 0) {
    content = <EmptyState />;
  } else {
    content = (
      <div className="grid gap-4">
        {documents.map((document) => (
          <article
            className="grid gap-4 rounded-[1.75rem] border border-[var(--border)] bg-white/80 p-5 shadow-[0_10px_32px_rgba(16,24,40,0.08)] backdrop-blur sm:grid-cols-[1.5fr_0.8fr_0.8fr_auto] sm:items-center"
            key={document.id}
          >
            <div>
              <p className="font-medium text-lg">{document.title}</p>
              <p className="mt-1 font-mono text-[0.7rem] text-[var(--muted)] uppercase tracking-[0.28em]">
                room {document.roomId}
              </p>
            </div>
            <div>
              <p className="font-mono text-[0.68rem] text-[var(--muted)] uppercase tracking-[0.24em]">
                Owner
              </p>
              <p className="mt-2 text-sm">{document.ownerName}</p>
            </div>
            <div>
              <p className="font-mono text-[0.68rem] text-[var(--muted)] uppercase tracking-[0.24em]">
                Last modified
              </p>
              <p className="mt-2 text-sm">
                {formatTimestamp(document.lastModifiedAt)}
              </p>
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
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_rgba(244,243,238,1),_rgba(235,240,244,1))] px-6 py-8 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-6 border-[var(--border)] border-b pb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-mono text-[0.72rem] text-[var(--accent)] uppercase tracking-[0.3em]">
                Dashboard
              </p>
              <h1 className="mt-2 font-semibold text-3xl tracking-tight sm:text-4xl">
                Collaborative documents
              </h1>
              <p className="mt-3 max-w-2xl text-[var(--muted)] leading-7">
                Metadata currently runs through a local fallback store in Phase
                1. The InstantDB boundary is in place and the dashboard fields,
                route contracts, and identity flow are ready for backend
                swap-in.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[var(--border)] bg-white/75 px-3 py-1 font-mono text-[0.7rem] text-[var(--muted)] uppercase tracking-[0.22em] shadow-sm backdrop-blur">
                driver: {getMetadataDriverLabel()}
              </span>
              <span className="rounded-full border border-[var(--border)] bg-white/75 px-3 py-1 font-mono text-[0.7rem] text-[var(--muted)] uppercase tracking-[0.22em] shadow-sm backdrop-blur">
                firebase: {isConfigured ? "configured" : "guest-ready"}
              </span>
            </div>
          </div>

          {session ? (
            <section className="grid gap-4 rounded-[1.75rem] border border-[var(--border)] bg-white/82 p-5 shadow-[0_18px_48px_rgba(16,24,40,0.08)] backdrop-blur lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-3">
                <p className="font-mono text-[0.68rem] text-[var(--muted)] uppercase tracking-[0.24em]">
                  Active identity
                </p>
                <div className="flex items-center gap-3">
                  <span
                    className="size-4 rounded-full"
                    style={{ backgroundColor: session.color }}
                  />
                  <div>
                    <p className="font-medium">{identityLabel}</p>
                    <p className="text-[var(--muted)] text-sm">
                      user id: {session.userId}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="font-mono text-[0.68rem] text-[var(--muted)] uppercase tracking-[0.24em]">
                    New document title
                  </span>
                  <input
                    className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 outline-none transition-colors focus:border-[var(--accent)]"
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setDocumentTitle(event.target.value)
                    }
                    placeholder="Quarterly forecast"
                    value={documentTitle}
                  />
                </label>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    className="inline-flex items-center justify-center rounded-full bg-[var(--foreground)] px-5 py-3 font-medium text-[var(--background)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isCreatingDocument}
                    onClick={() => {
                      setIsCreatingDocument(true);
                      createDocument(session, {
                        title: documentTitle,
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
                  <button
                    className="inline-flex items-center justify-center rounded-full border border-[var(--border)] px-5 py-3 font-medium"
                    disabled={isPending}
                    onClick={() => {
                      signOut().catch(() => undefined);
                    }}
                    type="button"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <div className="mt-8">{content}</div>
      </div>
    </main>
  );
}
