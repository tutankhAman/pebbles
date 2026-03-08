import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownAZ,
  ArrowUpZA,
  Baseline,
  Bold,
  ClipboardPaste,
  Copy,
  Eraser,
  Italic,
  PaintBucket,
  Redo2,
  Scissors,
  Search,
  Type,
  Underline,
  Undo2,
} from "lucide-react";
import {
  CELL_FONT_FAMILY_OPTIONS,
  CELL_FONT_FAMILY_STYLES,
} from "@/features/spreadsheet/cell-fonts";
import { getFontFamilyLabel } from "@/features/spreadsheet/functions/virtualized-sheet-display";
import { getToolbarButtonClassName } from "@/features/spreadsheet/functions/virtualized-sheet-styles";
import { getColumnHeaderLabel } from "@/features/spreadsheet/viewport";
import type {
  CellAddress,
  CellFontFamily,
  CellFontSize,
  CellFormat,
  CellFormatRecord,
  CellHorizontalAlignment,
} from "@/types/spreadsheet";

export function SheetToolbar({
  activeCell,
  activeCellAlignment,
  activeCellFormat,
  activeFontFamily,
  activeFontSize,
  applyFormattingPatch,
  canRedo,
  canUndo,
  clearSelectionContents,
  clearSelectionFormatting,
  copySelectionContents,
  cutSelectionContents,
  isSearchPanelOpen,
  pasteSelectionContents,
  redoSelectionChange,
  setIsSearchPanelOpen,
  sortSelectionRows,
  undoSelectionChange,
}: {
  activeCell: CellAddress;
  activeCellAlignment: CellHorizontalAlignment;
  activeCellFormat: CellFormatRecord | null;
  activeFontFamily: string;
  activeFontSize: string;
  applyFormattingPatch: (patch: CellFormat) => void;
  canRedo: boolean;
  canUndo: boolean;
  clearSelectionContents: () => void;
  clearSelectionFormatting: () => void;
  copySelectionContents: () => Promise<void>;
  cutSelectionContents: () => Promise<void>;
  isSearchPanelOpen: boolean;
  pasteSelectionContents: () => Promise<void>;
  redoSelectionChange: () => void;
  setIsSearchPanelOpen: (updater: (current: boolean) => boolean) => void;
  sortSelectionRows: (direction: "asc" | "desc") => void;
  undoSelectionChange: () => void;
}) {
  return (
    <div className="border-[#e0e3e7] border-b bg-[#f8f9fa]">
      <div className="flex flex-wrap items-center gap-[0.375rem] px-3 py-[0.375rem]">
        <div className="flex items-center gap-0.5 bg-white p-[0.1875rem] shadow-sm ring-1 ring-[#e0e3e7]">
          <button
            aria-label="Undo"
            className={getToolbarButtonClassName(false, !canUndo)}
            disabled={!canUndo}
            onClick={undoSelectionChange}
            title="Undo"
            type="button"
          >
            <Undo2 className="h-4 w-4 stroke-[2.1]" />
          </button>
          <button
            aria-label="Redo"
            className={getToolbarButtonClassName(false, !canRedo)}
            disabled={!canRedo}
            onClick={redoSelectionChange}
            title="Redo"
            type="button"
          >
            <Redo2 className="h-4 w-4 stroke-[2.1]" />
          </button>
        </div>

        <div className="flex items-center gap-0.5 bg-white p-[0.1875rem] shadow-sm ring-1 ring-[#e0e3e7]">
          <button
            aria-label="Cut"
            className={getToolbarButtonClassName(false)}
            onClick={() => {
              cutSelectionContents().catch(() => undefined);
            }}
            title="Cut"
            type="button"
          >
            <Scissors className="h-4 w-4 stroke-[2.1]" />
          </button>
          <button
            aria-label="Copy"
            className={getToolbarButtonClassName(false)}
            onClick={() => {
              copySelectionContents().catch(() => undefined);
            }}
            title="Copy"
            type="button"
          >
            <Copy className="h-4 w-4 stroke-[2.1]" />
          </button>
          <button
            aria-label="Paste"
            className={getToolbarButtonClassName(false)}
            onClick={() => {
              pasteSelectionContents().catch(() => undefined);
            }}
            title="Paste"
            type="button"
          >
            <ClipboardPaste className="h-4 w-4 stroke-[2.1]" />
          </button>
          <button
            aria-label="Clear cells"
            className={getToolbarButtonClassName(false)}
            onClick={clearSelectionContents}
            title="Clear cells"
            type="button"
          >
            <Eraser className="h-4 w-4 stroke-[2.1]" />
          </button>
          <button
            aria-label="Clear formatting"
            className={getToolbarButtonClassName(false)}
            onClick={clearSelectionFormatting}
            title="Clear formatting"
            type="button"
          >
            <Baseline className="h-4 w-4 stroke-[2.1]" />
          </button>
        </div>

        <div className="flex items-center gap-0.5 bg-white p-[0.1875rem] shadow-sm ring-1 ring-[#e0e3e7]">
          <label
            className="flex h-7 items-center gap-1.5 px-1.5 text-[#444746] transition-colors hover:bg-[#f1f3f4]"
            title="Font family"
          >
            <Type className="h-[0.875rem] w-[0.875rem] stroke-[2] text-[#5f6368]" />
            <span className="sr-only">Font family</span>
            <select
              aria-label="Cell font family"
              className="h-full min-w-[5.75rem] bg-transparent text-[0.75rem] leading-none outline-none"
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
          <label
            className="flex h-7 items-center gap-1.5 px-1.5 text-[#444746] transition-colors hover:bg-[#f1f3f4]"
            title="Font size"
          >
            <Type className="h-[0.875rem] w-[0.875rem] stroke-[2] text-[#5f6368]" />
            <span className="sr-only">Font size</span>
            <select
              aria-label="Cell font size"
              className="h-full w-11 bg-transparent text-[0.75rem] leading-none outline-none"
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
        </div>

        <div className="flex items-center gap-0.5 bg-white p-[0.1875rem] shadow-sm ring-1 ring-[#e0e3e7]">
          <button
            aria-label="Bold"
            className={getToolbarButtonClassName(
              Boolean(activeCellFormat?.bold)
            )}
            onClick={() => {
              applyFormattingPatch({
                bold: !activeCellFormat?.bold,
              });
            }}
            title="Bold"
            type="button"
          >
            <Bold className="h-4 w-4 stroke-[2.5]" />
          </button>
          <button
            aria-label="Italic"
            className={getToolbarButtonClassName(
              Boolean(activeCellFormat?.italic)
            )}
            onClick={() => {
              applyFormattingPatch({
                italic: !activeCellFormat?.italic,
              });
            }}
            title="Italic"
            type="button"
          >
            <Italic className="h-4 w-4 stroke-[2.5]" />
          </button>
          <button
            aria-label="Underline"
            className={getToolbarButtonClassName(
              Boolean(activeCellFormat?.underline)
            )}
            onClick={() => {
              applyFormattingPatch({
                underline: !activeCellFormat?.underline,
              });
            }}
            title="Underline"
            type="button"
          >
            <Underline className="h-4 w-4 stroke-[2.5]" />
          </button>
        </div>

        <div className="flex items-center gap-0.5 bg-white p-[0.1875rem] shadow-sm ring-1 ring-[#e0e3e7]">
          <label
            className="flex h-7 items-center gap-1.5 px-1.5 text-[#444746] transition-colors hover:bg-[#f1f3f4]"
            title="Text color"
          >
            <Baseline className="h-[0.875rem] w-[0.875rem] stroke-[2] text-[#5f6368]" />
            <span className="sr-only">Text color</span>
            <input
              aria-label="Cell text color"
              className="h-full w-5 cursor-pointer border-none bg-transparent p-0"
              onChange={(event) => {
                applyFormattingPatch({
                  textColor: event.target.value,
                });
              }}
              title="Text color"
              type="color"
              value={activeCellFormat?.textColor ?? "#172333"}
            />
          </label>
          <label
            className="flex h-7 items-center gap-1.5 px-1.5 text-[#444746] transition-colors hover:bg-[#f1f3f4]"
            title="Fill color"
          >
            <PaintBucket className="h-[0.875rem] w-[0.875rem] stroke-[2] text-[#5f6368]" />
            <span className="sr-only">Fill color</span>
            <input
              aria-label="Cell fill color"
              className="h-full w-5 cursor-pointer border-none bg-transparent p-0"
              onChange={(event) => {
                applyFormattingPatch({
                  backgroundColor: event.target.value,
                });
              }}
              title="Fill color"
              type="color"
              value={activeCellFormat?.backgroundColor ?? "#ffffff"}
            />
          </label>
        </div>

        <div className="flex items-center gap-0.5 bg-white p-[0.1875rem] shadow-sm ring-1 ring-[#e0e3e7]">
          {(
            [
              {
                alignment: "left" as const,
                icon: <AlignLeft className="h-4 w-4" />,
                label: "Align left",
              },
              {
                alignment: "center" as const,
                icon: <AlignCenter className="h-4 w-4" />,
                label: "Align center",
              },
              {
                alignment: "right" as const,
                icon: <AlignRight className="h-4 w-4" />,
                label: "Align right",
              },
            ] as const
          ).map(({ alignment, icon, label }) => (
            <button
              aria-label={label}
              className={getToolbarButtonClassName(
                activeCellAlignment === alignment
              )}
              key={alignment}
              onClick={() => {
                applyFormattingPatch({
                  align:
                    activeCellFormat?.align === alignment
                      ? undefined
                      : alignment,
                });
              }}
              title={label}
              type="button"
            >
              {icon}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-0.5 bg-white p-[0.1875rem] shadow-sm ring-1 ring-[#e0e3e7]">
          <button
            aria-label={`Sort rows ascending by ${getColumnHeaderLabel(activeCell.col)}`}
            className={getToolbarButtonClassName(false)}
            onClick={() => {
              sortSelectionRows("asc");
            }}
            title={`Sort ascending by ${getColumnHeaderLabel(activeCell.col)}`}
            type="button"
          >
            <ArrowDownAZ className="h-4 w-4 stroke-[2.1]" />
          </button>
          <button
            aria-label={`Sort rows descending by ${getColumnHeaderLabel(activeCell.col)}`}
            className={getToolbarButtonClassName(false)}
            onClick={() => {
              sortSelectionRows("desc");
            }}
            title={`Sort descending by ${getColumnHeaderLabel(activeCell.col)}`}
            type="button"
          >
            <ArrowUpZA className="h-4 w-4 stroke-[2.1]" />
          </button>
          <button
            aria-label="Find and replace"
            className={getToolbarButtonClassName(isSearchPanelOpen)}
            onClick={() => {
              setIsSearchPanelOpen((current) => !current);
            }}
            title="Find and replace"
            type="button"
          >
            <Search className="h-4 w-4 stroke-[2.1]" />
          </button>
        </div>
      </div>
    </div>
  );
}
