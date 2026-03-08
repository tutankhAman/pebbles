export function ShortcutLabel({ label }: { label: string }) {
  return (
    <span className="font-mono text-[#80868b] text-[0.6875rem] tracking-[0.02em]">
      {label}
    </span>
  );
}

export function createShortcutLabel(label: string) {
  return <ShortcutLabel label={label} />;
}
