import type { KeyboardEvent } from "react";
import { getColumnHeaderLabel } from "@/features/spreadsheet/viewport";
import type { CollaborationStatus } from "@/types/collaboration";
import type { CellAddress } from "@/types/spreadsheet";

export function FormulaBar({
  activeCell,
  formulaBarRef,
  formulaBarValue,
  isFormulaReady,
  onBlur,
  onChange,
  onFocus,
  onKeyDown,
  status,
}: {
  activeCell: CellAddress;
  formulaBarRef: React.RefObject<HTMLInputElement | null>;
  formulaBarValue: string;
  isFormulaReady: boolean;
  onBlur: () => void;
  onChange: (value: string) => void;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  status: CollaborationStatus;
}) {
  return (
    <div className="grid grid-cols-[5rem_2rem_minmax(0,1fr)_auto] items-center gap-0 border-[#e0e0e0] border-t">
      <div className="flex h-full items-center border-[#e0e0e0] border-r px-3 font-mono text-[#202124] text-[0.75rem]">
        {getColumnHeaderLabel(activeCell.col)}
        {activeCell.row}
      </div>
      <div className="flex h-full items-center justify-center border-[#e0e0e0] border-r text-[#80868b] text-[0.75rem] italic">
        fx
      </div>
      <input
        className="h-8 w-full bg-transparent px-2.5 text-[#202124] text-[0.8125rem] outline-none placeholder:text-[#9aa0a6]"
        onBlur={onBlur}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        placeholder="Type a value or formula"
        ref={formulaBarRef}
        value={formulaBarValue}
      />
      <div className="flex items-center justify-end gap-2.5 border-[#e0e0e0] border-l px-3 text-[#80868b] text-[0.6875rem]">
        <span>{isFormulaReady ? "Ready" : "Loading"}</span>
        <span>{status}</span>
      </div>
    </div>
  );
}
