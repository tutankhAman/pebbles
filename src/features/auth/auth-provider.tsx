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
    <div className="pointer-events-auto fixed inset-0 z-50 overflow-y-auto bg-[rgba(19,34,26,0.22)] p-3 backdrop-blur-md sm:p-5 lg:p-6">
      <div className="flex min-h-full items-center justify-center">
        <div className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-[min(96vw,90rem)] overflow-hidden border border-[var(--border-strong)] bg-[linear-gradient(135deg,rgba(248,252,246,0.98),rgba(233,244,231,0.96))] shadow-[0_34px_120px_rgba(23,50,39,0.18)] sm:max-h-[calc(100dvh-2.5rem)] lg:max-h-[calc(100dvh-3rem)]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(23,50,39,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(23,50,39,0.05)_1px,transparent_1px)] bg-[size:88px_88px] opacity-40" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(128,239,128,0.3),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(190,214,181,0.48),transparent_26%)]" />

          <div className="relative grid max-h-[inherit] overflow-y-auto xl:grid-cols-[minmax(0,1.1fr)_minmax(24rem,0.9fr)]">
            <section className="fluid-panel hidden min-h-0 flex-col justify-between border-[var(--border)] border-b xl:flex xl:border-r xl:border-b-0">
              <div className="space-y-[clamp(1.75rem,2vw,3rem)]">
                <div className="fluid-overline flex flex-wrap items-center gap-3 text-[var(--muted)] uppercase">
                  <span className="border border-[var(--border-strong)] px-3 py-2 text-[var(--foreground)]">
                    Session setup
                  </span>
                  <span>Identity before collaboration</span>
                </div>

                <div className="space-y-[clamp(1rem,1.2vw,1.5rem)]">
                  <h2 className="fluid-display max-w-3xl">
                    Enter Pebbles with a stable identity the room can trust.
                  </h2>
                  <p className="fluid-body max-w-2xl text-[var(--muted)]">
                    Presence indicators, collaborator state, and durable
                    document joins all depend on a real session identity.
                    Continue with Google for account-backed access or define a
                    guest name that stays consistent in this browser.
                  </p>
                </div>
              </div>

              <div className="mt-[clamp(1.5rem,2.4vw,3.25rem)] grid gap-px border border-[var(--border)] bg-[var(--border)] text-sm sm:grid-cols-3">
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
                    className="space-y-3 bg-[rgba(249,252,247,0.94)] px-[clamp(1rem,1.3vw,1.4rem)] py-[clamp(1rem,1.4vw,1.5rem)]"
                    key={item.label}
                  >
                    <p className="fluid-label text-[var(--muted)] uppercase">
                      {item.label}
                    </p>
                    <p className="fluid-body font-medium text-[var(--foreground)]">
                      {item.value}
                    </p>
                    <p className="fluid-body-tight text-[var(--muted)]">
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="fluid-panel bg-[linear-gradient(180deg,rgba(228,239,226,0.82),rgba(248,252,246,0.96))] px-4 py-4 sm:px-[clamp(1.25rem,1.8vw,2.5rem)] sm:py-[clamp(1.25rem,1.8vw,2.5rem)]">
              <div className="border border-[var(--border-strong)] bg-[rgba(248,252,246,0.9)] shadow-[0_20px_60px_rgba(23,50,39,0.08)]">
                <div className="sm:fluid-panel-tight border-[var(--border)] border-b px-4 py-4">
                  <p className="fluid-label text-[var(--muted)] uppercase">
                    Access
                  </p>
                  <h3 className="sm:fluid-title mt-2 text-[1.1rem] leading-tight sm:mt-3">
                    Pick how this browser should appear in collaborative rooms.
                  </h3>
                  <p className="mt-2 text-[0.8rem] text-[var(--muted)] leading-5 sm:hidden">
                    Add a name or continue with Google.
                  </p>
                </div>

                <div className="sm:fluid-panel-tight space-y-4 px-4 py-4 sm:space-y-[clamp(1rem,1.4vw,1.6rem)]">
                  <div className="space-y-2 sm:space-y-3">
                    <p className="fluid-label hidden text-[var(--muted)] uppercase sm:block">
                      Guest access
                    </p>
                    <label className="block" htmlFor={formId}>
                      <span className="sr-only">Guest display name</span>
                      <input
                        className="fluid-input w-full border border-[var(--border)] bg-white px-[clamp(0.9rem,1.2vw,1.35rem)] py-[clamp(0.8rem,1vw,1rem)] outline-none transition-colors placeholder:text-[var(--muted)]/70 focus:border-[var(--accent)]"
                        id={formId}
                        onChange={(event) => setDisplayName(event.target.value)}
                        placeholder="Ada Lovelace"
                        value={displayName}
                      />
                    </label>
                    <p className="fluid-body-tight hidden text-[var(--muted)] sm:block">
                      Use a clear name so selections, edits, and presence badges
                      remain readable to everyone in the sheet.
                    </p>
                  </div>

                  <button
                    className="fluid-button inline-flex min-h-[clamp(2.9rem,4vw,3.5rem)] w-full items-center justify-center border border-[var(--accent)] bg-[var(--accent)] px-[clamp(1rem,1.25vw,1.4rem)] text-white uppercase transition-colors hover:bg-transparent hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
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
                    <span className="fluid-micro text-[var(--muted)] uppercase">
                      or
                    </span>
                    <div className="h-px flex-1 bg-[var(--border)]" />
                  </div>

                  <button
                    className="fluid-button inline-flex min-h-[clamp(2.9rem,4vw,3.5rem)] w-full items-center justify-center border border-[var(--border-strong)] bg-[rgba(255,255,255,0.78)] px-[clamp(1rem,1.25vw,1.4rem)] text-[var(--foreground)] uppercase transition-colors hover:border-[var(--foreground)] hover:bg-[rgba(255,255,255,0.98)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!isConfigured || isPending}
                    onClick={signInWithGoogle}
                    type="button"
                  >
                    {isConfigured
                      ? "Sign in with Google"
                      : "Google sign-in unavailable"}
                  </button>

                  <div className="hidden border border-[var(--border)] bg-[rgba(255,255,255,0.56)] px-[clamp(1rem,1.2vw,1.35rem)] py-[clamp(0.9rem,1vw,1.15rem)] sm:block">
                    <p className="fluid-body-tight text-[var(--muted)]">
                      Direct document joins stay blocked until identity is
                      selected, so every room session starts with a real
                      collaborator attached to it.
                    </p>
                  </div>

                  {errorMessage ? (
                    <p className="border border-amber-200 bg-amber-50 px-[clamp(1rem,1.2vw,1.35rem)] py-[clamp(0.9rem,1vw,1.15rem)] text-amber-900 text-sm leading-6">
                      {errorMessage}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          </div>
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
