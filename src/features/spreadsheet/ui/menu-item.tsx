import { ShortcutLabel } from "@/features/spreadsheet/ui/shortcut-label";

export function MenuItem({
  checked,
  disabled,
  label,
  onClick,
  shortcut,
}: {
  checked?: boolean;
  disabled?: boolean;
  label: string;
  onClick?: () => void;
  shortcut?: string;
}) {
  return (
    <button
      className="flex w-full items-center justify-between gap-6 rounded-sm px-2 py-1.5 text-left text-[#202124] text-[0.8125rem] leading-5 transition-colors hover:bg-[#e8eaed] disabled:cursor-not-allowed disabled:text-[#80868b]"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="flex items-center gap-2.5">
        <span className="flex w-4 items-center justify-center text-center text-[#1a73e8] text-[0.75rem]">
          {checked ? (
            <svg
              fill="none"
              height="14"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
              width="14"
            >
              <title>Selected</title>
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            ""
          )}
        </span>
        <span>{label}</span>
      </span>
      {shortcut ? <ShortcutLabel label={shortcut} /> : null}
    </button>
  );
}
