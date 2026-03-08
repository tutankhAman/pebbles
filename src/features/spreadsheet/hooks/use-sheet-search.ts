import { type RefObject, useMemo, useState } from "react";
import { parseCellKey } from "@/features/spreadsheet/addressing";
import {
  findCellMatches,
  type SearchMatch,
} from "@/features/spreadsheet/functions/virtualized-sheet-search";
import { createCellSelection } from "@/features/spreadsheet/interaction";
import type { SparseSheet } from "@/features/spreadsheet/sparse-sheet";
import type { CellAddress, CellRecord, Selection } from "@/types/spreadsheet";

export function useSheetSearch(args: {
  activeCellKey: string;
  applySelection: (selection: Selection, visibleAddress?: CellAddress) => void;
  cellsSnapshot: Map<string, CellRecord>;
  commitTrackedSheetMutation: (mutationArgs: {
    mutation: () => void;
    nextSelection?: Selection;
  }) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  sheet: SparseSheet;
}) {
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [replaceValue, setReplaceValue] = useState("");
  const [isSearchCaseSensitive, setIsSearchCaseSensitive] = useState(false);

  const searchMatches = useMemo(
    () =>
      isSearchPanelOpen
        ? findCellMatches({
            caseSensitive: isSearchCaseSensitive,
            cells: args.cellsSnapshot,
            query: searchQuery,
          })
        : ([] as SearchMatch[]),
    [args.cellsSnapshot, isSearchCaseSensitive, isSearchPanelOpen, searchQuery]
  );

  const activeSearchMatchIndex = useMemo(
    () => searchMatches.findIndex((match) => match.key === args.activeCellKey),
    [args.activeCellKey, searchMatches]
  );

  const escapeSearchPattern = (value: string) =>
    value.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");

  const replaceSearchValue = (value: string, replaceAll: boolean) => {
    if (searchQuery.trim() === "") {
      return value;
    }

    const pattern = new RegExp(
      escapeSearchPattern(searchQuery),
      `${replaceAll ? "g" : ""}${isSearchCaseSensitive ? "" : "i"}`
    );

    return value.replace(pattern, replaceValue);
  };

  const openSearchPanel = () => {
    setIsSearchPanelOpen(true);
  };

  const closeSearchPanel = () => {
    setIsSearchPanelOpen(false);
  };

  const jumpToSearchMatch = (direction: "next" | "previous") => {
    if (searchMatches.length === 0) {
      return;
    }

    const delta = direction === "next" ? 1 : -1;
    let nextIndex =
      (activeSearchMatchIndex + delta + searchMatches.length) %
      searchMatches.length;

    if (activeSearchMatchIndex === -1) {
      nextIndex = direction === "next" ? 0 : searchMatches.length - 1;
    }

    const nextMatch = searchMatches[nextIndex];

    if (!nextMatch) {
      return;
    }

    args.applySelection(createCellSelection(parseCellKey(nextMatch.key)));
  };

  const replaceCurrentSearchMatch = () => {
    const targetMatch =
      activeSearchMatchIndex === -1
        ? searchMatches[0]
        : searchMatches[activeSearchMatchIndex];

    if (!targetMatch) {
      return;
    }

    const nextRaw = replaceSearchValue(targetMatch.raw, false);

    if (nextRaw === targetMatch.raw) {
      jumpToSearchMatch("next");
      return;
    }

    args.commitTrackedSheetMutation({
      mutation: () => {
        args.sheet.setCellByKey(targetMatch.key, nextRaw);
      },
      nextSelection: createCellSelection(parseCellKey(targetMatch.key)),
    });
  };

  const replaceAllSearchMatches = () => {
    if (searchMatches.length === 0) {
      return;
    }

    const replacements = searchMatches
      .map((match) => ({
        key: match.key,
        nextRaw: replaceSearchValue(match.raw, true),
      }))
      .filter((entry) => {
        const currentRaw = args.sheet.getCellByKey(entry.key)?.raw ?? "";
        return entry.nextRaw !== currentRaw;
      });

    if (replacements.length === 0) {
      return;
    }

    args.commitTrackedSheetMutation({
      mutation: () => {
        for (const replacement of replacements) {
          args.sheet.setCellByKey(replacement.key, replacement.nextRaw);
        }
      },
      nextSelection: createCellSelection(parseCellKey(replacements[0].key)),
    });
  };

  return {
    activeSearchMatchIndex,
    closeSearchPanel,
    isSearchCaseSensitive,
    isSearchPanelOpen,
    jumpToSearchMatch,
    openSearchPanel,
    replaceAllSearchMatches,
    replaceCurrentSearchMatch,
    replaceValue,
    searchMatches,
    searchQuery,
    setIsSearchCaseSensitive,
    setIsSearchPanelOpen,
    setReplaceValue,
    setSearchQuery,
  };
}
