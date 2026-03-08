import { NextResponse } from "next/server";
import { upsertUserMetaOnServer } from "@/lib/instantdb/server-metadata-store";
import type { UserMeta } from "@/types/metadata";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = (await request.json()) as UserMeta;

  await upsertUserMetaOnServer(user);

  return NextResponse.json(
    {
      ok: true,
    },
    {
      status: 201,
    }
  );
}
