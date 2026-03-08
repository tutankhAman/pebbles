import { Hono } from "hono";
import { cors } from "hono/cors";

// biome-ignore lint/performance/noBarrelFile: Wrangler requires DO class re-exports from the entry point
export { CollabDocument } from "./collab-document";
export { MetadataStore } from "./metadata-store";

interface Env {
  ALLOWED_ORIGINS?: string;
  COLLAB_DOCUMENT: DurableObjectNamespace;
  METADATA_STORE: DurableObjectNamespace;
}

const VALID_ROOM_ID_PATTERN = /^[A-Za-z0-9-]{8,128}$/;
const METADATA_STORE_ID = "global";

const app = new Hono<{ Bindings: Env }>();

// CORS middleware — allow Vercel origin + localhost in dev
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const allowed = c.env.ALLOWED_ORIGINS ?? "";
      const origins = allowed
        .split(",")
        .map((o: string) => o.trim())
        .filter(Boolean);

      // Always allow localhost for dev
      if (
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:")
      ) {
        return origin;
      }

      if (origins.includes(origin)) {
        return origin;
      }

      // If no origins configured, allow all (dev mode)
      if (origins.length === 0) {
        return origin;
      }

      return "";
    },
    allowHeaders: ["Content-Type"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    maxAge: 86_400,
  })
);

// Health check
app.get("/", (c) => c.json({ ok: true, service: "pebbles-worker" }));

// --- Metadata routes (proxied to MetadataStore DO) ---

function getMetadataStub(env: Env): DurableObjectStub {
  const id = env.METADATA_STORE.idFromName(METADATA_STORE_ID);
  return env.METADATA_STORE.get(id);
}

app.options("/api/documents", (c) => c.body(null, 204));
app.get("/api/documents", async (c) => {
  const stub = getMetadataStub(c.env);
  const response = await stub.fetch(new Request("http://do/documents"));
  return new Response(response.body, response);
});

app.post("/api/documents", async (c) => {
  const body = await c.req.text();
  const stub = getMetadataStub(c.env);
  const response = await stub.fetch(
    new Request("http://do/documents", {
      body,
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })
  );
  return new Response(response.body, response);
});

app.get("/api/documents/:documentId", async (c) => {
  const { documentId } = c.req.param();
  const stub = getMetadataStub(c.env);
  const response = await stub.fetch(
    new Request(`http://do/documents/${documentId}`)
  );
  return new Response(response.body, response);
});

app.options("/api/documents/:documentId", (c) => c.body(null, 204));
app.patch("/api/documents/:documentId", async (c) => {
  const { documentId } = c.req.param();
  const body = await c.req.text();
  const stub = getMetadataStub(c.env);
  const response = await stub.fetch(
    new Request(`http://do/documents/${documentId}`, {
      body,
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    })
  );
  return new Response(response.body, response);
});

app.delete("/api/documents/:documentId", async (c) => {
  const { documentId } = c.req.param();
  const stub = getMetadataStub(c.env);
  const response = await stub.fetch(
    new Request(`http://do/documents/${documentId}`, {
      method: "DELETE",
    })
  );
  return new Response(response.body, response);
});

app.options("/api/users", (c) => c.body(null, 204));
app.post("/api/users", async (c) => {
  const body = await c.req.text();
  const stub = getMetadataStub(c.env);
  const response = await stub.fetch(
    new Request("http://do/users", {
      body,
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })
  );
  return new Response(response.body, response);
});

// --- WebSocket route (proxied to CollabDocument DO) ---

app.get("/ws/rooms/:roomId", async (c) => {
  const { roomId } = c.req.param();

  if (!VALID_ROOM_ID_PATTERN.test(roomId)) {
    return c.json({ error: "Invalid room ID" }, 400);
  }

  if (c.req.header("Upgrade") !== "websocket") {
    return c.json({ error: "Expected WebSocket upgrade" }, 426);
  }

  const id = c.env.COLLAB_DOCUMENT.idFromName(roomId);
  const stub = c.env.COLLAB_DOCUMENT.get(id, {
    locationHint: "enam",
  });

  // Forward the upgrade request to the DO
  const url = new URL(c.req.url);
  const response = await stub.fetch(
    new Request(url.toString(), {
      headers: c.req.raw.headers,
    })
  );
  return new Response(response.body, response);
});

export default app;
