import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { addDays, dateLabel, toIsoDate } from "../../../shared/dates";
import { EntryControls } from "../EntryControls";
import { addEntry, deleteEntry, getEntries, getHabits, type Entry, type Habit } from "../habits";
import {
  byAdded,
  dateFromParam,
  entriesIn,
  formatAmount,
  habitRange,
  limitState,
  loadRange,
  periodLabel,
  PERIOD_ADVERBS,
  showsOn,
  sumOf,
} from "../periods";
import "../Habits.css";

type Data = { habits: Habit[]; entries: Entry[] };
type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: Data };
type Action = { status: "idle" } | { status: "saving" } | { status: "error"; message: string; retry: () => void };

/**
 * Period screen of Limits: each limit with its sum in the period the shown day belongs to (a daily limit that day,
 * a monthly limit the whole month) and how much is left. Entries are added on the shown day; "undo last" and the
 * list of entries cover the whole shown period.
 */
export function LimitsScreen() {
  const [params, setParams] = useSearchParams();
  const today = toIsoDate(new Date());
  const date = dateFromParam(params.get("date"), today);
  const range = loadRange(date);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);
  const [action, setAction] = useState<Action>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    Promise.all([getHabits(), getEntries(range.from, range.to)]).then(
      ([habits, entries]) => !cancelled && setLoad({ status: "ready", data: { habits, entries } }),
      (error: Error) => !cancelled && setLoad({ status: "error", message: error.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, reloadCount]);

  const data = load.status === "ready" ? load.data : null;

  const limits = useMemo(() => {
    if (!data) return null;
    return data.habits
      .filter((h) => h.kind === "limit" && showsOn(h, date))
      .map((limit) => {
        const periodEntries = entriesIn(data.entries, limit.id, habitRange(limit, date)).sort(byAdded);
        const sum = sumOf(periodEntries);
        return { limit, sum, state: limitState(sum, limit.target ?? 0), periodEntries };
      });
  }, [data, date]);
  const hasLimits = data?.habits.some((h) => h.kind === "limit") ?? false;

  function setDate(next: string) {
    setParams(next === today ? {} : { date: next }, { replace: true });
  }

  function save(run: () => Promise<(entries: Entry[]) => Entry[]>) {
    const attempt = async () => {
      setAction({ status: "saving" });
      try {
        const apply = await run();
        setLoad((prev) => (prev.status === "ready" ? { status: "ready", data: { ...prev.data, entries: apply(prev.data.entries) } } : prev));
        setAction({ status: "idle" });
      } catch (error) {
        setAction({ status: "error", message: (error as Error).message, retry: () => void attempt() });
      }
    };
    void attempt();
  }

  const add = (limit: Habit, amount: number) =>
    save(async () => {
      const entry = await addEntry(limit.id, date, amount);
      return (entries) => [...entries, entry];
    });

  const remove = (entry: Entry) =>
    save(async () => {
      await deleteEntry(entry.id);
      return (entries) => entries.filter((e) => e.id !== entry.id);
    });

  const busy = action.status === "saving";

  return (
    <div className="habits">
      <header className="habits-header">
        <div>
          <Link to="/habits" className="habits-back">
            ← Nawyki
          </Link>
          <h1 className="habits-title">Limity</h1>
        </div>
        <div className="habits-header-actions">
          <Link to="/habits/limits/list" className="habits-button">
            Lista limitów
          </Link>
          <Link to="/habits/limits/add" className="habits-button is-primary">
            + Dodaj
          </Link>
        </div>
      </header>

      <nav className="habits-nav" aria-label="Dzień">
        <button type="button" className="habits-button habits-arrow" onClick={() => setDate(addDays(date, -1))} aria-label="Poprzedni dzień">
          ‹
        </button>
        <span className="habits-nav-label">
          {dateLabel(date)}
          {date === today && " · dziś"}
        </span>
        <button
          type="button"
          className="habits-button habits-arrow"
          onClick={() => setDate(addDays(date, 1))}
          disabled={date >= today}
          aria-label="Następny dzień"
        >
          ›
        </button>
        {date !== today && (
          <button type="button" className="habits-button" onClick={() => setDate(today)}>
            Dziś
          </button>
        )}
      </nav>

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
          <span>Nie udało się wczytać limitów. {load.message}</span>
          <button type="button" className="habits-button" onClick={() => setReloadCount((n) => n + 1)}>
            Spróbuj ponownie
          </button>
        </div>
      )}

      {limits && !hasLimits && (
        <p className="habits-empty">
          Brak limitów. <Link to="/habits/limits/add">Dodaj limit</Link>.
        </p>
      )}
      {limits && hasLimits && limits.length === 0 && <p className="habits-empty">Brak limitów na ten dzień.</p>}

      {limits && limits.length > 0 && (
        <ul className="habits-cards">
          {limits.map(({ limit, sum, state, periodEntries }) => {
            const target = limit.target ?? 0;
            const period = limit.period ?? "day";
            return (
              <li key={limit.id} className={`habits-card is-${state}`}>
                <div className="habits-card-head">
                  <span className="habits-card-name">{limit.name}</span>
                  <span className="habits-card-state">
                    {state === "exceeded" ? "przekroczony" : `zostało ${formatAmount(target - sum)} ${limit.unit}`}
                  </span>
                </div>
                <div className="habits-progress-text">
                  <strong>
                    {formatAmount(sum)} / {formatAmount(target)}
                  </strong>{" "}
                  {limit.unit} {PERIOD_ADVERBS[period]}
                  {period !== "day" && <span className="habits-row-note"> · {periodLabel(period, date)}</span>}
                </div>
                <div className="habits-progress" aria-hidden="true">
                  <div
                    className="habits-progress-bar"
                    style={{ width: `${target > 0 ? Math.min(sum / target, 1) * 100 : sum > 0 ? 100 : 0}%` }}
                  />
                </div>
                <EntryControls
                  habit={limit}
                  entries={periodEntries}
                  disabled={busy}
                  onAdd={(amount) => add(limit, amount)}
                  onDelete={remove}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
