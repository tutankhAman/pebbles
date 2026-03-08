"use client";

import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import {
  type Auth,
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { hasFirebaseConfig, publicEnv } from "@/lib/env/public";

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;

function createFirebaseApp() {
  if (!hasFirebaseConfig()) {
    return null;
  }

  if (firebaseApp) {
    return firebaseApp;
  }

  firebaseApp =
    getApps()[0] ??
    initializeApp({
      apiKey: publicEnv.firebaseApiKey,
      appId: publicEnv.firebaseAppId,
      authDomain: publicEnv.firebaseAuthDomain,
      measurementId: publicEnv.firebaseMeasurementId,
      messagingSenderId: publicEnv.firebaseMessagingSenderId,
      projectId: publicEnv.firebaseProjectId,
      storageBucket: publicEnv.firebaseStorageBucket,
    });

  return firebaseApp;
}

export function getFirebaseAuthClient() {
  const app = createFirebaseApp();

  if (!app) {
    return null;
  }

  if (!firebaseAuth) {
    firebaseAuth = getAuth(app);
  }

  return firebaseAuth;
}

export function isFirebaseConfigured() {
  return hasFirebaseConfig();
}

export function signInWithGooglePopup() {
  const auth = getFirebaseAuthClient();

  if (!auth) {
    throw new Error("Firebase Auth is not configured.");
  }

  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export async function signOutFirebaseUser() {
  const auth = getFirebaseAuthClient();

  if (!auth) {
    return;
  }

  await signOut(auth);
}
