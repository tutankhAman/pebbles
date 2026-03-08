import { NextResponse } from "next/server";
import {
  getDocumentByIdFromServer,
  renameDocumentOnServer,
  touchDocumentOnServer,
} from "@/lib/instantdb/server-metadata-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      documentId: string;
    }>;
  }
) {
  const { documentId } = await context.params;
  const document = await getDocumentByIdFromServer(documentId);

  if (!document) {
    return NextResponse.json(
      {
        error: "Document not found",
      },
      {
        status: 404,
      }
    );
  }

  return NextResponse.json(document);
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      documentId: string;
    }>;
  }
) {
  const { documentId } = await context.params;
  const body = (await request.json()) as {
    title?: string;
    touch?: boolean;
  };

  const document = body.touch
    ? await touchDocumentOnServer(documentId)
    : await renameDocumentOnServer(documentId, body.title ?? "");

  if (!document) {
    return NextResponse.json(
      {
        error: "Document not found",
      },
      {
        status: 404,
      }
    );
  }

  return NextResponse.json(document);
}
