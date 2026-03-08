import {
  CELL_FONT_FAMILY_OPTIONS,
  CELL_FONT_FAMILY_STYLES,
} from "@/features/spreadsheet/cell-fonts";
import { getFontFamilyLabel } from "@/features/spreadsheet/functions/virtualized-sheet-display";
import type {
  HelpPanel,
  MenuKey,
} from "@/features/spreadsheet/types/virtualized-sheet";
import { MenuButton } from "@/features/spreadsheet/ui/menu-button";
import { MenuItem } from "@/features/spreadsheet/ui/menu-item";
import { getColumnHeaderLabel } from "@/features/spreadsheet/viewport";
import type {
  CellAddress,
  CellFontFamily,
  CellFontSize,
  CellFormat,
  CellFormatRecord,
  CellHorizontalAlignment,
} from "@/types/spreadsheet";

export function SheetMenuBar({
  activeCell,
  activeCellAlignment,
  activeCellFormat,
  activeFontFamily,
  activeFontSize,
  activeMenu,
  canRedo,
  canUndo,
  clearSelectionContents,
  clearSelectionFormatting,
  closeMenus,
  copySelectionContents,
  cutSelectionContents,
  freezeFirstColumn,
  freezeTopRow,
  handleExport,
  onBackToDashboard,
  onToggleMenu,
  openRenameDialog,
  openSearchPanel,
  pasteSelectionContents,
  selectionDimensions,
  setActiveHelpPanel,
  setFreezeFirstColumn,
  setFreezeTopRow,
  setShowCrosshairHighlight,
  setShowFormulaBar,
  setShowGridlines,
  showCrosshairHighlight,
  showFormulaBar,
  showGridlines,
  sortSelectionRows,
  undoSelectionChange,
  redoSelectionChange,
  insertColumn,
  insertRow,
  applyFormattingPatch,
  writeStateLabel,
}: {
  activeCell: CellAddress;
  activeCellAlignment: CellHorizontalAlignment;
  activeCellFormat: CellFormatRecord | null;
  activeFontFamily: string;
  activeFontSize: string;
  activeMenu: MenuKey | null;
  applyFormattingPatch: (patch: CellFormat) => void;
  canRedo: boolean;
  canUndo: boolean;
  clearSelectionContents: () => void;
  clearSelectionFormatting: () => void;
  closeMenus: () => void;
  copySelectionContents: () => Promise<void>;
  cutSelectionContents: () => Promise<void>;
  freezeFirstColumn: boolean;
  freezeTopRow: boolean;
  handleExport: (format: "csv" | "json" | "tsv") => void;
  insertColumn: (placement: "left" | "right") => void;
  insertRow: (placement: "above" | "below") => void;
  onBackToDashboard: () => void;
  onToggleMenu: (menuKey: MenuKey) => void;
  openRenameDialog: () => void;
  openSearchPanel: () => void;
  pasteSelectionContents: () => Promise<void>;
  redoSelectionChange: () => void;
  selectionDimensions: {
    colCount: number;
    rowCount: number;
  };
  setActiveHelpPanel: (panel: HelpPanel | null) => void;
  setFreezeFirstColumn: (updater: (current: boolean) => boolean) => void;
  setFreezeTopRow: (updater: (current: boolean) => boolean) => void;
  setShowCrosshairHighlight: (updater: (current: boolean) => boolean) => void;
  setShowFormulaBar: (updater: (current: boolean) => boolean) => void;
  setShowGridlines: (updater: (current: boolean) => boolean) => void;
  showCrosshairHighlight: boolean;
  showFormulaBar: boolean;
  showGridlines: boolean;
  sortSelectionRows: (direction: "asc" | "desc") => void;
  undoSelectionChange: () => void;
  writeStateLabel: string;
}) {
  return (
    <div className="relative bg-white px-2 py-0.5" data-menu-root>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-0.5">
          {(["file", "edit", "view", "insert", "format", "help"] as const).map(
            (menuKey) => (
              <MenuButton
                isOpen={activeMenu === menuKey}
                key={menuKey}
                label={menuKey}
                onClick={() => {
                  onToggleMenu(menuKey);
                }}
              />
            )
          )}
        </div>
        <div className="flex items-center gap-3 pr-1 text-[#80868b] text-[0.6875rem]">
          <span className="font-mono text-[#5f6368]">
            {getColumnHeaderLabel(activeCell.col)}
            {activeCell.row}
          </span>
          <span className="font-mono">
            {selectionDimensions.rowCount} x {selectionDimensions.colCount}
          </span>
          <span className="font-mono">{writeStateLabel}</span>
        </div>
      </div>

      {activeMenu ? (
        <div className="absolute top-full left-2 z-40 mt-0.5 min-w-[17rem] rounded-lg border border-[#e0e0e0] bg-white py-1.5 shadow-[0_2px_6px_2px_rgba(60,64,67,0.15),0_1px_2px_rgba(60,64,67,0.3)]">
          {activeMenu === "file" ? (
            <div className="grid gap-0.5 px-1">
              <MenuItem
                label="Export CSV"
                onClick={() => {
                  handleExport("csv");
                  closeMenus();
                }}
              />
              <MenuItem
                label="Export TSV"
                onClick={() => {
                  handleExport("tsv");
                  closeMenus();
                }}
              />
              <MenuItem
                label="Export JSON"
                onClick={() => {
                  handleExport("json");
                  closeMenus();
                }}
              />
              <MenuItem
                label="Rename sheet/document"
                onClick={openRenameDialog}
                shortcut="F2"
              />
              <MenuItem label="Back to dashboard" onClick={onBackToDashboard} />
            </div>
          ) : null}

          {activeMenu === "edit" ? (
            <div className="grid gap-0.5 px-1">
              <MenuItem
                disabled={!canUndo}
                label="Undo"
                onClick={() => {
                  undoSelectionChange();
                  closeMenus();
                }}
                shortcut="Mod+Z"
              />
              <MenuItem
                disabled={!canRedo}
                label="Redo"
                onClick={() => {
                  redoSelectionChange();
                  closeMenus();
                }}
                shortcut="Mod+Shift+Z"
              />
              <MenuItem
                label="Cut"
                onClick={() => {
                  cutSelectionContents().catch(() => undefined);
                  closeMenus();
                }}
                shortcut="Mod+X"
              />
              <MenuItem
                label="Copy"
                onClick={() => {
                  copySelectionContents().catch(() => undefined);
                  closeMenus();
                }}
                shortcut="Mod+C"
              />
              <MenuItem
                label="Paste"
                onClick={() => {
                  pasteSelectionContents().catch(() => undefined);
                  closeMenus();
                }}
                shortcut="Mod+V"
              />
              <MenuItem
                label="Find and replace"
                onClick={openSearchPanel}
                shortcut="Mod+F"
              />
              <MenuItem
                label="Sort ascending"
                onClick={() => {
                  sortSelectionRows("asc");
                  closeMenus();
                }}
              />
              <MenuItem
                label="Sort descending"
                onClick={() => {
                  sortSelectionRows("desc");
                  closeMenus();
                }}
              />
              <MenuItem
                label="Clear cells"
                onClick={() => {
                  clearSelectionContents();
                  closeMenus();
                }}
                shortcut="Delete"
              />
              <MenuItem
                label="Clear formatting"
                onClick={() => {
                  clearSelectionFormatting();
                  closeMenus();
                }}
                shortcut="Alt+Shift+X"
              />
            </div>
          ) : null}

          {activeMenu === "view" ? (
            <div className="grid gap-0.5 px-1">
              <MenuItem
                checked={showFormulaBar}
                label="Show formula bar"
                onClick={() => {
                  setShowFormulaBar((current) => !current);
                  closeMenus();
                }}
                shortcut="Mod+/"
              />
              <MenuItem
                checked={showGridlines}
                label="Show gridlines"
                onClick={() => {
                  setShowGridlines((current) => !current);
                  closeMenus();
                }}
                shortcut="Alt+G"
              />
              <MenuItem
                checked={showCrosshairHighlight}
                label="Full row/column highlight"
                onClick={() => {
                  setShowCrosshairHighlight((current) => !current);
                  closeMenus();
                }}
                shortcut="Alt+H"
              />
              <MenuItem
                checked={freezeTopRow}
                label="Freeze top row"
                onClick={() => {
                  setFreezeTopRow((current) => !current);
                  closeMenus();
                }}
                shortcut="Alt+Shift+T"
              />
              <MenuItem
                checked={freezeFirstColumn}
                label="Freeze first column"
                onClick={() => {
                  setFreezeFirstColumn((current) => !current);
                  closeMenus();
                }}
                shortcut="Alt+Shift+1"
              />
            </div>
          ) : null}

          {activeMenu === "insert" ? (
            <div className="grid gap-0.5 px-1">
              <MenuItem
                label="Row above"
                onClick={() => {
                  insertRow("above");
                  closeMenus();
                }}
                shortcut="Alt+Shift+Up"
              />
              <MenuItem
                label="Row below"
                onClick={() => {
                  insertRow("below");
                  closeMenus();
                }}
                shortcut="Alt+Shift+Down"
              />
              <MenuItem
                label="Column left"
                onClick={() => {
                  insertColumn("left");
                  closeMenus();
                }}
                shortcut="Alt+Shift+Left"
              />
              <MenuItem
                label="Column right"
                onClick={() => {
                  insertColumn("right");
                  closeMenus();
                }}
                shortcut="Alt+Shift+Right"
              />
            </div>
          ) : null}

          {activeMenu === "format" ? (
            <div className="grid gap-2 px-1">
              <div className="flex flex-wrap items-center gap-3 rounded border border-[#e0e0e0] bg-[#f8f9fa] px-3 py-2.5">
                <label className="flex items-center gap-2 text-[0.8125rem]">
                  <span className="text-[#5f6368]">Font</span>
                  <select
                    className="rounded border border-[#dadce0] bg-white px-3 py-1 text-[0.8125rem] outline-none"
                    onChange={(event) => {
                      const nextFontFamily = event.target.value;

                      applyFormattingPatch({
                        fontFamily:
                          nextFontFamily === ""
                            ? undefined
                            : (nextFontFamily as CellFontFamily),
                      });
                    }}
                    value={activeFontFamily}
                  >
                    <option value="">Default</option>
                    {CELL_FONT_FAMILY_OPTIONS.map((fontFamily) => (
                      <option
                        key={fontFamily}
                        style={{
                          fontFamily: CELL_FONT_FAMILY_STYLES[fontFamily],
                        }}
                        value={fontFamily}
                      >
                        {getFontFamilyLabel(fontFamily)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-[0.8125rem]">
                  <span className="text-[#5f6368]">Size</span>
                  <select
                    className="rounded border border-[#dadce0] bg-white px-3 py-1 text-[0.8125rem] outline-none"
                    onChange={(event) => {
                      const nextFontSize = event.target.value;

                      applyFormattingPatch({
                        fontSize:
                          nextFontSize === ""
                            ? undefined
                            : (Number(nextFontSize) as CellFontSize),
                      });
                    }}
                    value={activeFontSize}
                  >
                    <option value="">Auto</option>
                    {[12, 14, 16, 18, 20].map((fontSize) => (
                      <option key={fontSize} value={fontSize}>
                        {fontSize}px
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-[0.8125rem]">
                  <span className="text-[#5f6368]">Text</span>
                  <input
                    className="h-7 w-9 rounded border border-[#dadce0]"
                    onChange={(event) => {
                      applyFormattingPatch({
                        textColor: event.target.value,
                      });
                    }}
                    type="color"
                    value={activeCellFormat?.textColor ?? "#172333"}
                  />
                </label>
                <label className="flex items-center gap-2 text-[0.8125rem]">
                  <span className="text-[#5f6368]">Fill</span>
                  <input
                    className="h-7 w-9 rounded border border-[#dadce0]"
                    onChange={(event) => {
                      applyFormattingPatch({
                        backgroundColor: event.target.value,
                      });
                    }}
                    type="color"
                    value={activeCellFormat?.backgroundColor ?? "#ffffff"}
                  />
                </label>
              </div>
              <div className="grid gap-0.5">
                <MenuItem
                  checked={Boolean(activeCellFormat?.bold)}
                  label="Bold"
                  onClick={() => {
                    applyFormattingPatch({
                      bold: !activeCellFormat?.bold,
                    });
                    closeMenus();
                  }}
                  shortcut="Mod+B"
                />
                <MenuItem
                  checked={Boolean(activeCellFormat?.italic)}
                  label="Italic"
                  onClick={() => {
                    applyFormattingPatch({
                      italic: !activeCellFormat?.italic,
                    });
                    closeMenus();
                  }}
                  shortcut="Mod+I"
                />
                <MenuItem
                  checked={Boolean(activeCellFormat?.underline)}
                  label="Underline"
                  onClick={() => {
                    applyFormattingPatch({
                      underline: !activeCellFormat?.underline,
                    });
                    closeMenus();
                  }}
                  shortcut="Mod+U"
                />
                <MenuItem
                  checked={activeCellAlignment === "left"}
                  label="Align left"
                  onClick={() => {
                    applyFormattingPatch({
                      align:
                        activeCellFormat?.align === "left" ? undefined : "left",
                    });
                    closeMenus();
                  }}
                  shortcut="Alt+Shift+L"
                />
                <MenuItem
                  checked={activeCellAlignment === "center"}
                  label="Align center"
                  onClick={() => {
                    applyFormattingPatch({
                      align:
                        activeCellFormat?.align === "center"
                          ? undefined
                          : "center",
                    });
                    closeMenus();
                  }}
                  shortcut="Alt+Shift+E"
                />
                <MenuItem
                  checked={activeCellAlignment === "right"}
                  label="Align right"
                  onClick={() => {
                    applyFormattingPatch({
                      align:
                        activeCellFormat?.align === "right"
                          ? undefined
                          : "right",
                    });
                    closeMenus();
                  }}
                  shortcut="Alt+Shift+R"
                />
              </div>
            </div>
          ) : null}

          {activeMenu === "help" ? (
            <div className="grid gap-0.5 px-1">
              <MenuItem
                label="Keyboard shortcuts"
                onClick={() => {
                  setActiveHelpPanel("shortcuts");
                  closeMenus();
                }}
                shortcut="Shift+?"
              />
              <MenuItem
                label="Formula examples"
                onClick={() => {
                  setActiveHelpPanel("formulas");
                  closeMenus();
                }}
              />
              <MenuItem
                label="About this sheet"
                onClick={() => {
                  setActiveHelpPanel("about");
                  closeMenus();
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
