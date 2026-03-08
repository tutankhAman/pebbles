export function RenameSheetDialog({
  onClose,
  onSubmit,
  renameDraft,
  setRenameDraft,
}: {
  onClose: () => void;
  onSubmit: () => void;
  renameDraft: string;
  setRenameDraft: (value: string) => void;
}) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-[rgba(32,33,36,0.18)] px-4"
      data-dialog-root
    >
      <div className="w-full max-w-md border border-[#dadce0] bg-white p-5 shadow-[0_20px_48px_rgba(32,33,36,0.18)]">
        <p className="font-mono text-[#5f6368] text-[0.68rem] uppercase tracking-[0.18em]">
          Rename sheet
        </p>
        <input
          className="mt-4 w-full border border-[#dadce0] bg-white px-4 py-3 text-[0.84rem] outline-none"
          onChange={(event) => {
            setRenameDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSubmit();
            }
          }}
          value={renameDraft}
        />
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            className="border border-[#dadce0] px-4 py-2 text-[0.76rem] uppercase tracking-[0.14em]"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="border border-[#16a34a] bg-[#16a34a] px-4 py-2 text-[0.76rem] text-white uppercase tracking-[0.14em]"
            onClick={onSubmit}
            type="button"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
