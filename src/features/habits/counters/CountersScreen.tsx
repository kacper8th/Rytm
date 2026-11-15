import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { dateLabel, toIsoDate } from "../../../shared/dates";
import { deleteHabit, getHabits, restartCounter, undoRestart, type Habit } from "../habits";
import { runLabel } from "../periods";
import "../Habits.css";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; counters: Habit[] };
type Action = { status: "idle" } | { status: "saving" } | { status: "error"; message: string; retry: () => void };

/**
 * All counters, by name, with the days of the current run. Restart (on a picked date, today by default), undo of the
 * last restart, ✎ edits, ✕ deletes the counter with its history.
 */
export function CountersScreen() {
  const today = toIsoDate(new Date());
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);
  const [action, setAction] = useState<Action>({ status: "idle" });
  /** The counter whose restart form is open. */
  const [restarting, setRestarting] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getHabits().then(
      (habits) => !cancelled && setLoad({ status: "ready", counters: habits.filter((h) => h.kind === "counter") }),
      (error: Error) => !cancelled && setLoad({ status: "error", message: error.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  /** Runs a change on the server, then loads the counters again. */
  function save(run: () => Promise<void>) {
    const attempt = async () => {
      setAction({ status: "saving" });
      try {
        await run();
        setAction({ status: "idle" });
        setRestarting(null);
        setReloadCount((n) => n + 1);
      } catch (error) {
        setAction({ status: "error", message: (error as Error).message, retry: () => void attempt() });
      }
    };
    void attempt();
  }

  function undo(counter: Habit) {
    if (!window.confirm(`Cofnąć ostatni restart licznika „${counter.name}”? Wróci poprzednia seria.`)) return;
    save(() => undoRestart(counter.id));
  }

  function remove(counter: Habit) {
    if (!window.confirm(`Usunąć licznik „${counter.name}”? Zniknie też cała historia serii.`)) return;
    save(() => deleteHabit(counter.id));
  }

  const busy = action.status === "saving";

  return (
    <div className="habits">
      <header className="habits-header">
        <div>
          <Link to="/habits" className="habits-back">
            ← Nawyki
          </Link>
          <h1 className="habits-title">Liczniki</h1>
        </div>
        <Link to="/habits/counters/add" className="habits-button is-primary">
          + Dodaj
        </Link>
      </header>

      {action.status === "saving" && <p className="habits-status">Zapisywanie…</p>}
      {action.status === "error" && (
        <div className="habits-status is-error" role="alert">
          <span>Nie udało się zapisać. {action.message}</span>
          <button type="button" className="habits-button" onClick={action.retry}>
            Spróbuj ponownie
          </button>
        </div>
      )}

      {load.status === "loading" && <p className="habits-status">Wczytywanie…</p>}
      {load.status === "error" && (
        <div className="habits-status is-error" role="alert">
          <span>Nie udało się wczytać liczników. {load.message}</span>
          <button type="button" className="habits-button" onClick={() => setReloadCount((n) => n + 1)}>
            Spróbuj ponownie
          </button>
        </div>
      )}

      {load.status === "ready" && load.counters.length === 0 && (
        <p className="habits-empty">
          Brak liczników. <Link to="/habits/counters/add">Dodaj licznik</Link>.
        </p>
      )}

      {load.status === "ready" && load.counters.length > 0 && (
        <ul className="habits-cards">
          {load.counters.map((counter) => {
            const start = counter.runStart ?? counter.startDate;
            return (
              <li key={counter.id} className="habits-card">
                <div className="habits-card-head">
                  <span className="habits-card-name">{counter.name}</span>
                  <span className="habits-card-actions">
                    <Link
                      to={`/habits/counters/${encodeURIComponent(counter.id)}/edit`}
                      className="habits-icon-button"
                      aria-label={`Edytuj licznik ${counter.name}`}
                    >
                      ✎
                    </Link>
                    <button
                      type="button"
                      className="habits-icon-button"
                      onClick={() => remove(counter)}
                      disabled={busy}
                      aria-label={`Usuń licznik ${counter.name}`}
                    >
                      ✕
                    </button>
                  </span>
                </div>
                <div className="habits-counter-days">{runLabel(start, today)}</div>
                <div className="habits-row-note">od {dateLabel(start)}</div>

                {start > today ? null : restarting === counter.id ? (
                  <RestartForm
                    start={start}
                    today={today}
                    disabled={busy}
                    onRestart={(date) => save(async () => void (await restartCounter(counter.id, date)))}
                    onCancel={() => setRestarting(null)}
                  />
                ) : (
                  <div className="habits-header-actions">
                    <button type="button" className="habits-button" disabled={busy} onClick={() => setRestarting(counter.id)}>
                      Restart
                    </button>
                    {counter.runCount > 1 && (
                      <button type="button" className="habits-button" disabled={busy} onClick={() => undo(counter)}>
                        Cofnij restart
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Restart with a date: today by default, not before the start of the current run, not in the future. */
function RestartForm(props: {
  start: string;
  today: string;
  disabled: boolean;
  onRestart: (date: string) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(props.today);
  const valid = date >= props.start && date <= props.today;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (valid) props.onRestart(date);
  }

  return (
    <form className="habits-entry-form" onSubmit={submit}>
      <input
        type="date"
        value={date}
        min={props.start}
        max={props.today}
        onChange={(e) => setDate(e.target.value)}
        aria-label="Data restartu"
      />
      <button type="submit" className="habits-button is-primary" disabled={props.disabled || !valid}>
        Restartuj
      </button>
      <button type="button" className="habits-button" onClick={props.onCancel}>
        Anuluj
      </button>
    </form>
  );
}
