export interface PresenceState {
  activeCell?: string;
  color: string;
  displayName: string;
  selection?: {
    end: string;
    start: string;
  };
  userId: string;
}

export type CollaborationStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline";

export interface CollaborationPresenceSnapshot {
  activeCell: string | null;
  lastRemoteLatencyMs: number | null;
  peers: PresenceState[];
  status: CollaborationStatus;
}

export interface CollaborationRoom {
  documentId: string;
  roomId: string;
}
