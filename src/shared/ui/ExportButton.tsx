import "./ExportButton.css";

type ExportButtonProps = {
  onExport: () => void;
  disabled?: boolean;
};

/** Export button for the header of a screen; the screen builds and downloads the file. */
export function ExportButton({ onExport, disabled = false }: ExportButtonProps) {
  return (
    <button type="button" className="export-button" onClick={onExport} disabled={disabled}>
      Eksportuj CSV
    </button>
  );
}
