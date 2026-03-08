export function MenuButton({
  isOpen,
  label,
  onClick,
}: {
  isOpen: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded px-2.5 py-1 text-[0.8125rem] capitalize leading-6 transition-colors ${
        isOpen
          ? "bg-[#d3e3fd] text-[#041e49]"
          : "text-[#444746] hover:bg-[#e8eaed] hover:text-[#202124]"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
