import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DocumentMeta, SessionIdentity, UserMeta } from "@/types/metadata";

interface DocumentDraft {
  title?: string;
}

interface MetadataStoreShape {
  documents: DocumentMeta[];
  users: UserMeta[];
}

const DEFAULT_METADATA: MetadataStoreShape = {
  documents: [],
  users: [],
};
const METADATA_FILE_PATH = path.join(
  process.cwd(),
  ".data",
  "metadata-store.json"
);

async function ensureMetadataDirectory() {
  await mkdir(path.dirname(METADATA_FILE_PATH), {
    recursive: true,
  });
}

async function readMetadataStore(): Promise<MetadataStoreShape> {
  try {
    const rawValue = await readFile(METADATA_FILE_PATH, "utf8");
    const parsed = JSON.parse(rawValue) as Partial<MetadataStoreShape>;

    return {
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      users: Array.isArray(parsed.users) ? parsed.users : [],
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return DEFAULT_METADATA;
    }

    throw error;
  }
}

async function writeMetadataStore(store: MetadataStoreShape) {
  await ensureMetadataDirectory();
  await writeFile(METADATA_FILE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function createDocumentTitle() {
  const stamp = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  return `Untitled sheet ${stamp}`;
}

export async function listDocumentsFromServer() {
  const store = await readMetadataStore();

  return store.documents.toSorted(
    (left, right) => right.lastModifiedAt - left.lastModifiedAt
  );
}

export async function getDocumentByIdFromServer(documentId: string) {
  const documents = await listDocumentsFromServer();

  return documents.find((document) => document.id === documentId) ?? null;
}

export async function createDocumentOnServer(
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
  const store = await readMetadataStore();

  await writeMetadataStore({
    ...store,
    documents: [document, ...store.documents],
    users: [
      ...store.users.filter((entry) => entry.id !== owner.userId),
      {
        color: owner.color,
        displayName: owner.displayName,
        id: owner.userId,
      },
    ],
  });

  return document;
}

export async function renameDocumentOnServer(
  documentId: string,
  title: string
) {
  const store = await readMetadataStore();
  const nextDocuments = store.documents.map((document) =>
    document.id === documentId
      ? {
          ...document,
          lastModifiedAt: Date.now(),
          title: title.trim() || document.title,
        }
      : document
  );

  await writeMetadataStore({
    ...store,
    documents: nextDocuments,
  });

  return nextDocuments.find((document) => document.id === documentId) ?? null;
}

export async function touchDocumentOnServer(documentId: string) {
  const store = await readMetadataStore();
  const nextDocuments = store.documents.map((document) =>
    document.id === documentId
      ? {
          ...document,
          lastModifiedAt: Date.now(),
        }
      : document
  );

  await writeMetadataStore({
    ...store,
    documents: nextDocuments,
  });

  return nextDocuments.find((document) => document.id === documentId) ?? null;
}

export async function upsertUserMetaOnServer(user: UserMeta) {
  const store = await readMetadataStore();

  await writeMetadataStore({
    ...store,
    users: [...store.users.filter((entry) => entry.id !== user.id), user],
  });
}
