import type { CellFontFamily } from "@/types/spreadsheet";

export const CELL_FONT_FAMILY_OPTIONS = [
  "display",
  "mono",
  "open-sans",
  "roboto",
  "montserrat",
  "lato",
  "roboto-slab",
  "poppins",
  "source-sans-3",
  "raleway",
  "oswald",
  "roboto-condensed",
  "sans",
  "serif",
] as const satisfies readonly CellFontFamily[];

export const CELL_FONT_FAMILY_LABELS: Record<CellFontFamily, string> = {
  display: "Display",
  lato: "Lato",
  mono: "Mono",
  montserrat: "Montserrat",
  "open-sans": "Open Sans",
  oswald: "Oswald",
  poppins: "Poppins",
  raleway: "Raleway",
  roboto: "Roboto",
  "roboto-condensed": "Roboto Condensed",
  "roboto-slab": "Roboto Slab",
  sans: "Sans",
  serif: "Serif",
  "source-sans-3": "Source Sans 3",
};

export const CELL_FONT_FAMILY_STYLES: Record<CellFontFamily, string> = {
  display: 'var(--font-display), "Segoe UI", sans-serif',
  lato: 'var(--font-sheet-lato), "Lato", sans-serif',
  mono: 'var(--font-body), "SFMono-Regular", Consolas, monospace',
  montserrat: 'var(--font-sheet-montserrat), "Montserrat", sans-serif',
  "open-sans": 'var(--font-sheet-open-sans), "Open Sans", sans-serif',
  oswald: 'var(--font-sheet-oswald), "Oswald", sans-serif',
  poppins: 'var(--font-sheet-poppins), "Poppins", sans-serif',
  raleway: 'var(--font-sheet-raleway), "Raleway", sans-serif',
  roboto: 'var(--font-sheet-roboto), "Roboto", sans-serif',
  "roboto-condensed":
    'var(--font-sheet-roboto-condensed), "Roboto Condensed", sans-serif',
  "roboto-slab": 'var(--font-sheet-roboto-slab), "Roboto Slab", serif',
  sans: '"Helvetica Neue", Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  "source-sans-3":
    'var(--font-sheet-source-sans-3), "Source Sans 3", sans-serif',
};
