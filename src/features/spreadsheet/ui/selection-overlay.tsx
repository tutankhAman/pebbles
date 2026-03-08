import { parseCellKey } from "@/features/spreadsheet/addressing";
import {
  createRangeSelection,
  getSelectionRect,
} from "@/features/spreadsheet/interaction";
import { getCellLayout } from "@/features/spreadsheet/viewport";
import type { PresenceState } from "@/types/collaboration";
import type { AxisLayout, CellAddress } from "@/types/spreadsheet";

interface CellLayout {
  height: number;
  left: number;
  top: number;
  width: number;
}

export function SelectionOverlay({
  activeCellLayout,
  columnLayout,
  peers,
  rowLayout,
  selectionRect,
  showCrosshairHighlight,
}: {
  activeCellLayout: CellLayout;
  columnLayout: AxisLayout;
  peers: PresenceState[];
  rowLayout: AxisLayout;
  selectionRect: { height: number; left: number; top: number; width: number };
  showCrosshairHighlight: boolean;
}) {
  return (
    <>
      {showCrosshairHighlight ? (
        <>
          <div
            className="pointer-events-none absolute left-0 bg-[rgba(37,99,235,0.04)]"
            style={{
              height: activeCellLayout.height,
              top: activeCellLayout.top,
              width: "100%",
            }}
          />
          <div
            className="pointer-events-none absolute top-0 bg-[rgba(37,99,235,0.04)]"
            style={{
              height: "100%",
              left: activeCellLayout.left,
              width: activeCellLayout.width,
            }}
          />
        </>
      ) : null}

      <div
        className="pointer-events-none absolute bg-[rgba(37,99,235,0.08)]"
        style={{
          height: selectionRect.height,
          left: selectionRect.left,
          top: selectionRect.top,
          width: selectionRect.width,
        }}
      />

      <div
        className="pointer-events-none absolute border-2 border-[#2563eb] shadow-[0_0_0_1px_rgba(255,255,255,0.92)]"
        style={{
          height: selectionRect.height,
          left: selectionRect.left,
          top: selectionRect.top,
          width: selectionRect.width,
        }}
      />

      <div
        className="pointer-events-none absolute border-2 border-[#2563eb]"
        style={{
          height: activeCellLayout.height,
          left: activeCellLayout.left,
          top: activeCellLayout.top,
          width: activeCellLayout.width,
        }}
      />

      <PeerCursorOverlays
        columnLayout={columnLayout}
        peers={peers}
        rowLayout={rowLayout}
      />
    </>
  );
}

function PeerCursorOverlays({
  columnLayout,
  peers,
  rowLayout,
}: {
  columnLayout: AxisLayout;
  peers: PresenceState[];
  rowLayout: AxisLayout;
}) {
  return (
    <>
      {peers.map((peer) => {
        const peerActiveCell = peer.activeCell
          ? parseCellKey(peer.activeCell)
          : null;
        const peerSelection =
          peer.selection == null
            ? null
            : createRangeSelection(
                parseCellKey(peer.selection.start),
                parseCellKey(peer.selection.end)
              );
        const peerSelectionRect =
          peerSelection == null
            ? null
            : getSelectionRect(peerSelection, columnLayout, rowLayout);

        return (
          <PeerCursor
            activeCell={peerActiveCell}
            color={peer.color}
            columnLayout={columnLayout}
            key={`peer-overlay-${peer.clientId ?? peer.userId}`}
            rowLayout={rowLayout}
            selectionRect={peerSelectionRect}
          />
        );
      })}
    </>
  );
}

function PeerCursor({
  activeCell,
  color,
  columnLayout,
  rowLayout,
  selectionRect,
}: {
  activeCell: CellAddress | null;
  color: string;
  columnLayout: AxisLayout;
  rowLayout: AxisLayout;
  selectionRect: {
    height: number;
    left: number;
    top: number;
    width: number;
  } | null;
}) {
  return (
    <div>
      {selectionRect ? (
        <div
          className="pointer-events-none absolute border-2"
          style={{
            borderColor: color,
            height: selectionRect.height,
            left: selectionRect.left,
            top: selectionRect.top,
            width: selectionRect.width,
          }}
        />
      ) : null}
      {activeCell
        ? (() => {
            const peerCellLayout = getCellLayout(
              activeCell,
              columnLayout,
              rowLayout
            );
            return (
              <div
                className="pointer-events-none absolute border-2"
                style={{
                  borderColor: color,
                  height: peerCellLayout.height,
                  left: peerCellLayout.left,
                  top: peerCellLayout.top,
                  width: peerCellLayout.width,
                }}
              />
            );
          })()
        : null}
    </div>
  );
}
