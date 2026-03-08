"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
  useTransition,
} from "react";
import {
  getFirebaseAuthClient,
  isFirebaseConfigured,
  signInWithGooglePopup,
  signOutFirebaseUser,
} from "@/lib/firebase/client";
import { upsertUserMeta } from "@/lib/instantdb/metadata-store";
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
