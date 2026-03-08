import { DocumentShell } from "@/features/documents/document-shell";

interface DocumentPageProps {
  params: Promise<{
    documentId: string;
  }>;
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { documentId } = await params;

  return <DocumentShell documentId={documentId} />;
}
