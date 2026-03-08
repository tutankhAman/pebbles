"use client";

import {
  type ClipboardEvent,
  type KeyboardEvent,
  type PointerEvent,
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { useCollaborationRoom } from "@/features/collaboration/use-collaboration-room";
import { useFormulaEngine } from "@/features/formulas/use-formula-engine";
import {
  createCellKey,
  normalizeRange,
  parseCellKey,
} from "@/features/spreadsheet/addressing";
import { getVisibleWindow } from "@/features/spreadsheet/chunks";
import {
  createCellSelection,
  createRangeSelection,
  extendSelection,
  getNavigationDelta,
  getSelectionAnchor,
  getSelectionBounds,
  getSelectionDimensions,
  getWriteStateAfterEvent,
  isPrintableCellInput,
  moveCellAddress,
  parseClipboardMatrix,
  selectionContainsAddress,
  serializeSelectionMatrix,
} from "@/features/spreadsheet/interaction";
import { SparseSheet } from "@/features/spreadsheet/sparse-sheet";
import {
  DEFAULT_SHEET_METRICS,
  getCellAddressFromPoint,
  getCellLayout,
  getColumnHeaderLabel,
  getGridDimensions,
  getViewportFromScroll,
} from "@/features/spreadsheet/viewport";
import { touchDocument } from "@/lib/instantdb/metadata-store";
import type { DocumentMeta, SessionIdentity } from "@/types/metadata";
import type {
  CellAddress,
  CellRecord,
  ComputedValue,
  Selection,
  SheetBounds,
  Viewport,
  VisibleWindow,
} from "@/types/spreadsheet";
import type { EditorMode, WriteState } from "@/types/ui";

const DEFAULT_VIEWPORT_WIDTH = 960;
const DEFAULT_VIEWPORT_HEIGHT = 640;
const DEFAULT_SELECTION: CellAddress = {
  col: 1,
  row: 1,
};
const WRITE_CONFIRMATION_DELAY_MS = 180;
const RECONNECT_SETTLE_DELAY_MS = 220;
type EditorSurface = "cell" | "formula-bar";

function createSeededSheet(document: DocumentMeta) {
  const sheet = new SparseSheet();

  sheet.batchPaste({ col: 1, row: 1 }, [
    [document.title, "Owner", document.ownerName, "Status", "Phase 5"],
    [
      "Room",
      document.roomId.slice(0, 12),
      "Modified",
      new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(document.lastModifiedAt),
      "Type, tab, paste, or drag-select",
    ],
    ["Rows", "10,000", "Columns", "100", "Logical cells", "1,000,000"],
  ]);

  sheet.batchPaste({ col: 1, row: 5 }, [
    ["12", "8", "=A5+B5", "=SUM(A5:B5)", "=SUM(A5,C5)"],
    ["Formula input", "Formula input", "A+B", "SUM range", "SUM args"],
  ]);

  sheet.setCell({ col: 1, row: 128 }, "Checkpoint row 128");
  sheet.setCell({ col: 4, row: 512 }, "Checkpoint row 512");
  sheet.setCell({ col: 6, row: 4096 }, "Sparse far field");
  sheet.setCell({ col: 26, row: 9999 }, "Edge probe");

  return sheet;
}

function getCellDisplayValue(cell: CellRecord | null) {
  return cell?.raw ?? "";
}

function formatComputedValue(value: ComputedValue | undefined) {
  if (value == null) {
    return "";
  }

  return String(value);
}

function getRenderedCellValue(args: {
  cell: CellRecord | null;
  computedValue: ComputedValue | undefined;
  formulaError: string | undefined;
}) {
  if (args.cell?.kind !== "formula") {
    return getCellDisplayValue(args.cell);
  }

  if (args.formulaError) {
    return "#ERROR";
  }

  return formatComputedValue(args.computedValue) || args.cell.raw;
}

function buildSequence(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function getCellKind(raw: string): CellRecord["kind"] {
  if (raw.startsWith("=")) {
    return "formula";
  }

  if (raw.trim() !== "" && Number.isFinite(Number(raw))) {
    return "number";
  }

  return "text";
}

function getSelectionMatrix(sheet: SparseSheet, selection: Selection) {
  const selectionBounds = getSelectionBounds(selection);
  const rows = sheet.readRange(selectionBounds.start, selectionBounds.end);

  return rows.map((row) => row.map((cell) => getCellDisplayValue(cell)));
}

function useVirtualViewport(bounds: SheetBounds) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingScrollRef = useRef({
    scrollX: 0,
    scrollY: 0,
  });
  const [viewport, setViewport] = useState<Viewport>(() =>
    getViewportFromScroll(
      {
        scrollX: 0,
        scrollY: 0,
        viewportHeight: DEFAULT_VIEWPORT_HEIGHT,
        viewportWidth: DEFAULT_VIEWPORT_WIDTH,
      },
      bounds
    )
  );

  useEffect(() => {
    const node = scrollRef.current;

    if (!node) {
      return;
    }

    const updateViewport = (
      nextScrollX: number,
      nextScrollY: number,
      nextWidth: number,
      nextHeight: number
    ) => {
      startTransition(() => {
        setViewport(
          getViewportFromScroll(
            {
              scrollX: nextScrollX,
              scrollY: nextScrollY,
              viewportHeight: nextHeight,
              viewportWidth: nextWidth,
            },
            bounds
          )
        );
      });
    };

    updateViewport(0, 0, node.clientWidth, node.clientHeight);

    const resizeObserver = new ResizeObserver(() => {
      updateViewport(
        pendingScrollRef.current.scrollX,
        pendingScrollRef.current.scrollY,
        node.clientWidth,
        node.clientHeight
      );
    });

    resizeObserver.observe(node);

    return () => {
      resizeObserver.disconnect();

      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [bounds]);

  const handleScroll = () => {
    const node = scrollRef.current;

    if (!node) {
      return;
    }

    pendingScrollRef.current = {
      scrollX: node.scrollLeft,
      scrollY: node.scrollTop,
    };

    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      startTransition(() => {
        setViewport(
          getViewportFromScroll(
            {
              scrollX: pendingScrollRef.current.scrollX,
              scrollY: pendingScrollRef.current.scrollY,
              viewportHeight: node.clientHeight,
              viewportWidth: node.clientWidth,
            },
            bounds
          )
        );
      });
    });
  };

  return {
    handleScroll,
    scrollRef,
    viewport,
  };
}

function formatWriteState(writeState: WriteState) {
  switch (writeState) {
    case "saving":
      return "Saving...";
    case "saved":
      return "Saved";
    case "reconnecting":
      return "Reconnecting...";
    case "offline":
      return "Offline";
    default:
      return "Idle";
  }
}

function getHeaderBackgroundColor(isActive: boolean, isSelected: boolean) {
  if (isActive) {
    return "rgba(42,118,130,0.18)";
  }

  if (isSelected) {
    return "rgba(42,118,130,0.1)";
  }

  return "transparent";
}

function getCellBackgroundColor(isActive: boolean, isSelected: boolean) {
  if (isActive) {
    return "rgba(42,118,130,0.08)";
  }

  if (isSelected) {
    return "rgba(42,118,130,0.04)";
  }

  return "rgba(255,255,255,0.72)";
}

export function VirtualizedSheet({
  document,
  onWriteStateChange,
  session,
}: {
  document: DocumentMeta;
  onWriteStateChange?: (writeState: WriteState) => void;
  session: SessionIdentity | null;
}) {
  const sheetRef = useRef<SparseSheet | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const formulaBarRef = useRef<HTMLInputElement | null>(null);
  const keyboardProxyRef = useRef<HTMLTextAreaElement | null>(null);
  const pointerAnchorRef = useRef<CellAddress | null>(null);
  const isPointerSelectingRef = useRef(false);
  const commitTimerRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const writeStateRef = useRef<WriteState>("idle");
  const [, setSheetRevision] = useState(0);
  const [selection, setSelection] = useState<Selection>(() =>
    createCellSelection(DEFAULT_SELECTION)
  );
  const [editorMode, setEditorMode] = useState<EditorMode>("view");
  const [editingAddress, setEditingAddress] = useState<CellAddress | null>(
    null
  );
  const [editingSurface, setEditingSurface] = useState<EditorSurface | null>(
    null
  );
  const [draftValue, setDraftValue] = useState("");
  const [writeState, setWriteState] = useState<WriteState>("idle");

  if (sheetRef.current === null) {
    sheetRef.current = new SparseSheet();
  }

  const sheet = sheetRef.current;
  const bounds = sheet.bounds;
  const { height: gridHeight, width: gridWidth } = getGridDimensions(bounds);
  const { handleScroll, scrollRef, viewport } = useVirtualViewport(bounds);
  const activeCell =
    selection.type === "cell" ? selection.anchor : selection.end;
  const selectionBounds = getSelectionBounds(selection);
  const selectionStartLayout = getCellLayout(selectionBounds.start);
  const selectionEndLayout = getCellLayout(selectionBounds.end);
  const activeCellLayout = getCellLayout(activeCell);
  const visibleWindow: VisibleWindow = getVisibleWindow(viewport, bounds);
  const visibleRows = buildSequence(
    visibleWindow.rowStart,
    visibleWindow.rowEnd
  );
  const visibleColumns = buildSequence(
    visibleWindow.colStart,
    visibleWindow.colEnd
  );
  const selectionDimensions = getSelectionDimensions(selection);
  const initialSeedCells = useMemo(
    () =>
      Array.from(createSeededSheet(document).snapshot(), ([key, value]) => ({
        key,
        raw: value.raw,
      })),
    [document]
  );
  const initialFormulaCells = useMemo(
    () =>
      initialSeedCells.map(({ key, raw }) => ({
        key,
        raw,
      })),
    [initialSeedCells]
  );
  const visibleKeys = useMemo(
    () =>
      visibleRows.flatMap((row) =>
        visibleColumns.map((column) => createCellKey({ col: column, row }))
      ),
    [visibleColumns, visibleRows]
  );
  const {
    batchUpsert,
    computedValues,
    deleteCell,
    formulaErrors,
    isReady,
    upsertCell: upsertFormulaCell,
  } = useFormulaEngine({
    bounds,
    initialCells: initialFormulaCells,
    visibleKeys,
  });
  const handleCollaborativeCellChanges = useEffectEvent(
    (changes: Array<{ key: string; value: CellRecord | null }>) => {
      const sheetModel = sheetRef.current;

      if (!sheetModel) {
        return;
      }

      const formulaUpserts: Array<{ key: string; raw: string }> = [];

      for (const change of changes) {
        if (change.value === null) {
          sheetModel.clearCellByKey(change.key);
          deleteCell(change.key);
          continue;
        }

        sheetModel.setCellByKey(change.key, change.value);
        formulaUpserts.push({
          key: change.key,
          raw: change.value.raw,
        });
      }

      if (formulaUpserts.length > 0) {
        batchUpsert(formulaUpserts);
      }

      setSheetRevision((current) => current + 1);
    }
  );
  const {
    batchUpsert: syncBatchUpsert,
    lastRemoteLatencyMs,
    peers,
    status,
    upsertCell: syncUpsertCell,
  } = useCollaborationRoom({
    initialCells: initialSeedCells,
    onCellsChanged: handleCollaborativeCellChanges,
    roomId: document.roomId,
    selection,
    session,
  });
  const activeCellRecord = sheet.getCell(activeCell);
  const activeCellRaw = getCellDisplayValue(activeCellRecord);
  const syncDocumentTimestamp = () => {
    touchDocument(document.id).catch(() => undefined);
  };

  const applyOptimisticCellWrite = (address: CellAddress, raw: string) => {
    const key = createCellKey(address);

    if (raw.trim() === "") {
      const changed = sheet.clearCell(address);

      if (changed) {
        deleteCell(key);
        setSheetRevision((current) => current + 1);
      }

      return;
    }

    sheet.setCellByKey(key, {
      kind: getCellKind(raw),
      raw,
    });
    upsertFormulaCell({
      key,
      raw,
    });
    setSheetRevision((current) => current + 1);
  };

  const applyOptimisticBatchWrite = (
    cells: Array<{
      key: string;
      raw: string;
    }>
  ) => {
    if (cells.length === 0) {
      return;
    }

    const formulaUpserts: Array<{ key: string; raw: string }> = [];
    let didChange = false;

    for (const cell of cells) {
      if (cell.raw.trim() === "") {
        didChange = sheet.clearCellByKey(cell.key) || didChange;
        deleteCell(cell.key);
        continue;
      }

      sheet.setCellByKey(cell.key, {
        kind: getCellKind(cell.raw),
        raw: cell.raw,
      });
      formulaUpserts.push(cell);
      didChange = true;
    }

    if (formulaUpserts.length > 0) {
      batchUpsert(formulaUpserts);
    }

    if (didChange) {
      setSheetRevision((current) => current + 1);
    }
  };

  const setNextWriteState = (nextWriteState: WriteState) => {
    writeStateRef.current = nextWriteState;
    setWriteState(nextWriteState);
    onWriteStateChange?.(nextWriteState);
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

  const ensureCellVisible = (address: CellAddress) => {
    const node = scrollRef.current;

    if (!node) {
      return;
    }

    const layout = getCellLayout(address);
    const cellRight = layout.left + layout.width;
    const cellBottom = layout.top + layout.height;

    if (layout.left < node.scrollLeft) {
      node.scrollLeft = layout.left;
    } else if (cellRight > node.scrollLeft + node.clientWidth) {
      node.scrollLeft = cellRight - node.clientWidth;
    }

    if (layout.top < node.scrollTop) {
      node.scrollTop = layout.top;
    } else if (cellBottom > node.scrollTop + node.clientHeight) {
      node.scrollTop = cellBottom - node.clientHeight;
    }
  };

  const applySelection = (nextSelection: Selection) => {
    setSelection(nextSelection);
    ensureCellVisible(
      nextSelection.type === "cell" ? nextSelection.anchor : nextSelection.end
    );
  };

  const writeCell = (address: CellAddress, value: string) => {
    const key = createCellKey(address);

    applyOptimisticCellWrite(address, value);
    syncUpsertCell({
      key,
      raw: value,
    });
    scheduleWriteConfirmation();
    syncDocumentTimestamp();
  };

  const clearSelectionContents = () => {
    const clearedKeys: Array<{
      key: string;
      raw: string;
    }> = [];

    for (
      let row = selectionBounds.start.row;
      row <= selectionBounds.end.row;
      row += 1
    ) {
      for (
        let col = selectionBounds.start.col;
        col <= selectionBounds.end.col;
        col += 1
      ) {
        clearedKeys.push({
          key: createCellKey({ col, row }),
          raw: "",
        });
      }
    }

    if (clearedKeys.length === 0) {
      return;
    }

    applyOptimisticBatchWrite(clearedKeys);
    syncBatchUpsert(clearedKeys);
    scheduleWriteConfirmation();
    syncDocumentTimestamp();
  };

  const startEditing = (
    address: CellAddress,
    initialValue?: string,
    surface: EditorSurface = "cell"
  ) => {
    const nextValue =
      initialValue ?? getCellDisplayValue(sheet.getCell(address));
    setEditingAddress(address);
    setEditingSurface(surface);
    setDraftValue(nextValue);
    setEditorMode(nextValue.startsWith("=") ? "formula" : "edit");

    if (surface === "cell") {
      applySelection(createCellSelection(address));
    }
  };

  const stopEditing = () => {
    setEditingAddress(null);
    setEditingSurface(null);
    setDraftValue("");
    setEditorMode("view");
    keyboardProxyRef.current?.focus();
  };

  const commitEditing = (options?: { nextSelection?: Selection }) => {
    if (!editingAddress) {
      return;
    }

    writeCell(editingAddress, draftValue);
    const nextSelection =
      options?.nextSelection ?? createCellSelection(editingAddress);
    stopEditing();
    applySelection(nextSelection);
  };

  useEffect(() => {
    if (!editingAddress) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editingAddress]);

  useEffect(() => {
    if (!(editingAddress && editingSurface === "formula-bar")) {
      return;
    }

    formulaBarRef.current?.focus();
    formulaBarRef.current?.select();
  }, [editingAddress, editingSurface]);

  useEffect(() => {
    onWriteStateChange?.("idle");
  }, [onWriteStateChange]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateWriteState = (nextWriteState: WriteState) => {
      writeStateRef.current = nextWriteState;
      setWriteState(nextWriteState);
      onWriteStateChange?.(nextWriteState);
    };

    const emitWriteEvent = (
      event:
        | "flush-confirmed"
        | "flush-queued"
        | "network-offline"
        | "network-online"
    ) => {
      updateWriteState(getWriteStateAfterEvent(writeStateRef.current, event));
    };

    const handleOffline = () => {
      updateWriteState("offline");
    };

    const handleOnline = () => {
      emitWriteEvent("network-online");

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
  }, [onWriteStateChange]);

  const getAddressFromPointerEvent = (event: PointerEvent<HTMLDivElement>) => {
    const node = scrollRef.current;

    if (!node) {
      return null;
    }

    const rect = node.getBoundingClientRect();

    return getCellAddressFromPoint(
      {
        x: event.clientX - rect.left + node.scrollLeft,
        y: event.clientY - rect.top + node.scrollTop,
      },
      bounds
    );
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (editingAddress) {
      return;
    }

    const node = scrollRef.current;
    const nextAddress = getAddressFromPointerEvent(event);

    if (!(node && nextAddress)) {
      return;
    }

    event.preventDefault();
    keyboardProxyRef.current?.focus();
    isPointerSelectingRef.current = true;
    pointerAnchorRef.current = event.shiftKey
      ? getSelectionAnchor(selection)
      : nextAddress;
    applySelection(
      event.shiftKey
        ? createRangeSelection(getSelectionAnchor(selection), nextAddress)
        : createCellSelection(nextAddress)
    );
    node.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isPointerSelectingRef.current) {
      return;
    }

    const nextAddress = getAddressFromPointerEvent(event);
    const anchor = pointerAnchorRef.current;

    if (!(nextAddress && anchor)) {
      return;
    }

    setSelection(createRangeSelection(anchor, nextAddress));
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const node = scrollRef.current;

    if (node?.hasPointerCapture(event.pointerId)) {
      node.releasePointerCapture(event.pointerId);
    }

    isPointerSelectingRef.current = false;
    pointerAnchorRef.current = null;
  };

  const handleDoubleClick = (event: PointerEvent<HTMLDivElement>) => {
    const nextAddress = getAddressFromPointerEvent(event);

    if (!nextAddress) {
      return;
    }

    event.preventDefault();
    keyboardProxyRef.current?.focus();
    startEditing(nextAddress);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLDivElement | HTMLTextAreaElement>
  ) => {
    if (editingAddress) {
      return;
    }

    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight" ||
      event.key === "ArrowUp" ||
      event.key === "Enter" ||
      event.key === "Tab"
    ) {
      event.preventDefault();
      const delta = getNavigationDelta(event.key, event.shiftKey);
      const nextAddress = moveCellAddress(activeCell, delta, bounds);

      applySelection(
        event.shiftKey
          ? extendSelection(selection, nextAddress)
          : createCellSelection(nextAddress)
      );
      return;
    }

    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      clearSelectionContents();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      applySelection(createCellSelection(activeCell));
      return;
    }

    if (isPrintableCellInput(event)) {
      event.preventDefault();
      startEditing(activeCell, event.key);
    }
  };

  const handleCopy = (
    event: ClipboardEvent<HTMLDivElement | HTMLTextAreaElement>
  ) => {
    event.preventDefault();
    const matrix = getSelectionMatrix(sheet, selection);
    event.clipboardData.setData("text/plain", serializeSelectionMatrix(matrix));
  };

  const handlePaste = (
    event: ClipboardEvent<HTMLDivElement | HTMLTextAreaElement>
  ) => {
    event.preventDefault();
    const matrix = parseClipboardMatrix(
      event.clipboardData.getData("text/plain")
    );

    if (matrix.length === 0) {
      return;
    }

    const pastedCells = matrix.flatMap((rowValues, rowOffset) =>
      rowValues.map((value, colOffset) => ({
        key: createCellKey({
          col: selectionBounds.start.col + colOffset,
          row: selectionBounds.start.row + rowOffset,
        }),
        raw: value,
      }))
    );

    applyOptimisticBatchWrite(pastedCells);
    syncBatchUpsert(pastedCells);
    scheduleWriteConfirmation();
    syncDocumentTimestamp();

    const rowCount = matrix.length;
    const colCount = Math.max(...matrix.map((row) => row.length), 1);
    applySelection(
      createRangeSelection(selectionBounds.start, {
        col: Math.min(
          bounds.colCount,
          selectionBounds.start.col + colCount - 1
        ),
        row: Math.min(
          bounds.rowCount,
          selectionBounds.start.row + rowCount - 1
        ),
      })
    );
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      stopEditing();
      return;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      const delta = getNavigationDelta(
        event.key === "Enter" ? "Enter" : "Tab",
        event.shiftKey
      );
      const nextAddress = moveCellAddress(activeCell, delta, bounds);
      commitEditing({
        nextSelection: createCellSelection(nextAddress),
      });
    }
  };

  const handleFormulaBarFocus = () => {
    startEditing(activeCell, activeCellRaw, "formula-bar");
  };

  const handleFormulaBarKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      stopEditing();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      commitEditing({
        nextSelection: createCellSelection(activeCell),
      });
    }
  };

  const formulaBarValue =
    editingAddress &&
    editingAddress.row === activeCell.row &&
    editingAddress.col === activeCell.col
      ? draftValue
      : activeCellRaw;

  const selectionWidth =
    selectionEndLayout.left -
    selectionStartLayout.left +
    selectionEndLayout.width;
  const selectionHeight =
    selectionEndLayout.top -
    selectionStartLayout.top +
    selectionEndLayout.height;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-white/82 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
      <textarea
        aria-label="Spreadsheet keyboard input"
        autoFocus
        className="absolute h-px w-px overflow-hidden opacity-0"
        onChange={() => {
          // Intentionally no-op; the proxy exists only to receive keyboard events.
        }}
        onCopy={handleCopy}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        readOnly
        ref={keyboardProxyRef}
        spellCheck={false}
        value=""
      />

      <div className="flex items-center justify-between border-[var(--border)] border-b bg-[rgba(247,249,250,0.92)] px-4 py-3 text-[0.72rem] text-[var(--muted)] uppercase tracking-[0.18em]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-[rgba(42,118,130,0.08)] px-3 py-1 font-mono text-[var(--accent)]">
            {editorMode === "view" ? "Active" : editorMode}{" "}
            {getColumnHeaderLabel(activeCell.col)}
            {activeCell.row}
          </span>
          <span className="font-mono">
            Visible rows {visibleWindow.rowStart}-{visibleWindow.rowEnd}
          </span>
          <span className="font-mono">
            Selection {selectionDimensions.rowCount}x
            {selectionDimensions.colCount}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 font-mono">
          <span>{isReady ? "Formulas ready" : "Formulas warming"}</span>
          <span>{status}</span>
          {lastRemoteLatencyMs != null ? (
            <span>remote {lastRemoteLatencyMs}ms</span>
          ) : null}
          {peers.length > 0 ? (
            <span>
              {peers.length} collaborator{peers.length === 1 ? "" : "s"}
            </span>
          ) : null}
          <span>{formatWriteState(writeState)}</span>
          <span>{bounds.rowCount.toLocaleString()} rows</span>
          <span>{bounds.colCount.toLocaleString()} cols</span>
          <span>{sheet.cellCount.toLocaleString()} populated</span>
        </div>
      </div>

      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 border-[var(--border)] border-b bg-[linear-gradient(180deg,_rgba(252,253,253,0.98),_rgba(246,249,250,0.94))] px-4 py-3">
        <div className="rounded-[1rem] border border-[rgba(42,118,130,0.16)] bg-[rgba(42,118,130,0.06)] px-3 py-2 font-mono text-[0.82rem] text-[var(--accent)] uppercase tracking-[0.22em]">
          fx {getColumnHeaderLabel(activeCell.col)}
          {activeCell.row}
        </div>
        <div className="flex items-center gap-3 rounded-[1.15rem] border border-[var(--border)] bg-white/88 px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <span className="font-mono text-[0.78rem] text-[var(--muted)] uppercase tracking-[0.24em]">
            Formula
          </span>
          <input
            className="h-9 w-full bg-transparent text-[0.96rem] text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
            onBlur={() => {
              if (editingSurface === "formula-bar") {
                commitEditing({
                  nextSelection: createCellSelection(activeCell),
                });
              }
            }}
            onChange={(event) => {
              if (editingAddress == null || editingSurface !== "formula-bar") {
                setEditingAddress(activeCell);
                setEditingSurface("formula-bar");
              }

              setDraftValue(event.target.value);
              setEditorMode(
                event.target.value.startsWith("=") ? "formula" : "edit"
              );
            }}
            onFocus={handleFormulaBarFocus}
            onKeyDown={handleFormulaBarKeyDown}
            placeholder="Type a value or formula like =SUM(A5:B5)"
            ref={formulaBarRef}
            value={formulaBarValue}
          />
          <div className="flex flex-wrap items-center gap-2">
            {peers.map((peer) => (
              <span
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[rgba(248,250,251,0.92)] px-3 py-1 text-[0.78rem] text-[var(--foreground)]"
                key={peer.userId}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: peer.color }}
                />
                {peer.displayName}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[4.5rem_minmax(0,1fr)] grid-rows-[3rem_minmax(0,1fr)] bg-[linear-gradient(180deg,_rgba(251,252,252,0.95),_rgba(244,247,248,0.92))]">
        <div className="border-[var(--border)] border-r border-b bg-[rgba(236,241,244,0.92)] px-3 py-3 font-mono text-[0.68rem] text-[var(--muted)] uppercase tracking-[0.28em]">
          Grid
        </div>

        <div className="relative overflow-hidden border-[var(--border)] border-b bg-[rgba(236,241,244,0.92)]">
          {visibleColumns.map((column) => {
            const left =
              (column - 1) * DEFAULT_SHEET_METRICS.colWidth - viewport.scrollX;
            const isSelectedColumn =
              column >= selectionBounds.start.col &&
              column <= selectionBounds.end.col;
            const isActiveColumn = column === activeCell.col;

            return (
              <div
                className="absolute top-0 flex h-full items-center border-[var(--border)] border-r px-3 font-mono text-[0.76rem] uppercase tracking-[0.22em]"
                key={`column-${column}`}
                style={{
                  backgroundColor: getHeaderBackgroundColor(
                    isActiveColumn,
                    isSelectedColumn
                  ),
                  color: isSelectedColumn
                    ? "var(--foreground)"
                    : "var(--muted)",
                  left,
                  width: DEFAULT_SHEET_METRICS.colWidth,
                }}
              >
                {getColumnHeaderLabel(column)}
              </div>
            );
          })}
        </div>

        <div className="relative overflow-hidden border-[var(--border)] border-r bg-[rgba(248,249,250,0.92)]">
          {visibleRows.map((row) => {
            const top =
              (row - 1) * DEFAULT_SHEET_METRICS.rowHeight - viewport.scrollY;
            const isSelectedRow =
              row >= selectionBounds.start.row &&
              row <= selectionBounds.end.row;
            const isActiveRow = row === activeCell.row;

            return (
              <div
                className="absolute left-0 flex items-center border-[var(--border)] border-b px-3 font-mono text-[0.75rem] tracking-[0.18em]"
                key={`row-${row}`}
                style={{
                  backgroundColor: getHeaderBackgroundColor(
                    isActiveRow,
                    isSelectedRow
                  ),
                  color: isSelectedRow ? "var(--foreground)" : "var(--muted)",
                  height: DEFAULT_SHEET_METRICS.rowHeight,
                  top,
                  width: "100%",
                }}
              >
                {row}
              </div>
            );
          })}
        </div>

        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: custom spreadsheet surfaces use pointer-driven selection on a scroll container */}
        <div
          aria-label="Spreadsheet grid"
          className="relative overflow-auto bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(249,251,252,0.98))] outline-none"
          onDoubleClick={handleDoubleClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onScroll={handleScroll}
          ref={scrollRef}
          role="application"
        >
          <div
            className="relative"
            style={{
              height: gridHeight,
              width: gridWidth,
            }}
          >
            {visibleRows.flatMap((row) =>
              visibleColumns.map((column) => {
                const address = { col: column, row };
                const cellKey = createCellKey(address);
                const layout = getCellLayout(address);
                const cell = sheet.getCell(address);
                const isActive =
                  activeCell.col === column && activeCell.row === row;
                const isSelected = selectionContainsAddress(selection, address);
                const formulaError = formulaErrors.get(cellKey);
                const computedValue = computedValues.get(cellKey);
                const displayValue = getRenderedCellValue({
                  cell,
                  computedValue,
                  formulaError,
                });

                return (
                  <div
                    className="absolute overflow-hidden border-[var(--border)] border-r border-b px-3 py-2 text-[0.92rem] text-[var(--foreground)] leading-6"
                    key={`${row}:${column}`}
                    style={{
                      backgroundColor: getCellBackgroundColor(
                        isActive,
                        isSelected
                      ),
                      height: layout.height,
                      left: layout.left,
                      top: layout.top,
                      width: layout.width,
                    }}
                    title={formulaError}
                  >
                    <div className="truncate">{displayValue}</div>
                  </div>
                );
              })
            )}

            <div
              className="pointer-events-none absolute rounded-[0.85rem] bg-[rgba(42,118,130,0.07)]"
              style={{
                height: selectionHeight,
                left: selectionStartLayout.left,
                top: selectionStartLayout.top,
                width: selectionWidth,
              }}
            />

            <div
              className="pointer-events-none absolute rounded-[0.85rem] border-2 border-[var(--accent)] shadow-[0_0_0_1px_rgba(255,255,255,0.9)]"
              style={{
                height: selectionHeight,
                left: selectionStartLayout.left,
                top: selectionStartLayout.top,
                width: selectionWidth,
              }}
            />

            <div
              className="pointer-events-none absolute rounded-[0.7rem] border-2 border-[var(--foreground)]"
              style={{
                height: activeCellLayout.height,
                left: activeCellLayout.left,
                top: activeCellLayout.top,
                width: activeCellLayout.width,
              }}
            />

            {peers.map((peer) => {
              const peerActiveCell = peer.activeCell
                ? parseCellKey(peer.activeCell)
                : null;
              const peerSelection = peer.selection
                ? normalizeRange(
                    parseCellKey(peer.selection.start),
                    parseCellKey(peer.selection.end)
                  )
                : null;

              return (
                <div key={`peer-overlay-${peer.userId}`}>
                  {peerSelection ? (
                    <div
                      className="pointer-events-none absolute rounded-[0.8rem] border-2"
                      style={{
                        borderColor: peer.color,
                        height:
                          getCellLayout(peerSelection.end).top -
                          getCellLayout(peerSelection.start).top +
                          getCellLayout(peerSelection.end).height,
                        left: getCellLayout(peerSelection.start).left,
                        top: getCellLayout(peerSelection.start).top,
                        width:
                          getCellLayout(peerSelection.end).left -
                          getCellLayout(peerSelection.start).left +
                          getCellLayout(peerSelection.end).width,
                      }}
                    />
                  ) : null}
                  {peerActiveCell ? (
                    <div
                      className="pointer-events-none absolute rounded-[0.7rem] border-2"
                      style={{
                        borderColor: peer.color,
                        height: getCellLayout(peerActiveCell).height,
                        left: getCellLayout(peerActiveCell).left,
                        top: getCellLayout(peerActiveCell).top,
                        width: getCellLayout(peerActiveCell).width,
                      }}
                    />
                  ) : null}
                </div>
              );
            })}

            {editingAddress && editingSurface === "cell" ? (
              <div
                className="absolute z-20 rounded-[0.75rem] border-2 border-[var(--accent)] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.12)]"
                style={{
                  height: activeCellLayout.height,
                  left: activeCellLayout.left,
                  top: activeCellLayout.top,
                  width: activeCellLayout.width,
                }}
              >
                <input
                  className="h-full w-full bg-transparent px-3 py-2 text-[0.92rem] text-[var(--foreground)] outline-none"
                  onBlur={() => {
                    commitEditing();
                  }}
                  onChange={(event) => {
                    setDraftValue(event.target.value);
                    setEditorMode(
                      event.target.value.startsWith("=") ? "formula" : "edit"
                    );
                  }}
                  onKeyDown={handleInputKeyDown}
                  ref={inputRef}
                  value={draftValue}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
