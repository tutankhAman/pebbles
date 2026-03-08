"use client";

import { isInstantConfigured } from "@/lib/instantdb/client";
import type { DocumentMeta, SessionIdentity, UserMeta } from "@/types/metadata";

const DOCUMENTS_STORAGE_KEY = "pebbles:documents";
const USERS_STORAGE_KEY = "pebbles:users";

interface DocumentDraft {
  title?: string;
}

function canUseStorage() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function readCollection<T>(storageKey: string) {
  if (!canUseStorage()) {
    return [];
  }

  const rawValue = window.localStorage.getItem(storageKey);

  if (!rawValue) {
    return [];
  }

  try {
    return JSON.parse(rawValue) as T[];
  } catch {
    return [];
  }
}

function writeCollection<T>(storageKey: string, records: T[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(records));
}

function notifyMetadataChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent("pebbles:metadata-changed"));
}

function createDocumentTitle() {
  const stamp = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  return `Untitled sheet ${stamp}`;
}

export function getMetadataDriverLabel() {
  return isInstantConfigured()
    ? "local-fallback (instant configured)"
    : "local-fallback";
}

export function listDocuments() {
  const documents = readCollection<DocumentMeta>(DOCUMENTS_STORAGE_KEY);
  return documents.toSorted(
    (left, right) => right.lastModifiedAt - left.lastModifiedAt
  );
}

export function getDocumentById(documentId: string) {
  const documents = listDocuments();
  return documents.find((document) => document.id === documentId) ?? null;
}

export function createDocument(
  owner: SessionIdentity,
  draft: DocumentDraft = {}
) {
  const now = Date.now();
  const document: DocumentMeta = {
    createdAt: now,
    id: crypto.randomUUID(),
    lastModifiedAt: now,
    ownerId: owner.userId,
    ownerName: owner.displayName,
    roomId: crypto.randomUUID(),
    title: draft.title?.trim() || createDocumentTitle(),
  };

  const documents = listDocuments();
  writeCollection(DOCUMENTS_STORAGE_KEY, [document, ...documents]);
  upsertUserMeta({
    color: owner.color,
    displayName: owner.displayName,
    id: owner.userId,
  });
  notifyMetadataChanged();
  return document;
}

export function renameDocument(documentId: string, title: string) {
  const documents = listDocuments();
  const nextDocuments = documents.map((document) =>
    document.id === documentId
      ? {
          ...document,
          lastModifiedAt: Date.now(),
          title: title.trim() || document.title,
        }
      : document
  );

  writeCollection(DOCUMENTS_STORAGE_KEY, nextDocuments);
  notifyMetadataChanged();
  return nextDocuments.find((document) => document.id === documentId) ?? null;
}

export function touchDocument(documentId: string) {
  const documents = listDocuments();
  const nextDocuments = documents.map((document) =>
    document.id === documentId
      ? {
          ...document,
          lastModifiedAt: Date.now(),
        }
      : document
  );

  writeCollection(DOCUMENTS_STORAGE_KEY, nextDocuments);
  notifyMetadataChanged();
  return nextDocuments.find((document) => document.id === documentId) ?? null;
}

export function upsertUserMeta(user: UserMeta) {
  const users = readCollection<UserMeta>(USERS_STORAGE_KEY);
  const withoutCurrent = users.filter((entry) => entry.id !== user.id);
  writeCollection(USERS_STORAGE_KEY, [...withoutCurrent, user]);
}

export function subscribeToMetadataChanges(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === DOCUMENTS_STORAGE_KEY ||
      event.key === USERS_STORAGE_KEY ||
      event.key === null
    ) {
      callback();
    }
  };

  const handleCustomEvent = () => {
    callback();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener("pebbles:metadata-changed", handleCustomEvent);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("pebbles:metadata-changed", handleCustomEvent);
  };
}
