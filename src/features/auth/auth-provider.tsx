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
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-[rgba(19,34,26,0.22)] p-4 backdrop-blur-md sm:p-6">
      <div className="relative w-full max-w-5xl overflow-hidden border border-[var(--border-strong)] bg-[linear-gradient(135deg,rgba(248,252,246,0.98),rgba(233,244,231,0.96))] shadow-[0_34px_120px_rgba(23,50,39,0.18)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(23,50,39,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(23,50,39,0.05)_1px,transparent_1px)] bg-[size:88px_88px] opacity-40" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(128,239,128,0.3),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(190,214,181,0.48),transparent_26%)]" />

        <div className="relative grid lg:grid-cols-[1.15fr_0.85fr]">
          <section className="flex flex-col justify-between border-[var(--border)] border-b px-7 py-8 sm:px-10 sm:py-10 lg:min-h-[38rem] lg:border-r lg:border-b-0 lg:px-14 lg:py-14">
            <div className="space-y-10">
              <div className="flex flex-wrap items-center gap-3 text-[0.72rem] text-[var(--muted)] uppercase tracking-[0.28em]">
                <span className="border border-[var(--border-strong)] px-3 py-2 text-[var(--foreground)]">
                  Session setup
                </span>
                <span>Identity before collaboration</span>
              </div>

              <div className="space-y-6">
                <h2 className="max-w-2xl text-4xl leading-[0.96] sm:text-5xl">
                  Enter Pebbles with a stable identity the room can trust.
                </h2>
                <p className="max-w-2xl text-[0.95rem] text-[var(--muted)] leading-8 sm:text-[1rem]">
                  Presence indicators, collaborator state, and durable document
                  joins all depend on a real session identity. Continue with
                  Google for account-backed access or define a guest name that
                  stays consistent in this browser.
                </p>
              </div>
            </div>

            <div className="mt-12 grid gap-px border border-[var(--border)] bg-[var(--border)] text-sm sm:grid-cols-3">
              {[
                {
                  detail:
                    "Selections, cursor color, and write indicators resolve against a known collaborator.",
                  label: "Presence",
                  value: "Named participation",
                },
                {
                  detail:
                    "Guest sessions remain cached locally so refreshes and repeat joins stay coherent.",
                  label: "Recovery",
                  value: "Browser-local continuity",
                },
                {
                  detail:
                    "Choosing identity before entry keeps every room join attributable from the first edit.",
                  label: "Rooms",
                  value: "Reliable collaboration",
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
          </section>

          <section className="bg-[linear-gradient(180deg,rgba(228,239,226,0.82),rgba(248,252,246,0.96))] px-7 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
            <div className="border border-[var(--border-strong)] bg-[rgba(248,252,246,0.9)] shadow-[0_20px_60px_rgba(23,50,39,0.08)]">
              <div className="border-[var(--border)] border-b px-6 py-5 sm:px-8">
                <p className="text-[0.68rem] text-[var(--muted)] uppercase tracking-[0.24em]">
                  Access
                </p>
                <h3 className="mt-3 text-2xl leading-tight">
                  Pick how this browser should appear in collaborative rooms.
                </h3>
              </div>

              <div className="space-y-6 px-6 py-6 sm:px-8 sm:py-8">
                <div className="space-y-3">
                  <p className="text-[0.68rem] text-[var(--muted)] uppercase tracking-[0.24em]">
                    Guest access
                  </p>
                  <label className="block" htmlFor={formId}>
                    <span className="sr-only">Guest display name</span>
                    <input
                      className="w-full border border-[var(--border)] bg-white px-5 py-4 text-[15px] outline-none transition-colors placeholder:text-[var(--muted)]/70 focus:border-[var(--accent)]"
                      id={formId}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="Ada Lovelace"
                      value={displayName}
                    />
                  </label>
                  <p className="text-[0.8rem] text-[var(--muted)] leading-6">
                    Use a clear name so selections, edits, and presence badges
                    remain readable to everyone in the sheet.
                  </p>
                </div>

                <button
                  className="inline-flex min-h-14 w-full items-center justify-center border border-[var(--accent)] bg-[var(--accent)] px-5 text-sm text-white uppercase tracking-[0.22em] transition-colors hover:bg-transparent hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
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
                  <span className="text-[0.64rem] text-[var(--muted)] uppercase tracking-[0.22em]">
                    or
                  </span>
                  <div className="h-px flex-1 bg-[var(--border)]" />
                </div>

                <button
                  className="inline-flex min-h-14 w-full items-center justify-center border border-[var(--border-strong)] bg-[rgba(255,255,255,0.78)] px-5 text-[var(--foreground)] text-sm uppercase tracking-[0.22em] transition-colors hover:border-[var(--foreground)] hover:bg-[rgba(255,255,255,0.98)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!isConfigured || isPending}
                  onClick={signInWithGoogle}
                  type="button"
                >
                  {isConfigured
                    ? "Sign in with Google"
                    : "Google sign-in unavailable"}
                </button>

                <div className="border border-[var(--border)] bg-[rgba(255,255,255,0.56)] px-5 py-4">
                  <p className="text-[0.78rem] text-[var(--muted)] leading-6">
                    Direct document joins stay blocked until identity is
                    selected, so every room session starts with a real
                    collaborator attached to it.
                  </p>
                </div>

                {errorMessage ? (
                  <p className="border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900 text-sm leading-6">
                    {errorMessage}
                  </p>
                ) : null}
              </div>
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
