import { NextResponse } from "next/server";
import {
  createDocumentOnServer,
  listDocumentsFromServer,
} from "@/lib/instantdb/server-metadata-store";
import type { SessionIdentity } from "@/types/metadata";

export const runtime = "nodejs";

export async function GET() {
  const documents = await listDocumentsFromServer();
  return NextResponse.json(documents);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    draft?: {
      title?: string;
    };
    owner: SessionIdentity;
  };
  const document = await createDocumentOnServer(body.owner, body.draft);

  return NextResponse.json(document, {
    status: 201,
  });
}
