import type { KeyboardEvent, RefObject } from "react";

interface CellLayout {
  height: number;
  left: number;
  top: number;
  width: number;
}

export function CellEditor({
  activeCellLayout,
  draftValue,
  inputRef,
  onBlur,
  onChange,
  onKeyDown,
}: {
  activeCellLayout: CellLayout;
  draftValue: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onBlur: () => void;
  onChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div
      className="absolute z-20 border-2 border-[#2563eb] bg-white shadow-[0_8px_24px_rgba(32,33,36,0.16)]"
      style={{
        height: activeCellLayout.height,
        left: activeCellLayout.left,
        top: activeCellLayout.top,
        width: activeCellLayout.width,
      }}
    >
      <input
        className="h-full w-full bg-transparent px-2 py-1 text-[0.76rem] text-[var(--foreground)] outline-none"
        onBlur={onBlur}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onKeyDown={onKeyDown}
        ref={inputRef}
        value={draftValue}
      />
    </div>
  );
}
