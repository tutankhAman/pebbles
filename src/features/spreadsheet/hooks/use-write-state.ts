import { useEffect, useRef, useState } from "react";
import { getWriteStateAfterEvent } from "@/features/spreadsheet/interaction";
import type { WriteState } from "@/types/ui";

const WRITE_CONFIRMATION_DELAY_MS = 180;
const RECONNECT_SETTLE_DELAY_MS = 220;

export function useWriteState(args: {
  onWriteStateChange?: (writeState: WriteState) => void;
}) {
  const [writeState, setWriteState] = useState<WriteState>("idle");
  const writeStateRef = useRef<WriteState>("idle");
  const commitTimerRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  const setNextWriteState = (nextWriteState: WriteState) => {
    writeStateRef.current = nextWriteState;
    setWriteState(nextWriteState);
    args.onWriteStateChange?.(nextWriteState);
  };

  const emitWriteEvent = (
    event:
      | "flush-confirmed"
      | "flush-queued"
      | "network-offline"
      | "network-online"
  ) => {
    setNextWriteState(getWriteStateAfterEvent(writeStateRef.current, event));
  };

  const scheduleWriteConfirmation = () => {
    emitWriteEvent("flush-queued");

    if (typeof window === "undefined") {
      return;
    }

    if (commitTimerRef.current !== null) {
      window.clearTimeout(commitTimerRef.current);
    }

    commitTimerRef.current = window.setTimeout(() => {
      commitTimerRef.current = null;
      emitWriteEvent("flush-confirmed");
    }, WRITE_CONFIRMATION_DELAY_MS);
  };

  useEffect(() => {
    args.onWriteStateChange?.("idle");
  }, [args.onWriteStateChange]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateWriteState = (nextWriteState: WriteState) => {
      writeStateRef.current = nextWriteState;
      setWriteState(nextWriteState);
      args.onWriteStateChange?.(nextWriteState);
    };

    const handleOffline = () => {
      updateWriteState("offline");
    };

    const handleOnline = () => {
      updateWriteState(
        getWriteStateAfterEvent(writeStateRef.current, "network-online")
      );

      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        updateWriteState(commitTimerRef.current === null ? "saved" : "saving");
      }, RECONNECT_SETTLE_DELAY_MS);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    if (!window.navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);

      if (commitTimerRef.current !== null) {
        window.clearTimeout(commitTimerRef.current);
      }

      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [args.onWriteStateChange]);

  return {
    scheduleWriteConfirmation,
    writeState,
  };
}
