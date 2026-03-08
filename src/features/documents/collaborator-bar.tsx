"use client";

import { thumbs } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type {
  CollaborationPresenceSnapshot,
  PresenceState,
} from "@/types/collaboration";
import type { SessionIdentity } from "@/types/metadata";

const AVATAR_BACKGROUND_COLORS = [
  "1a73e8",
  "4285f4",
  "34a853",
  "12b5cb",
  "f9ab00",
  "f29900",
  "c5221f",
  "a142f4",
] as const;

interface CollaboratorBarProps {
  collaboration: CollaborationPresenceSnapshot;
  session: SessionIdentity | null;
}

interface CollaboratorSummary {
  activeCell: string | null;
  clientId?: number;
  color: string;
  displayName: string;
  isCurrentUser: boolean;
  presenceKey: string;
  selection?: PresenceState["selection"];
  userId: string;
}

function createAvatarDataUri(seed: string) {
  return createAvatar(thumbs, {
    backgroundColor: [...AVATAR_BACKGROUND_COLORS],
    seed,
  }).toDataUri();
}

function getCollaborationStatusLabel(
  status: CollaborationPresenceSnapshot["status"]
) {
  switch (status) {
    case "connected":
      return "Live";
    case "connecting":
      return "Joining";
    case "reconnecting":
      return "Syncing";
    case "offline":
      return "Offline";
    default:
      return "Idle";
  }
}

function getStatusDotClassName(
  status: CollaborationPresenceSnapshot["status"]
) {
  switch (status) {
    case "connected":
      return "bg-[#1e8e3e]";
    case "offline":
      return "bg-[#d93025]";
    default:
      return "bg-[#1a73e8]";
  }
}

function getSelectedCellLabel(collaborator: CollaboratorSummary) {
  if (collaborator.selection) {
    const { end, start } = collaborator.selection;

    if (start === end) {
      return start;
    }

    return `${start}:${end}`;
  }

  return collaborator.activeCell ?? "No active cell";
}

function createPresenceKey(
  presence: Pick<PresenceState, "clientId" | "userId">,
  prefix: "peer" | "self"
) {
  return `${prefix}:${presence.clientId ?? presence.userId}`;
}

function createCollaboratorList(args: CollaboratorBarProps) {
  const collaboratorKeys = new Set<string>();
  const collaborators: CollaboratorSummary[] = args.session
    ? (() => {
        const presenceKey = createPresenceKey(args.session, "self");
        collaboratorKeys.add(presenceKey);

        return [
          {
            activeCell: args.collaboration.activeCell,
            color: args.session.color,
            displayName: args.session.displayName,
            isCurrentUser: true,
            presenceKey,
            userId: args.session.userId,
          },
        ];
      })()
    : [];

  for (const peer of args.collaboration.peers) {
    const presenceKey = createPresenceKey(peer, "peer");

    if (
      peer.userId.trim() === "" ||
      peer.displayName.trim() === "" ||
      collaboratorKeys.has(presenceKey)
    ) {
      continue;
    }

    collaboratorKeys.add(presenceKey);
    collaborators.push({
      activeCell: peer.activeCell ?? null,
      clientId: peer.clientId,
      color: peer.color,
      displayName: peer.displayName,
      isCurrentUser: false,
      presenceKey,
      selection: peer.selection,
      userId: peer.userId,
    });
  }

  return collaborators;
}

export function CollaboratorBar({
  collaboration,
  session,
}: CollaboratorBarProps) {
  const [openCollaboratorKey, setOpenCollaboratorKey] = useState<string | null>(
    null
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const collaborators = createCollaboratorList({
    collaboration,
    session,
  });
  const statusLabel = getCollaborationStatusLabel(collaboration.status);
  const statusDotClassName = getStatusDotClassName(collaboration.status);

  useEffect(() => {
    if (openCollaboratorKey == null) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpenCollaboratorKey(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenCollaboratorKey(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [openCollaboratorKey]);

  useEffect(() => {
    if (
      openCollaboratorKey &&
      !collaborators.some(
        (collaborator) => collaborator.presenceKey === openCollaboratorKey
      )
    ) {
      setOpenCollaboratorKey(null);
    }
  }, [collaborators, openCollaboratorKey]);

  return (
    <div
      className="relative z-50 flex min-w-0 items-center justify-end gap-2"
      ref={rootRef}
    >
      <div className="hidden h-8 border border-[#dadce0] bg-[#f8f9fa] px-3 font-medium text-[#5f6368] text-[0.6875rem] leading-none md:inline-flex md:items-center md:gap-2">
        <span className={`h-2 w-2 ${statusDotClassName}`} />
        <span>{statusLabel}</span>
      </div>

      <div className="flex h-8 min-w-0 items-center gap-2 border border-[#dadce0] bg-[#f8f9fa] px-2">
        <span className="hidden pl-1 font-medium text-[#3c4043] text-[0.6875rem] leading-none sm:inline">
          {collaborators.length} user{collaborators.length === 1 ? "" : "s"}
        </span>

        <div className="flex min-w-0 items-center overflow-visible pr-1">
          {collaborators.map((collaborator) => {
            const isOpen = collaborator.presenceKey === openCollaboratorKey;
            const selectedCellLabel = getSelectedCellLabel(collaborator);

            return (
              <div
                className="relative -ml-1.5 first:ml-0"
                key={collaborator.presenceKey}
              >
                <button
                  aria-expanded={isOpen}
                  aria-haspopup="dialog"
                  aria-label={`View collaborator details for ${collaborator.displayName}`}
                  className={`relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border bg-white shadow-[0_1px_2px_rgba(60,64,67,0.16)] transition-transform hover:z-10 hover:-translate-y-px focus-visible:z-10 focus-visible:-translate-y-px focus-visible:outline-none ${
                    isOpen ? "z-20 scale-[1.04]" : "z-0"
                  }`}
                  onClick={() => {
                    setOpenCollaboratorKey((currentValue) =>
                      currentValue === collaborator.presenceKey
                        ? null
                        : collaborator.presenceKey
                    );
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                  style={{
                    borderColor: collaborator.color,
                  }}
                  type="button"
                >
                  <Image
                    alt={`${collaborator.displayName} avatar`}
                    className="h-full w-full object-cover"
                    height={24}
                    src={createAvatarDataUri(
                      `${collaborator.userId}:${collaborator.displayName}`
                    )}
                    unoptimized
                    width={24}
                  />
                </button>

                {isOpen ? (
                  <div
                    className="pointer-events-auto absolute top-[calc(100%+0.625rem)] right-0 z-30 w-60 border border-[#dadce0] bg-white p-4 text-left shadow-[0_18px_48px_rgba(60,64,67,0.18)]"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                    }}
                    role="dialog"
                  >
                    <div className="mb-3 flex items-start gap-3">
                      <div
                        className="h-3 w-3"
                        style={{ backgroundColor: collaborator.color }}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[#202124] text-[0.875rem] leading-5">
                          {collaborator.displayName}
                        </p>
                        <p className="text-[#5f6368] text-[0.6875rem] uppercase tracking-[0.16em]">
                          {collaborator.isCurrentUser ? "You" : "Collaborator"}
                        </p>
                      </div>
                    </div>

                    <div className="bg-[#f8f9fa] px-3 py-2.5">
                      <p className="text-[#5f6368] text-[0.625rem] uppercase tracking-[0.18em]">
                        Cell selected
                      </p>
                      <p className="mt-1 font-medium text-[#202124] text-[0.9375rem] leading-5">
                        {selectedCellLabel}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
