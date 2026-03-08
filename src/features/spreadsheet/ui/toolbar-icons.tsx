import type { SVGProps } from "react";

function ToolbarSvg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 16 16"
      width="14"
      {...props}
    />
  );
}

export function FontFamilyIcon() {
  return (
    <ToolbarSvg aria-hidden="true">
      <path d="M3 12.5 6.9 3.5h2.2l4 9" />
      <path d="M5 8.9h5.8" />
    </ToolbarSvg>
  );
}

export function FontSizeIcon() {
  return (
    <ToolbarSvg aria-hidden="true">
      <path d="M3 4.5h6" />
      <path d="M6 4.5v8" />
      <path d="M10 8.5h3" />
      <path d="M11.5 8.5v4" />
    </ToolbarSvg>
  );
}

export function TextColorIcon() {
  return (
    <ToolbarSvg aria-hidden="true">
      <path d="M3.5 12.5 7.8 3.5h.4l4.3 9" />
      <path d="M5.1 9.2h5.8" />
      <path d="M3 13.8h10" />
    </ToolbarSvg>
  );
}

export function FillColorIcon() {
  return (
    <ToolbarSvg aria-hidden="true">
      <path d="m4 6.2 3.8-3.7 4 4-3.8 3.8z" />
      <path d="M9.9 8.4 12.6 11" />
      <path d="M3 13.2h10" />
    </ToolbarSvg>
  );
}

export function AlignLeftIcon() {
  return (
    <ToolbarSvg aria-hidden="true">
      <path d="M3 4h8" />
      <path d="M3 7h5.5" />
      <path d="M3 10h8" />
      <path d="M3 13h4.5" />
    </ToolbarSvg>
  );
}

export function AlignCenterIcon() {
  return (
    <ToolbarSvg aria-hidden="true">
      <path d="M4 4h8" />
      <path d="M5.5 7h5" />
      <path d="M4 10h8" />
      <path d="M6 13h4" />
    </ToolbarSvg>
  );
}

export function AlignRightIcon() {
  return (
    <ToolbarSvg aria-hidden="true">
      <path d="M5 4h8" />
      <path d="M7.5 7H13" />
      <path d="M5 10h8" />
      <path d="M8.5 13H13" />
    </ToolbarSvg>
  );
}

export function SortAscendingIcon() {
  return (
    <ToolbarSvg aria-hidden="true">
      <path d="M4 3.5v9" />
      <path d="m2.5 5 1.5-1.5L5.5 5" />
      <path d="M8 5h5" />
      <path d="M8 8h4" />
      <path d="M8 11h3" />
    </ToolbarSvg>
  );
}

export function SortDescendingIcon() {
  return (
    <ToolbarSvg aria-hidden="true">
      <path d="M4 3.5v9" />
      <path d="m2.5 11 1.5 1.5L5.5 11" />
      <path d="M8 5h3" />
      <path d="M8 8h4" />
      <path d="M8 11h5" />
    </ToolbarSvg>
  );
}

export function SearchIcon() {
  return (
    <ToolbarSvg aria-hidden="true">
      <circle cx="7" cy="7" r="3.5" />
      <path d="m9.8 9.8 2.7 2.7" />
    </ToolbarSvg>
  );
}
