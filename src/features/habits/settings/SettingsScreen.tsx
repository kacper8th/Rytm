import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { getSettings, saveSettings, type HomeRange, type Settings } from "../habits";
import "../Habits.css";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; settings: Settings };

const RANGE_OPTIONS: { value: HomeRange; label: string }[] = [
  { value: "day", label: "Dziś" },
  { value: "days", label: "Najbliższe dni (dziś i kolejne)" },
  { value: "week", label: "Ten tydzień (pn–nd)" },
  { value: "month", label: "Ten miesiąc" },
];

/** Settings of the Habits card on Home, shared by all devices: its range of days and "show all". */
export function SettingsScreen() {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getSettings().then(
      (settings) => !cancelled && setLoad({ status: "ready", settings }),
      (error: Error) => !cancelled && setLoad({ status: "error", message: error.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  return (
    <div className="habits">
      <header className="habits-header">
        <div>
          <Link to="/habits" className="habits-back">
            ← Nawyki
          </Link>
          <h1 className="habits-title">Ustawienia</h1>
        </div>
      </header>

      {load.status === "loading" && <p className="habits-status">Wczytywanie…</p>}
      {load.status === "error" && (
        <div className="habits-status is-error" role="alert">
          <span>Nie udało się wczytać ustawień. {load.message}</span>
          <button type="button" className="habits-button" onClick={() => setReloadCount((n) => n + 1)}>
            Spróbuj ponownie
          </button>
        </div>
      )}
      {load.status === "ready" && <SettingsForm initial={load.settings} />}
    </div>
  );
}

function SettingsForm({ initial }: { initial: Settings }) {
  const [range, setRange] = useState<HomeRange>(initial.homeRange);
  const [daysText, setDaysText] = useState(String(initial.homeDays));
  const [showAll, setShowAll] = useState(initial.homeShowAll);
  const [state, setState] = useState<{ status: "idle" | "saving" | "saved" } | { status: "error"; message: string }>({
    status: "idle",
  });

  const days = /^\d+$/.test(daysText.trim()) ? Number(daysText) : NaN;
  const daysValid = days >= 2 && days <= 31;
  const error = range === "days" && !daysValid ? "Liczba dni: 2–31." : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (error) return;
    setState({ status: "saving" });
    try {
      await saveSettings({ homeRange: range, homeDays: daysValid ? days : initial.homeDays, homeShowAll: showAll });
      setState({ status: "saved" });
    } catch (e) {
      setState({ status: "error", message: (e as Error).message });
    }
  }

  return (
    <form className="habits-form" onSubmit={submit}>
      <p className="habits-count">Co pokazuje karta Nawyki na ekranie głównym. Ustawienia są wspólne dla telefonu i komputera.</p>

      <fieldset className="habits-field">
        <legend>Zakres dni</legend>
        {RANGE_OPTIONS.map((option) => (
          <label key={option.value} className="habits-choice">
            <input type="radio" name="homeRange" checked={range === option.value} onChange={() => setRange(option.value)} />
            {option.label}
          </label>
        ))}
      </fieldset>

      {range === "days" && (
        <label className="habits-field">
          <span>Ile dni (razem z dziś)</span>
          <input type="text" inputMode="numeric" value={daysText} onChange={(e) => setDaysText(e.target.value)} />
        </label>
      )}

      <label className="habits-choice">
        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
        Pokaż wszystkie nawyki (bez względu na zakres)
      </label>

      <p className="habits-row-note">
        W zakresie są: nawyki dzienne, cele w wybrane dni przypadające w tych dniach, a od tygodnia (lub 7 dni)
        tygodniowe i od miesiąca (lub 28 dni) miesięczne. Liczniki są zawsze.
      </p>

      {error && (
        <p className="habits-status is-error" role="alert">
          {error}
        </p>
      )}
      {state.status === "error" && (
        <p className="habits-status is-error" role="alert">
          Nie udało się zapisać. {state.message}
        </p>
      )}
      {state.status === "saved" && <p className="habits-status">Zapisano.</p>}

      <button type="submit" className="habits-button is-primary" disabled={error !== null || state.status === "saving"}>
        {state.status === "saving" ? "Zapisywanie…" : "Zapisz"}
      </button>
    </form>
  );
}
