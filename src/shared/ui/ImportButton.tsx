import { useRef, useState } from "react";
import "./ImportButton.css";

/** "add" adds and updates; "replace" also deletes what is not in the file. */
export type ImportMode = "add" | "replace";

/** Result of checking a file: errors stop the import; warnings are only shown. */
export type ImportCheck = {
  errors: string[];
  warnings: string[];
  /** What "add" changes, e.g. "Nowe: 3, zmienione: 12". */
  summary: string;
  /** What "replace" changes; null when the import has no replace. */
  replace: {
    summary: string;
    /** Number of items "replace" deletes — asked to confirm when > 0. */
    deleted: number;
    /** Reasons replace is not possible (e.g. a deleted product still used by a meal). */
    blockers: string[];
    /** Saved data that loses its link, e.g. "Magazyn - produkty: 2". */
    affected: string[];
  } | null;
  /** Saves the data; only called when there are no errors (and, for replace, no blockers). */
  save: (mode: ImportMode) => Promise<void>;
};

type Checked = { fileName: string; check: ImportCheck };
type State =
  | { status: "idle" }
  | { status: "checking"; fileName: string }
  | (Checked & { status: "checked" | "confirm" | "saving" })
  | (Checked & { status: "error"; message: string });

/** Lines of a long list shown before "…i jeszcze N". */
const MAX_LINES = 20;

/**
 * "Importuj CSV" button for a screen header. The chosen file is checked first; the result offers "Dopisz" (add and
 * update) and "Zastąp" (also delete what is not in the file — asked to confirm, as it cannot be undone).
 * Nothing is saved before one of them.
 */
export function ImportButton({ check }: { check: (text: string) => ImportCheck | Promise<ImportCheck> }) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ status: "idle" });

  async function read(file: File) {
    setState({ status: "checking", fileName: file.name });
    try {
      const result = await check(await file.text());
      setState({ status: "checked", fileName: file.name, check: result });
    } catch (error) {
      const failed: ImportCheck = { errors: [(error as Error).message], warnings: [], summary: "", replace: null, save: async () => {} };
      setState({ status: "checked", fileName: file.name, check: failed });
    }
  }

  async function save(mode: ImportMode) {
    if (state.status === "idle" || state.status === "checking") return;
    const { fileName, check: result } = state;
    setState({ status: "saving", fileName, check: result });
    try {
      await result.save(mode);
      setState({ status: "idle" });
    } catch (error) {
      setState({ status: "error", fileName, check: result, message: (error as Error).message });
    }
  }

  const close = () => setState({ status: "idle" });

  return (
    <>
      <button type="button" className="import-button" onClick={() => input.current?.click()}>
        Importuj CSV
      </button>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void read(file);
        }}
      />
      {state.status === "checking" && (
        <section className="import-panel" aria-live="polite">
          <p className="import-result">Sprawdzanie pliku {state.fileName}…</p>
        </section>
      )}
      {state.status !== "idle" && state.status !== "checking" && (
        <ImportPanel state={state} onSave={(mode) => void save(mode)} onConfirm={() => setState({ ...state, status: "confirm" })} onClose={close} />
      )}
    </>
  );
}

function ImportPanel({
  state,
  onSave,
  onConfirm,
  onClose,
}: {
  state: Exclude<State, { status: "idle" } | { status: "checking" }>;
  onSave: (mode: ImportMode) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { check } = state;
  const saving = state.status === "saving";
  const replace = check.replace;
  const canReplace = replace !== null && replace.blockers.length === 0;

  if (check.errors.length > 0) {
    return (
      <section className="import-panel" aria-live="polite">
        <h2 className="import-title">Import: {state.fileName}</h2>
        <p className="import-result is-error">Plik ma błędy - nic nie zostanie zapisane.</p>
        <Lines items={check.errors} className="is-error" />
        <div className="import-actions">
          <button type="button" className="import-button" onClick={onClose}>
            Anuluj
          </button>
        </div>
      </section>
    );
  }

  if (state.status === "confirm" && replace) {
    return (
      <section className="import-panel" aria-live="polite">
        <h2 className="import-title">Import: {state.fileName}</h2>
        <p className="import-result is-error">
          Usunąć {replace.deleted} {replace.deleted === 1 ? "element" : "elementów"}? Tego nie da się cofnąć.
        </p>
        <div className="import-actions">
          <button type="button" className="import-button is-primary" onClick={() => onSave("replace")}>
            Zastąp
          </button>
          <button type="button" className="import-button" onClick={onClose}>
            Anuluj
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="import-panel" aria-live="polite">
      <h2 className="import-title">Import: {state.fileName}</h2>

      <div className="import-option">
        <p className="import-option-title">Dopisz - dodaje nowe i zmienia istniejące, nic nie usuwa</p>
        <p className="import-result">{check.summary}</p>
      </div>

      {replace && (
        <div className="import-option">
          <p className="import-option-title">Zastąp - jak wyżej, a to, czego nie ma w pliku, zostaje usunięte</p>
          <p className="import-result">{replace.summary}</p>
          {replace.blockers.length > 0 && (
            <>
              <p className="import-result is-error">Nie można zastąpić - usuwane elementy są jeszcze używane:</p>
              <Lines items={replace.blockers} className="is-error" />
            </>
          )}
          {canReplace && replace.affected.length > 0 && (
            <>
              <p className="import-subtitle">Stracą powiązanie (pokażą brak w bazie):</p>
              <Lines items={replace.affected} />
            </>
          )}
          {canReplace && replace.deleted > 0 && (
            <p className="import-subtitle">Usuniętych danych nie da się przywrócić - przed importem warto zrobić eksport.</p>
          )}
        </div>
      )}

      {check.warnings.length > 0 && (
        <>
          <p className="import-subtitle">Uwagi ({check.warnings.length}):</p>
          <Lines items={check.warnings} />
        </>
      )}
      {state.status === "error" && (
        <p className="import-result is-error" role="alert">
          Nie udało się zapisać. {state.message}
        </p>
      )}

      <div className="import-actions">
        <button type="button" className="import-button is-primary" disabled={saving} onClick={() => onSave("add")}>
          {saving ? "Zapisywanie…" : "Dopisz"}
        </button>
        {replace && (
          <button
            type="button"
            className="import-button"
            disabled={saving || !canReplace}
            onClick={() => (replace.deleted > 0 ? onConfirm() : onSave("replace"))}
          >
            Zastąp
          </button>
        )}
        <button type="button" className="import-button" disabled={saving} onClick={onClose}>
          Anuluj
        </button>
      </div>
    </section>
  );
}

function Lines({ items, className = "" }: { items: string[]; className?: string }) {
  const shown = items.slice(0, MAX_LINES);
  return (
    <ul className={"import-lines " + className}>
      {shown.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
      {items.length > MAX_LINES && <li>…i jeszcze {items.length - MAX_LINES}</li>}
    </ul>
  );
}
