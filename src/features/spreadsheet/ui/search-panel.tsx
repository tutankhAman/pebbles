import type { RefObject } from "react";
import type { SearchMatch } from "@/features/spreadsheet/functions/virtualized-sheet-search";
import { SearchIcon } from "@/features/spreadsheet/ui/toolbar-icons";

export function SearchPanel({
  activeSearchMatchIndex,
  closeSearchPanel,
  isSearchCaseSensitive,
  jumpToSearchMatch,
  replaceAllSearchMatches,
  replaceCurrentSearchMatch,
  replaceValue,
  searchInputRef,
  searchMatches,
  searchQuery,
  setIsSearchCaseSensitive,
  setReplaceValue,
  setSearchQuery,
}: {
  activeSearchMatchIndex: number;
  closeSearchPanel: () => void;
  isSearchCaseSensitive: boolean;
  jumpToSearchMatch: (direction: "next" | "previous") => void;
  replaceAllSearchMatches: () => void;
  replaceCurrentSearchMatch: () => void;
  replaceValue: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchMatches: SearchMatch[];
  searchQuery: string;
  setIsSearchCaseSensitive: (value: boolean) => void;
  setReplaceValue: (value: string) => void;
  setSearchQuery: (value: string) => void;
}) {
  return (
    <div className="grid gap-2 border-[#e0e0e0] border-t bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-[15rem] flex-1 items-center gap-2 border border-[#d2d7de] bg-[#f8fafc] px-2.5 py-1.5 text-[#444746] text-[0.75rem] shadow-sm">
          <SearchIcon />
          <span className="sr-only">Find text</span>
          <input
            aria-label="Find text"
            className="w-full bg-transparent text-[#202124] outline-none placeholder:text-[#9aa0a6]"
            onChange={(event) => {
              setSearchQuery(event.target.value);
            }}
            placeholder="Find across populated cells"
            ref={searchInputRef}
            value={searchQuery}
          />
        </label>
        <label className="flex min-w-[15rem] flex-1 items-center gap-2 border border-[#d2d7de] bg-[#f8fafc] px-2.5 py-1.5 text-[#444746] text-[0.75rem] shadow-sm">
          <span className="font-mono text-[#5f6368] text-[0.6875rem] uppercase tracking-[0.08em]">
            Repl
          </span>
          <span className="sr-only">Replace with</span>
          <input
            aria-label="Replace with"
            className="w-full bg-transparent text-[#202124] outline-none placeholder:text-[#9aa0a6]"
            onChange={(event) => {
              setReplaceValue(event.target.value);
            }}
            placeholder="Replace with"
            value={replaceValue}
          />
        </label>
        <label className="flex items-center gap-2 px-1 text-[#5f6368] text-[0.75rem]">
          <input
            checked={isSearchCaseSensitive}
            className="h-3.5 w-3.5 accent-[#1a73e8]"
            onChange={(event) => {
              setIsSearchCaseSensitive(event.target.checked);
            }}
            type="checkbox"
          />
          Match case
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[#5f6368] text-[0.75rem]">
          <span className="font-mono">
            {searchMatches.length === 0
              ? "0 matches"
              : `${activeSearchMatchIndex + 1 > 0 ? activeSearchMatchIndex + 1 : 1}/${searchMatches.length}`}
          </span>
          <span>Searching all populated cells</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            className="rounded border border-[#d2d7de] bg-white px-2.5 py-1 text-[#202124] text-[0.75rem] shadow-sm transition-colors hover:bg-[#f1f3f4] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={searchMatches.length === 0}
            onClick={() => {
              jumpToSearchMatch("previous");
            }}
            type="button"
          >
            Prev
          </button>
          <button
            className="rounded border border-[#d2d7de] bg-white px-2.5 py-1 text-[#202124] text-[0.75rem] shadow-sm transition-colors hover:bg-[#f1f3f4] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={searchMatches.length === 0}
            onClick={() => {
              jumpToSearchMatch("next");
            }}
            type="button"
          >
            Next
          </button>
          <button
            className="rounded border border-[#d2d7de] bg-white px-2.5 py-1 text-[#202124] text-[0.75rem] shadow-sm transition-colors hover:bg-[#f1f3f4] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={searchMatches.length === 0 || searchQuery.trim() === ""}
            onClick={replaceCurrentSearchMatch}
            type="button"
          >
            Replace
          </button>
          <button
            className="rounded border border-[#1a73e8] bg-[#1a73e8] px-2.5 py-1 text-[0.75rem] text-white shadow-sm transition-colors hover:bg-[#1557b0] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={searchMatches.length === 0 || searchQuery.trim() === ""}
            onClick={replaceAllSearchMatches}
            type="button"
          >
            Replace all
          </button>
          <button
            className="rounded border border-transparent px-2.5 py-1 text-[#5f6368] text-[0.75rem] transition-colors hover:bg-[#f1f3f4]"
            onClick={closeSearchPanel}
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
