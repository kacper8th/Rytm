import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { addDays, dateLabel, toIsoDate } from "../../shared/dates";
import { Card } from "../../shared/ui/Card";
import {
  addEntry,
  getEntries,
  getHabits,
  getSettings,
  saveSettings,
  type Entry,
  type Habit,
  type Period,
  type Settings,
} from "./habits";
import {
  entriesIn,
  firstDayShown,
  formatAmount,
  goalState,
  habitRange,
  homeRange,
  limitState,
  loadRange,
  periodInHome,
  runLabel,
  showsOn,
  sumOf,
} from "./periods";
import "./Habits.css";

type Data = { habits: Habit[]; entries: Entry[]; settings: Settings };
type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: Data };

/** One goal or limit on the card, with its sum in the period that contains today. */
type Row = { habit: Habit; sum: number; state: "done" | "open" | "missed" | "within" | "exceeded" };

/** Sections of goals and limits, by the period they are summed over (a goal with a repeat rule counts per day). */
const SECTIONS: { period: Period; title: string }[] = [
  { period: "day", title: "Dziś" },
  { period: "week", title: "W tym tygodniu" },
  { period: "month", title: "W tym miesiącu" },
];

/** How far ahead "show all" looks for the next day of a goal with a repeat rule. */
const SHOW_ALL_DAYS = 400;

/**
 * Habits card for the Home screen — the public part of the Habits module that Home shows. What it shows follows the
 * Habits settings (shared by all devices): the range of days, or all habits. Goals and limits of today, of this week
 * and of this month in separate sections (with progress and a quick button); goals with a repeat rule that fall on a
 * later day of the range (or habits that start later) under "next days" with their date; then counters.
 */
export function HabitsCard() {
  const today = toIsoDate(new Date());
  const range = loadRange(today);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getHabits(), getEntries(range.from, range.to), getSettings()]).then(
      ([habits, entries, settings]) => !cancelled && setLoad({ status: "ready", data: { habits, entries, settings } }),
      (error: Error) => !cancelled && setLoad({ status: "error", message: error.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, reloadCount]);

  const view = useMemo(() => {
    if (load.status !== "ready") return null;
    const { habits, entries, settings } = load.data;
    const range = homeRange(settings, today);
    const ahead = settings.homeShowAll ? { from: today, to: addDays(today, SHOW_ALL_DAYS) } : range;
    const tracked = habits.filter((h) => h.kind === "goal" || h.kind === "limit");
    const inRange = (h: Habit) => settings.homeShowAll || periodInHome(h.period ?? "day", settings);
    // Habits with a later first day in the range (goals by rule, habits that start later): shown with their date.
    const next = tracked
      .filter((h) => !showsOn(h, today) && (h.rule || inRange(h)))
      .map((habit) => ({ habit, date: firstDayShown(habit, ahead) }))
      .filter((n): n is { habit: Habit; date: string } => n.date !== null)
      .sort((a, b) => a.date.localeCompare(b.date) || a.habit.name.localeCompare(b.habit.name, "pl"));
    const rows: (Row & { period: Period })[] = tracked
      .filter((h) => showsOn(h, today) && inRange(h))
      .map((habit) => {
        const habitPeriod = habitRange(habit, today);
        const sum = sumOf(entriesIn(entries, habit.id, habitPeriod));
        const target = habit.target ?? 0;
        const state = habit.kind === "limit" ? limitState(sum, target) : goalState(sum, target, habitPeriod, today);
        return { habit, sum, state, period: habit.period ?? "day" };
      });
    const sections = SECTIONS.map((s) => ({ ...s, rows: rows.filter((r) => r.period === s.period) })).filter(
      (s) => s.rows.length > 0,
    );
    const goals = rows.filter((r) => r.habit.kind === "goal");
    return {
      sections,
      next,
      showAll: settings.homeShowAll,
      counters: habits.filter((h) => h.kind === "counter"),
      goalsDone: goals.filter((r) => r.state === "done").length,
      goalsCount: goals.length,
      empty: habits.length === 0,
    };
  }, [load, today]);

  async function quickAdd(habit: Habit, amount: number) {
    setSaving(true);
    setSaveError(null);
    try {
      const entry = await addEntry(habit.id, today, amount);
      setLoad((prev) => (prev.status === "ready" ? { status: "ready", data: { ...prev.data, entries: [...prev.data.entries, entry] } } : prev));
    } catch (error) {
      setSaveError((error as Error).message);
    }
    setSaving(false);
  }

  /** Switches between all habits and the range of the settings; saved on the server (shared by devices). */
  async function toggleShowAll() {
    if (load.status !== "ready") return;
    const settings = load.data.settings;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveSettings({ ...settings, homeShowAll: !settings.homeShowAll });
      setLoad((prev) => (prev.status === "ready" ? { status: "ready", data: { ...prev.data, settings: saved } } : prev));
    } catch (error) {
      setSaveError((error as Error).message);
    }
    setSaving(false);
  }

  const badge = view && view.goalsCount > 0 ? `${view.goalsDone} / ${view.goalsCount}` : undefined;

  return (
    <Card icon="✔️" title="Nawyki" badge={badge}>
      {load.status === "loading" && <p className="habits-row-note">Wczytywanie…</p>}
      {load.status === "error" && (
        <div className="habits-status is-error" role="alert">
          <span>Nie udało się wczytać nawyków. {load.message}</span>
          <button type="button" className="habits-button" onClick={() => setReloadCount((n) => n + 1)}>
            Spróbuj ponownie
          </button>
        </div>
      )}
      {saveError && (
        <p className="habits-status is-error" role="alert">
          Nie udało się zapisać. {saveError}
        </p>
      )}

      {view?.empty && (
        <p className="habits-empty">
          Brak nawyków. <Link to="/habits">Dodaj w Nawykach</Link>.
        </p>
      )}

      {view && !view.empty && (
        <div className="habits-home-switch">
          <span className="habits-row-note">{view.showAll ? "Wszystkie nawyki" : "Nawyki z wybranego zakresu"}</span>
          <button type="button" className="habits-button" disabled={saving} onClick={() => void toggleShowAll()}>
            {view.showAll ? "Schowaj" : "Pokaż wszystkie"}
          </button>
        </div>
      )}

      {view?.sections.map((section) => (
        <section key={section.period} className="habits-home-section">
          <h3 className="habits-home-title">{section.title}</h3>
          <ul className="habits-home-list">
            {section.rows.map((row) => (
              <HomeRow key={row.habit.id} row={row} disabled={saving} onAdd={(amount) => void quickAdd(row.habit, amount)} />
            ))}
          </ul>
        </section>
      ))}

      {view && view.next.length > 0 && (
        <section className="habits-home-section">
          <h3 className="habits-home-title">{view.showAll ? "Następne" : "Najbliższe dni"}</h3>
          <ul className="habits-home-list">
            {view.next.map(({ habit, date }) => (
              <li key={habit.id} className="habits-home-row">
                <Link to={habit.kind === "limit" ? "/habits/limits" : "/habits/goals"} className="habits-home-name">
                  {habit.name}
                </Link>
                <span className="habits-row-note">{date === addDays(today, 1) ? "jutro" : dateLabel(date)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view && view.counters.length > 0 && (
        <section className="habits-home-section">
          <h3 className="habits-home-title">Liczniki</h3>
          <ul className="habits-home-list">
            {view.counters.map((counter) => (
              <li key={counter.id} className="habits-home-row">
                <Link to="/habits/counters" className="habits-home-name">
                  {counter.name}
                </Link>
                <strong>{runLabel(counter.runStart ?? counter.startDate, today)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view && !view.empty && (
        <nav className="habits-home-links" aria-label="Nawyki">
          <Link to="/habits/goals">Cele</Link>
          <Link to="/habits/limits">Limity</Link>
          <Link to="/habits/counters">Liczniki</Link>
          <Link to="/habits/statistics">Statystyki</Link>
        </nav>
      )}
    </Card>
  );
}

/** A goal (check box, sum / target) or a limit (sum / limit, what is left or "exceeded"), with a quick button. */
function HomeRow({ row, disabled, onAdd }: { row: Row; disabled: boolean; onAdd: (amount: number) => void }) {
  const { habit, sum, state } = row;
  const target = habit.target ?? 0;
  const isLimit = habit.kind === "limit";
  const quick = habit.buttonValues[0];
  return (
    <li className={`habits-home-row is-${state}`}>
      <Link to={isLimit ? "/habits/limits" : "/habits/goals"} className="habits-home-name">
        {!isLimit && (
          <span className="habits-home-check" aria-hidden="true">
            {state === "done" ? "✓" : ""}
          </span>
        )}
        {habit.name}
      </Link>
      <span className={state === "exceeded" ? "habits-home-over" : "habits-row-note"}>
        {isLimit ? "≤ " : ""}
        {formatAmount(sum)} / {formatAmount(target)} {habit.unit}
        {state === "exceeded" && " · przekroczony"}
      </span>
      {quick !== undefined && (
        <button
          type="button"
          className="habits-button"
          disabled={disabled}
          onClick={() => onAdd(quick)}
          aria-label={`Dodaj ${formatAmount(quick)} ${habit.unit} - ${habit.name}`}
        >
          +{formatAmount(quick)}
        </button>
      )}
    </li>
  );
}
