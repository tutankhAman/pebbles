import { createCellKey } from "@/features/spreadsheet/addressing";
import type { SparseSheet } from "@/features/spreadsheet/sparse-sheet";
import { VirtualCell } from "@/features/spreadsheet/ui/virtual-cell";
import type {
  AxisLayout,
  CellAddress,
  ComputedValue,
} from "@/types/spreadsheet";

export function FrozenCells({
  activeCell,
  columnLayout,
  computedValues,
  freezeFirstColumn,
  freezeTopRow,
  formulaErrors,
  rowLayout,
  selectedColumnSet,
  selectedRowSet,
  sheet,
  showGridlines,
  viewport,
  visibleColumns,
  visibleRows,
}: {
  activeCell: CellAddress;
  columnLayout: AxisLayout;
  computedValues: Map<string, ComputedValue>;
  freezeFirstColumn: boolean;
  freezeTopRow: boolean;
  formulaErrors: Map<string, string>;
  rowLayout: AxisLayout;
  selectedColumnSet: Set<number>;
  selectedRowSet: Set<number>;
  sheet: SparseSheet;
  showGridlines: boolean;
  viewport: { scrollX: number; scrollY: number };
  visibleColumns: number[];
  visibleRows: number[];
}) {
  return (
    <>
      {freezeTopRow
        ? visibleColumns.map((column) => (
            <VirtualCell
              address={{ col: column, row: 1 }}
              columnLayout={columnLayout}
              computedValue={computedValues.get(
                createCellKey({ col: column, row: 1 })
              )}
              displayTop={viewport.scrollY}
              format={sheet.getCellFormat({ col: column, row: 1 })}
              formulaError={formulaErrors.get(
                createCellKey({ col: column, row: 1 })
              )}
              isActive={activeCell.col === column && activeCell.row === 1}
              isFrozen
              isGridlinesVisible={showGridlines}
              isSelected={
                selectedColumnSet.has(column) && selectedRowSet.has(1)
              }
              key={`frozen-top-${column}`}
              record={sheet.getCell({ col: column, row: 1 })}
              rowLayout={rowLayout}
            />
          ))
        : null}

      {freezeFirstColumn
        ? visibleRows.map((row) => (
            <VirtualCell
              address={{ col: 1, row }}
              columnLayout={columnLayout}
              computedValue={computedValues.get(createCellKey({ col: 1, row }))}
              displayLeft={viewport.scrollX}
              format={sheet.getCellFormat({ col: 1, row })}
              formulaError={formulaErrors.get(createCellKey({ col: 1, row }))}
              isActive={activeCell.col === 1 && activeCell.row === row}
              isFrozen
              isGridlinesVisible={showGridlines}
              isSelected={selectedColumnSet.has(1) && selectedRowSet.has(row)}
              key={`frozen-left-${row}`}
              record={sheet.getCell({ col: 1, row })}
              rowLayout={rowLayout}
            />
          ))
        : null}

      {freezeTopRow && freezeFirstColumn ? (
        <VirtualCell
          address={{ col: 1, row: 1 }}
          columnLayout={columnLayout}
          computedValue={computedValues.get(createCellKey({ col: 1, row: 1 }))}
          displayLeft={viewport.scrollX}
          displayTop={viewport.scrollY}
          format={sheet.getCellFormat({ col: 1, row: 1 })}
          formulaError={formulaErrors.get(createCellKey({ col: 1, row: 1 }))}
          isActive={activeCell.col === 1 && activeCell.row === 1}
          isFrozen
          isGridlinesVisible={showGridlines}
          isSelected={selectedColumnSet.has(1) && selectedRowSet.has(1)}
          key="frozen-corner"
          record={sheet.getCell({ col: 1, row: 1 })}
          rowLayout={rowLayout}
        />
      ) : null}
    </>
  );
}
