export interface UserMeta {
  color: string;
  displayName: string;
  email?: string;
  id: string;
}

export interface SessionIdentity {
  color: string;
  displayName: string;
  userId: string;
}

export interface DocumentMeta {
  createdAt: number;
  id: string;
  lastModifiedAt: number;
  ownerId: string;
  ownerName: string;
  roomId: string;
  title: string;
}

export interface DocumentAccess {
  documentId: string;
  id: string;
  role: "editor" | "owner" | "viewer";
  userId: string;
}
