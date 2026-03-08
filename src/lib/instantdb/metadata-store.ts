"use client";

import { isInstantConfigured } from "@/lib/instantdb/client";
import type { DocumentMeta, SessionIdentity, UserMeta } from "@/types/metadata";

const METADATA_POLL_INTERVAL_MS = 2000;

interface DocumentDraft {
  title?: string;
}

function notifyMetadataChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent("pebbles:metadata-changed"));
}

async function parseJsonResponse<T>(response: Response) {
  if (!response.ok) {
    throw new Error(`Metadata request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function requestMetadata<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  return parseJsonResponse<T>(response);
}

export function getMetadataDriverLabel() {
  return isInstantConfigured()
    ? "shared-file-api (instant configured)"
    : "shared-file-api";
}

export function listDocuments() {
  return requestMetadata<DocumentMeta[]>("/api/metadata/documents");
}

export async function getDocumentById(documentId: string) {
  const response = await fetch(`/api/metadata/documents/${documentId}`, {
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  return parseJsonResponse<DocumentMeta>(response);
}

export async function createDocument(
  owner: SessionIdentity,
  draft: DocumentDraft = {}
) {
  const document = await requestMetadata<DocumentMeta>(
    "/api/metadata/documents",
    {
      body: JSON.stringify({
        draft,
        owner,
      }),
      method: "POST",
    }
  );

  notifyMetadataChanged();
  return document;
}

export async function renameDocument(documentId: string, title: string) {
  const document = await requestMetadata<DocumentMeta>(
    `/api/metadata/documents/${documentId}`,
    {
      body: JSON.stringify({
        title,
      }),
      method: "PATCH",
    }
  );

  notifyMetadataChanged();
  return document;
}

export async function touchDocument(documentId: string) {
  const document = await requestMetadata<DocumentMeta>(
    `/api/metadata/documents/${documentId}`,
    {
      body: JSON.stringify({
        touch: true,
      }),
      method: "PATCH",
    }
  );

  notifyMetadataChanged();
  return document;
}

export async function upsertUserMeta(user: UserMeta) {
  await requestMetadata<{ ok: true }>("/api/metadata/users", {
    body: JSON.stringify(user),
    method: "POST",
  });
}

export function subscribeToMetadataChanges(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const intervalId = window.setInterval(() => {
    callback();
  }, METADATA_POLL_INTERVAL_MS);
  const handleCustomEvent = () => {
    callback();
  };

  window.addEventListener("pebbles:metadata-changed", handleCustomEvent);

  return () => {
    window.clearInterval(intervalId);
    window.removeEventListener("pebbles:metadata-changed", handleCustomEvent);
  };
}
