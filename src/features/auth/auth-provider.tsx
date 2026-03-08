"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useId,
  useState,
  useTransition,
} from "react";
import {
  getFirebaseAuthClient,
  isFirebaseConfigured,
  signInWithGooglePopup,
  signOutFirebaseUser,
} from "@/lib/firebase/client";
import { upsertUserMeta } from "@/lib/metadata/metadata-store";
import type { SessionIdentity } from "@/types/metadata";

const GUEST_STORAGE_KEY = "pebbles:guest-identity";

interface AuthContextValue {
  authMode: "firebase" | "guest" | "none";
  errorMessage: string | null;
  isConfigured: boolean;
  isLoading: boolean;
  isPending: boolean;
  session: SessionIdentity | null;
  setGuestIdentity: (displayName: string) => void;
  signInWithGoogle: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function AuthOnboardingModal() {
  const formId = useId();
  const {
    errorMessage,
    isConfigured,
    isPending,
    setGuestIdentity,
    signInWithGoogle,
  } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [isSavingGuest, startGuestTransition] = useTransition();

  const isGuestDisabled = !displayName.trim() || isSavingGuest;

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-[rgba(14,22,30,0.32)] p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/55 bg-[linear-gradient(135deg,_rgba(252,252,249,0.98),_rgba(240,246,248,0.95))] shadow-[0_28px_110px_rgba(15,23,42,0.26)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(42,118,130,0.18),_transparent_30%),radial-gradient(circle_at_85%_20%,_rgba(22,33,45,0.12),_transparent_26%)]" />
        <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-5">
            <p className="font-mono text-[0.72rem] text-[var(--accent)] uppercase tracking-[0.32em]">
              Session setup
            </p>
            <div className="space-y-3">
              <h2 className="max-w-xl font-semibold text-3xl tracking-tight sm:text-4xl">
                Choose who you are before you enter the sheet.
              </h2>
              <p className="max-w-xl text-[var(--muted)] leading-8">
                Collaboration, presence colors, and cross-browser room joins all
                depend on a stable identity. Continue with Google or set a guest
                name for this browser session.
              </p>
            </div>
            <div className="grid gap-3 text-[var(--muted)] text-sm sm:grid-cols-2">
              <div className="rounded-[1.35rem] border border-[var(--border)] bg-white/70 px-4 py-4">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.24em]">
                  Presence
                </p>
                <p className="mt-2 leading-6">
                  Your name and color travel with every cursor, selection, and
                  edit acknowledgement.
                </p>
              </div>
              <div className="rounded-[1.35rem] border border-[var(--border)] bg-white/70 px-4 py-4">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.24em]">
                  Recovery
                </p>
                <p className="mt-2 leading-6">
                  Guest identity stays cached locally so refreshes and re-joins
                  remain coherent.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[1.6rem] border border-[var(--border)] bg-white/78 p-5 shadow-[0_16px_42px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="space-y-4">
              <div>
                <p className="font-mono text-[0.68rem] text-[var(--muted)] uppercase tracking-[0.24em]">
                  Guest access
                </p>
                <label className="mt-3 block" htmlFor={formId}>
                  <span className="sr-only">Guest display name</span>
                  <input
                    className="w-full rounded-[1.15rem] border border-[var(--border)] bg-white px-4 py-3 text-[15px] outline-none transition-colors focus:border-[var(--accent)]"
                    id={formId}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Ada Lovelace"
                    value={displayName}
                  />
                </label>
              </div>

              <button
                className="inline-flex w-full items-center justify-center rounded-full bg-[var(--foreground)] px-5 py-3 font-medium text-[var(--background)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                disabled={isGuestDisabled}
                onClick={() => {
                  startGuestTransition(() => {
                    setGuestIdentity(displayName);
                  });
                }}
                type="button"
              >
                {isSavingGuest
                  ? "Saving guest identity..."
                  : "Continue as guest"}
              </button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-[var(--border)]" />
                <span className="font-mono text-[0.64rem] text-[var(--muted)] uppercase tracking-[0.22em]">
                  or
                </span>
                <div className="h-px flex-1 bg-[var(--border)]" />
              </div>

              <button
                className="inline-flex w-full items-center justify-center rounded-full border border-[var(--border)] bg-white px-5 py-3 font-medium transition-colors hover:bg-[var(--panel)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!isConfigured || isPending}
                onClick={signInWithGoogle}
                type="button"
              >
                {isConfigured
                  ? "Sign in with Google"
                  : "Google sign-in unavailable"}
              </button>

              <p className="text-[var(--muted)] text-sm leading-6">
                Direct document links stay blocked until identity is chosen, so
                every room join has a real collaborator attached to it.
              </p>

              {errorMessage ? (
                <p className="rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
                  {errorMessage}
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function hashToColor(seed: string) {
  let total = 0;

  for (const [index, character] of Array.from(seed).entries()) {
    total += character.charCodeAt(0) * (index + 17);
  }

  const hue = total % 360;
  return `hsl(${hue} 62% 46%)`;
}

function buildSessionFromFirebaseUser(user: User): SessionIdentity {
  return {
    color: hashToColor(user.uid),
    displayName:
      user.displayName?.trim() || user.email?.split("@")[0] || "Google user",
    userId: user.uid,
  };
}

function buildGuestSession(displayName: string): SessionIdentity {
  const normalized = displayName.trim();
  const guestId = `guest:${normalized.toLowerCase().replaceAll(/\s+/g, "-")}:${crypto.randomUUID()}`;

  return {
    color: hashToColor(guestId),
    displayName: normalized,
    userId: guestId,
  };
}

function readGuestSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(GUEST_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as SessionIdentity;
  } catch {
    return null;
  }
}

function writeGuestSession(session: SessionIdentity | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(GUEST_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(session));
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<SessionIdentity | null>(null);
  const [authMode, setAuthMode] =
    useState<AuthContextValue["authMode"]>("none");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const auth = getFirebaseAuthClient();

    if (!auth) {
      const guestSession = readGuestSession();
      setSession(guestSession);
      setAuthMode(guestSession ? "guest" : "none");
      if (guestSession) {
        upsertUserMeta({
          color: guestSession.color,
          displayName: guestSession.displayName,
          id: guestSession.userId,
        }).catch(() => undefined);
      }
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const nextSession = buildSessionFromFirebaseUser(user);
        setSession(nextSession);
        setAuthMode("firebase");
        setErrorMessage(null);
        writeGuestSession(null);
        upsertUserMeta({
          color: nextSession.color,
          displayName: nextSession.displayName,
          email: user.email ?? undefined,
          id: nextSession.userId,
        }).catch(() => undefined);
      } else {
        const guestSession = readGuestSession();
        setSession(guestSession);
        setAuthMode(guestSession ? "guest" : "none");
        if (guestSession) {
          upsertUserMeta({
            color: guestSession.color,
            displayName: guestSession.displayName,
            id: guestSession.userId,
          }).catch(() => undefined);
        }
      }

      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  function signInWithGoogle() {
    startTransition(() => {
      signInWithGooglePopup().catch((error: unknown) => {
        setErrorMessage(
          error instanceof Error ? error.message : "Google sign-in failed."
        );
      });
    });
  }

  function setGuestIdentity(displayName: string) {
    const normalized = displayName.trim();

    if (!normalized) {
      return;
    }

    const nextSession = buildGuestSession(normalized);
    writeGuestSession(nextSession);
    setSession(nextSession);
    setAuthMode("guest");
    setErrorMessage(null);
    upsertUserMeta({
      color: nextSession.color,
      displayName: nextSession.displayName,
      id: nextSession.userId,
    }).catch(() => undefined);
  }

  async function signOut() {
    if (authMode === "firebase") {
      await signOutFirebaseUser();
      return;
    }

    writeGuestSession(null);
    setSession(null);
    setAuthMode("none");
  }

  return (
    <AuthContext
      value={{
        authMode,
        errorMessage,
        isConfigured: isFirebaseConfigured(),
        isLoading,
        isPending,
        session,
        setGuestIdentity,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
      {isLoading || session ? null : <AuthOnboardingModal />}
    </AuthContext>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
