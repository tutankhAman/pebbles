/**
 * MetadataStore Durable Object
 *
 * Single global instance that manages document and user metadata.
 * Uses DO SQLite for persistence (same-thread microsecond reads).
 *
 * Replaces the file-based server-metadata-store.ts.
 */

interface DocumentMeta {
  createdAt: number;
  id: string;
  lastModifiedAt: number;
  ownerId: string;
  ownerName: string;
  roomId: string;
  title: string;
}

interface UserMeta {
  color: string;
  displayName: string;
  email?: string;
  id: string;
}

interface SessionIdentity {
  color: string;
  displayName: string;
  userId: string;
}

interface DocumentDraft {
  title?: string;
}

const DOCUMENT_ID_PATTERN = /^\/documents\/([^/]+)$/;

export class MetadataStore implements DurableObject {
  private initialized = false;
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    this.ensureSchema();

    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    // Route: GET /documents
    if (pathname === "/documents" && method === "GET") {
      return jsonResponse(this.listDocuments());
    }

    // Route: POST /documents
    if (pathname === "/documents" && method === "POST") {
      const body = (await request.json()) as {
        draft?: DocumentDraft;
        owner: SessionIdentity;
      };
      const document = this.createDocument(body.owner, body.draft);
      return jsonResponse(document, 201);
    }

    // Route: GET /documents/:documentId
    const documentMatch = pathname.match(DOCUMENT_ID_PATTERN);

    if (documentMatch && method === "GET") {
      const document = this.getDocumentById(documentMatch[1]);

      if (!document) {
        return jsonResponse({ error: "Document not found" }, 404);
      }

      return jsonResponse(document);
    }

    // Route: PATCH /documents/:documentId
    if (documentMatch && method === "PATCH") {
      const body = (await request.json()) as {
        title?: string;
        touch?: boolean;
      };

      const document = body.touch
        ? this.touchDocument(documentMatch[1])
        : this.renameDocument(documentMatch[1], body.title ?? "");

      if (!document) {
        return jsonResponse({ error: "Document not found" }, 404);
      }

      return jsonResponse(document);
    }

    // Route: POST /users
    if (pathname === "/users" && method === "POST") {
      const user = (await request.json()) as UserMeta;
      this.upsertUser(user);
      return jsonResponse({ ok: true }, 201);
    }

    return jsonResponse({ error: "Not found" }, 404);
  }

  private ensureSchema(): void {
    if (this.initialized) {
      return;
    }

    this.state.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        room_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        owner_name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_modified_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        color TEXT NOT NULL,
        email TEXT
      );
    `);

    this.initialized = true;
  }

  private listDocuments(): DocumentMeta[] {
    const rows = this.state.storage.sql
      .exec(
        "SELECT id, title, room_id, owner_id, owner_name, created_at, last_modified_at FROM documents ORDER BY last_modified_at DESC"
      )
      .toArray();

    return rows.map(rowToDocument);
  }

  private getDocumentById(documentId: string): DocumentMeta | null {
    const rows = this.state.storage.sql
      .exec(
        "SELECT id, title, room_id, owner_id, owner_name, created_at, last_modified_at FROM documents WHERE id = ?",
        documentId
      )
      .toArray();

    return rows.length > 0 ? rowToDocument(rows[0]) : null;
  }

  private createDocument(
    owner: SessionIdentity,
    draft: DocumentDraft = {}
  ): DocumentMeta {
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

    this.state.storage.sql.exec(
      "INSERT INTO documents (id, title, room_id, owner_id, owner_name, created_at, last_modified_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      document.id,
      document.title,
      document.roomId,
      document.ownerId,
      document.ownerName,
      document.createdAt,
      document.lastModifiedAt
    );

    // Upsert the owner as a user
    this.upsertUser({
      color: owner.color,
      displayName: owner.displayName,
      id: owner.userId,
    });

    return document;
  }

  private renameDocument(
    documentId: string,
    title: string
  ): DocumentMeta | null {
    const trimmed = title.trim();

    if (trimmed) {
      const now = Date.now();
      this.state.storage.sql.exec(
        "UPDATE documents SET title = ?, last_modified_at = ? WHERE id = ?",
        trimmed,
        now,
        documentId
      );
    }

    return this.getDocumentById(documentId);
  }

  private touchDocument(documentId: string): DocumentMeta | null {
    const now = Date.now();
    this.state.storage.sql.exec(
      "UPDATE documents SET last_modified_at = ? WHERE id = ?",
      now,
      documentId
    );

    return this.getDocumentById(documentId);
  }

  private upsertUser(user: UserMeta): void {
    this.state.storage.sql.exec(
      "INSERT INTO users (id, display_name, color, email) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, color = excluded.color, email = excluded.email",
      user.id,
      user.displayName,
      user.color,
      user.email ?? null
    );
  }
}

function rowToDocument(row: Record<string, unknown>): DocumentMeta {
  return {
    createdAt: row.created_at as number,
    id: row.id as string,
    lastModifiedAt: row.last_modified_at as number,
    ownerId: row.owner_id as string,
    ownerName: row.owner_name as string,
    roomId: row.room_id as string,
    title: row.title as string,
  };
}

function createDocumentTitle(): string {
  const stamp = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  return `Untitled sheet ${stamp}`;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}
