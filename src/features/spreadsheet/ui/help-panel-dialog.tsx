import { getHelpPanelTitle } from "@/features/spreadsheet/functions/virtualized-sheet-display";
import type { HelpPanel } from "@/features/spreadsheet/types/virtualized-sheet";
import { createShortcutLabel } from "@/features/spreadsheet/ui/shortcut-label";

export function HelpPanelDialog({
  activeHelpPanel,
  bounds,
  documentTitle,
  onClose,
  populatedCellCount,
}: {
  activeHelpPanel: HelpPanel;
  bounds: {
    colCount: number;
    rowCount: number;
  };
  documentTitle: string;
  onClose: () => void;
  populatedCellCount: number;
}) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-[rgba(32,33,36,0.18)] px-4"
      data-dialog-root
    >
      <div className="w-full max-w-2xl border border-[#dadce0] bg-white p-5 shadow-[0_20px_48px_rgba(32,33,36,0.18)]">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-[#5f6368] text-[0.68rem] uppercase tracking-[0.18em]">
            {getHelpPanelTitle(activeHelpPanel)}
          </p>
          <button
            className="border border-[#dadce0] px-4 py-2 text-[0.76rem] uppercase tracking-[0.14em]"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        {activeHelpPanel === "shortcuts" ? (
          <div className="mt-4 grid gap-2 text-[0.82rem]">
            {[
              ["Rename sheet", "F2"],
              ["Undo", "Mod+Z"],
              ["Redo", "Mod+Shift+Z"],
              ["Find and replace", "Mod+F"],
              ["Cut", "Mod+X"],
              ["Copy", "Mod+C"],
              ["Paste", "Mod+V"],
              ["Bold", "Mod+B"],
              ["Italic", "Mod+I"],
              ["Underline", "Mod+U"],
              ["Toggle formula bar", "Mod+/"],
              ["Toggle gridlines", "Alt+G"],
              ["Toggle row/column highlight", "Alt+H"],
            ].map(([label, shortcut]) => (
              <div
                className="flex items-center justify-between border border-[#dadce0] bg-[#f8f9fa] px-4 py-3"
                key={label}
              >
                <span>{label}</span>
                {createShortcutLabel(shortcut)}
              </div>
            ))}
          </div>
        ) : null}

        {activeHelpPanel === "formulas" ? (
          <div className="mt-4 grid gap-3 text-[0.82rem]">
            {["=A1+B1", "=SUM(A1:B5)", "=SUM(A1,C1,D1)", "=A5/B5"].map(
              (example) => (
                <div
                  className="border border-[#dadce0] bg-[#f8f9fa] px-4 py-3 font-mono"
                  key={example}
                >
                  {example}
                </div>
              )
            )}
          </div>
        ) : null}

        {activeHelpPanel === "about" ? (
          <div className="mt-4 grid gap-2 text-[0.82rem]">
            <div className="border border-[#dadce0] bg-[#f8f9fa] px-4 py-3">
              <p>{documentTitle}</p>
              <p className="mt-2 text-[#5f6368]">
                {bounds.rowCount.toLocaleString()} rows ·{" "}
                {bounds.colCount.toLocaleString()} columns ·{" "}
                {populatedCellCount.toLocaleString()} populated cells
              </p>
            </div>
            <div className="border border-[#dadce0] bg-[#f8f9fa] px-4 py-3 text-[#5f6368]">
              Sparse data, virtual rendering, and lightweight formatting
              metadata keep this editor fast even as the sheet grows.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
