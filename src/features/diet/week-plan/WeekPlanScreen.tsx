import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { number } from "../meals/MealDetails";
import { getMealPlanVariants, itemsTotals, planTotals, TARGET_TOLERANCE, type MealPlan } from "../meal-plans/meal-plans";
import { PlanCardSummary, PlanItems } from "../meal-plans/PlanItems";
import {
  clearDay,
  clearWeek,
  copyWeek,
  currentWeekStart,
  dayDate,
  dayLabel,
  DAYS_IN_WEEK,
  getWeekPlan,
  listWeeks,
  saveDay,
  shiftWeek,
  todayIn,
  toIsoDate,
  weekFromParam,
  weekLabel,
  type WeekPlan,
  type WeekPlanDay,
  type WeekPlanSource,
  type WeekSummary,
} from "./week-plan";
import "./WeekPlanScreen.css";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; plan: WeekPlan };

/** Saving or clearing a day; on error the user can retry the same action. */
type Action = { status: "idle" } | { status: "saving" } | { status: "error"; message: string; retry: () => void };

function variantOf(source: WeekPlanSource | null) {
  return source ? getMealPlanVariants().find((v) => v.id === source.variantId) : undefined;
}

function sourceLabel(source: WeekPlanSource | null): string | null {
  if (!source) return null;
  return `${variantOf(source)?.name ?? source.variantId} · nr ${source.planNumber}`;
}

export function WeekPlanScreen() {
  // The shown week lives in the URL (?week=), so returning from Week statistics opens the same week.
  const [params, setParams] = useSearchParams();
  const weekStart = weekFromParam(params.get("week"));
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [pickingDay, setPickingDay] = useState<number | null>(null);
  const [copying, setCopying] = useState(false);
  const [action, setAction] = useState<Action>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    getWeekPlan(weekStart).then(
      (plan) => !cancelled && setLoad({ status: "ready", plan }),
      (error: Error) => !cancelled && setLoad({ status: "error", message: error.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [weekStart, reloadCount]);

  const busy = action.status === "saving";

  function goToWeek(week: string) {
    setParams({ week }, { replace: true });
    setOpenDay(null);
    setPickingDay(null);
    setCopying(false);
    setAction({ status: "idle" });
  }

  /** Puts the saved day into the loaded week (null = day cleared). */
  function replaceDay(day: number, saved: WeekPlanDay | null) {
    setLoad((prev) => {
      if (prev.status !== "ready") return prev;
      const days = prev.plan.days.filter((d) => d.day !== day);
      if (saved) days.push(saved);
      days.sort((a, b) => a.day - b.day);
      return { status: "ready", plan: { ...prev.plan, days } };
    });
  }

  function run(task: () => Promise<void>) {
    const attempt = async () => {
      setAction({ status: "saving" });
      try {
        await task();
        setAction({ status: "idle" });
      } catch (error) {
        setAction({ status: "error", message: (error as Error).message, retry: () => void attempt() });
      }
    };
    void attempt();
  }

  function startPicking(day: number) {
    setPickingDay(day);
    setAction({ status: "idle" });
    window.scrollTo({ top: 0 });
  }

  function pick(day: number, variantId: string, plan: MealPlan) {
    run(async () => {
      const saved = await saveDay(weekStart, day, plan.items, { variantId, planNumber: plan.number });
      replaceDay(day, saved);
      setPickingDay(null);
      setOpenDay(day);
    });
  }

  function clear(day: number) {
    run(async () => {
      await clearDay(weekStart, day);
      replaceDay(day, null);
      setOpenDay(null);
    });
  }

  function startCopying() {
    setCopying(true);
    setAction({ status: "idle" });
    window.scrollTo({ top: 0 });
  }

  /** The shown week becomes an exact copy of `from`; asks first when the week already has days. */
  function copyFrom(from: string, plannedDays: number) {
    const question =
      `Ten tydzień (${weekLabel(weekStart)}) ma już zaplanowane dni: ${plannedDays}. ` +
      `Zastąpić je planem z tygodnia ${weekLabel(from)}?`;
    if (plannedDays > 0 && !window.confirm(question)) return;
    run(async () => {
      const plan = await copyWeek(weekStart, from);
      setLoad({ status: "ready", plan });
      setCopying(false);
      setOpenDay(null);
    });
  }

  function clearAll(plannedDays: number) {
    if (!window.confirm(`Wyczyścić cały tydzień ${weekLabel(weekStart)}? Zaplanowane dni: ${plannedDays}.`)) return;
    run(async () => {
      await clearWeek(weekStart);
      setLoad((prev) => (prev.status === "ready" ? { status: "ready", plan: { ...prev.plan, days: [] } } : prev));
      setOpenDay(null);
    });
  }

  const isCurrentWeek = weekStart === currentWeekStart();

  return (
    <div className="week-plan page-wide">
      <header className="meals-header">
        <Link to="/diet" className="meals-back">
          ← Dieta
        </Link>
        <h1 className="meals-title">Plan tygodnia</h1>
      </header>

      <nav className="week-nav" aria-label="Tydzień">
        <button
          type="button"
          className="week-button week-arrow"
          aria-label="Poprzedni tydzień"
          onClick={() => goToWeek(shiftWeek(weekStart, -1))}
        >
          ←
        </button>
        <span className="week-nav-label">{weekLabel(weekStart)}</span>
        <button
          type="button"
          className="week-button week-arrow"
          aria-label="Następny tydzień"
          onClick={() => goToWeek(shiftWeek(weekStart, 1))}
        >
          →
        </button>
        {!isCurrentWeek && (
          <button type="button" className="week-button" onClick={() => goToWeek(currentWeekStart())}>
            Ten tydzień
          </button>
        )}
      </nav>

      {action.status === "saving" && <p className="week-status">Zapisywanie…</p>}
      {action.status === "error" && (
        <div className="week-status is-error" role="alert">
          <span>Nie udało się zapisać. {action.message}</span>
          <button type="button" className="week-button" onClick={action.retry}>
            Spróbuj ponownie
          </button>
          <button type="button" className="week-button" onClick={() => setAction({ status: "idle" })}>
            Zamknij
          </button>
        </div>
      )}

      {load.status === "loading" && <p className="meals-empty">Ładowanie…</p>}

      {load.status === "error" && (
        <div className="week-status is-error" role="alert">
          <span>Nie udało się wczytać planu. {load.message}</span>
          <button type="button" className="week-button" onClick={() => setReloadCount((n) => n + 1)}>
            Spróbuj ponownie
          </button>
        </div>
      )}

      {load.status === "ready" &&
        (copying ? (
          <WeekCopyPicker
            weekStart={weekStart}
            busy={busy}
            onPick={(from) => copyFrom(from, load.plan.days.length)}
            onCancel={() => {
              setCopying(false);
              setAction({ status: "idle" });
            }}
          />
        ) : pickingDay !== null ? (
          <PlanPicker
            title={dayLabel(weekStart, pickingDay)}
            current={load.plan.days.find((d) => d.day === pickingDay)?.source ?? null}
            busy={busy}
            onPick={(variantId, plan) => pick(pickingDay, variantId, plan)}
            onCancel={() => {
              setPickingDay(null);
              setAction({ status: "idle" });
            }}
          />
        ) : (
          <WeekDays
            weekStart={weekStart}
            plan={load.plan}
            openDay={openDay}
            busy={busy}
            onToggle={(day) => setOpenDay(openDay === day ? null : day)}
            onPick={startPicking}
            onClear={clear}
            onCopyWeek={startCopying}
            onClearWeek={() => clearAll(load.plan.days.length)}
          />
        ))}
    </div>
  );
}

type WeekDaysProps = {
  weekStart: string;
  plan: WeekPlan;
  openDay: number | null;
  busy: boolean;
  onToggle: (day: number) => void;
  onPick: (day: number) => void;
  onClear: (day: number) => void;
  onCopyWeek: () => void;
  onClearWeek: () => void;
};

/** The 7 day cards; a planned day expands (phone) or opens in the panel (PC). */
function WeekDays({ weekStart, plan, openDay, busy, onToggle, onPick, onClear, onCopyWeek, onClearWeek }: WeekDaysProps) {
  const byDay = new Map(plan.days.map((d) => [d.day, d]));
  const today = todayIn(weekStart);
  const open = openDay !== null ? byDay.get(openDay) : undefined;

  const details = (saved: WeekPlanDay) => (
    <>
      <div className="week-actions">
        <button type="button" className="week-button" disabled={busy} onClick={() => onPick(saved.day)}>
          Zmień jadłospis
        </button>
        <button type="button" className="week-button" disabled={busy} onClick={() => onClear(saved.day)}>
          Wyczyść dzień
        </button>
      </div>
      <PlanItems key={`${weekStart}-${saved.day}-${saved.updatedAt}`} items={saved.items} />
    </>
  );

  return (
    <>
      <div className="week-actions week-week-actions">
        <button type="button" className="week-button" disabled={busy} onClick={onCopyWeek}>
          Skopiuj z innego tygodnia…
        </button>
        <button type="button" className="week-button" disabled={busy || plan.days.length === 0} onClick={onClearWeek}>
          Wyczyść tydzień
        </button>
      </div>
      <div className="week-planned">
        <p className="plans-target">
          Zaplanowane: {plan.days.length}/{DAYS_IN_WEEK} dni
        </p>
        {plan.days.length > 0 ? (
          <>
            <Link to={`/diet/week-plan/statistics?week=${weekStart}`} className="week-button">
              Pokaż statystyki
            </Link>
            <Link
              to={`/diet/shopping-lists/new?from=${weekStart}&to=${toIsoDate(dayDate(weekStart, DAYS_IN_WEEK - 1))}`}
              className="week-button"
            >
              Lista zakupów
            </Link>
          </>
        ) : (
          <>
            <button type="button" className="week-button" disabled>
              Pokaż statystyki
            </button>
            <button type="button" className="week-button" disabled>
              Lista zakupów
            </button>
          </>
        )}
      </div>

      <div className="meals-layout">
        <ul className="meals-list">
          {Array.from({ length: DAYS_IN_WEEK }, (_, day) => {
            const saved = byDay.get(day);
            const isToday = day === today;
            const label = (
              <>
                {dayLabel(weekStart, day)}
                {isToday && <span className="week-today">dziś</span>}
              </>
            );

            if (!saved) {
              return (
                <li key={day} className={"meals-item week-day" + (isToday ? " is-today" : "")}>
                  <div className="week-empty-day">
                    <span className="meals-item-name">
                      {label}
                      <span className="meals-unit"> — brak planu</span>
                    </span>
                    <button type="button" className="week-button" disabled={busy} onClick={() => onPick(day)}>
                      Wybierz
                    </button>
                  </div>
                </li>
              );
            }

            const isOpen = openDay === day;
            const source = sourceLabel(saved.source);
            return (
              <li
                key={day}
                className={"meals-item week-day" + (isToday ? " is-today" : "") + (isOpen ? " is-open" : "")}
              >
                <button
                  type="button"
                  className="meals-item-summary"
                  aria-expanded={isOpen}
                  onClick={() => onToggle(day)}
                >
                  <PlanCardSummary
                    title={
                      <>
                        {label}
                        {source && <span className="week-source">{source}</span>}
                      </>
                    }
                    totals={itemsTotals(saved.items)}
                    targetKcal={variantOf(saved.source)?.targetKcal}
                  />
                </button>

                {/* phone: details under the card */}
                {isOpen && <div className="meals-details meals-details-inline">{details(saved)}</div>}
              </li>
            );
          })}
        </ul>

        {/* PC: details of the selected day next to the list */}
        <aside className="meals-panel">
          {open ? (
            <div className="meals-details">
              <h2 className="meals-panel-title">{dayLabel(weekStart, open.day)}</h2>
              {details(open)}
            </div>
          ) : (
            <p className="meals-panel-empty">Wybierz dzień z listy.</p>
          )}
        </aside>
      </div>
    </>
  );
}

type PlanPickerProps = {
  title: string;
  /** Source of the day being changed — its variant is preselected and its plan marked. */
  current: WeekPlanSource | null;
  busy: boolean;
  onPick: (variantId: string, plan: MealPlan) => void;
  onCancel: () => void;
};

/**
 * Meal plan list for one day. Tapping a plan only opens it (phone: under the card, PC: panel);
 * the day is saved with "Wybierz ten jadłospis" in the opened plan.
 */
function PlanPicker({ title, current, busy, onPick, onCancel }: PlanPickerProps) {
  const variants = getMealPlanVariants();
  const [variantId, setVariantId] = useState(variantOf(current)?.id ?? variants[0]?.id ?? "");
  const [openNumber, setOpenNumber] = useState<number | null>(current?.planNumber ?? null);
  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  const totals = useMemo(
    () => new Map((variant?.plans ?? []).map((plan) => [plan.number, planTotals(plan)])),
    [variant],
  );

  const isCurrent = (plan: MealPlan) => current?.variantId === variant?.id && current?.planNumber === plan.number;
  const openPlan = variant?.plans.find((plan) => plan.number === openNumber) ?? null;

  const details = (plan: MealPlan) => (
    <>
      <div className="week-actions">
        {isCurrent(plan) ? (
          <span className="week-current">Obecnie wybrany</span>
        ) : (
          <button type="button" className="week-button is-primary" disabled={busy} onClick={() => onPick(variant!.id, plan)}>
            Wybierz ten jadłospis
          </button>
        )}
      </div>
      <PlanItems key={plan.number} items={plan.items} />
    </>
  );

  return (
    <section className="week-picker is-wide">
      <div className="week-picker-header">
        <h2 className="meals-panel-title">Wybierz jadłospis — {title}</h2>
        <button type="button" className="week-button" onClick={onCancel}>
          Anuluj
        </button>
      </div>

      {!variant ? (
        <p className="meals-empty">Brak jadłospisów.</p>
      ) : (
        <>
          <div className="meals-sort">
            <label className="meals-sort-label" htmlFor="week-plan-variant">
              Wariant
            </label>
            <select
              id="week-plan-variant"
              className="meals-sort-select"
              value={variant.id}
              onChange={(e) => {
                setVariantId(e.target.value);
                setOpenNumber(null);
              }}
            >
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <p className="plans-target">
            Cel: {number.format(variant.targetKcal)} kcal · wyróżnione: poza ±{TARGET_TOLERANCE * 100}%
          </p>

          <div className="meals-layout">
            <ul className="meals-list">
              {variant.plans.map((plan) => {
                const isOpen = openNumber === plan.number;
                return (
                  <li key={plan.number} className={"meals-item" + (isOpen ? " is-open" : "")}>
                    <button
                      type="button"
                      className="meals-item-summary"
                      aria-expanded={isOpen}
                      onClick={() => setOpenNumber(isOpen ? null : plan.number)}
                    >
                      <PlanCardSummary
                        title={
                          <>
                            Jadłospis {plan.number}
                            {isCurrent(plan) && <span className="week-source">obecnie wybrany</span>}
                          </>
                        }
                        totals={totals.get(plan.number)!}
                        targetKcal={variant.targetKcal}
                      />
                    </button>

                    {/* phone: details under the card */}
                    {isOpen && <div className="meals-details meals-details-inline">{details(plan)}</div>}
                  </li>
                );
              })}
            </ul>

            {/* PC: details of the opened plan next to the list */}
            <aside className="meals-panel">
              {openPlan ? (
                <div className="meals-details">
                  <h2 className="meals-panel-title">Jadłospis {openPlan.number}</h2>
                  {details(openPlan)}
                </div>
              ) : (
                <p className="meals-panel-empty">Kliknij jadłospis, żeby zobaczyć, co zawiera.</p>
              )}
            </aside>
          </div>
        </>
      )}
    </section>
  );
}

type WeekCopyPickerProps = {
  /** The week that receives the copy — left out of the list. */
  weekStart: string;
  busy: boolean;
  onPick: (from: string) => void;
  onCancel: () => void;
};

type WeeksLoad = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; weeks: WeekSummary[] };

/** List of weeks with saved days; tapping one copies it into the shown week. */
function WeekCopyPicker({ weekStart, busy, onPick, onCancel }: WeekCopyPickerProps) {
  const [weeks, setWeeks] = useState<WeeksLoad>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setWeeks({ status: "loading" });
    listWeeks().then(
      (list) => !cancelled && setWeeks({ status: "ready", weeks: list.filter((w) => w.weekStart !== weekStart) }),
      (error: Error) => !cancelled && setWeeks({ status: "error", message: error.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [weekStart, reloadCount]);

  return (
    <section className="week-picker">
      <div className="week-picker-header">
        <h2 className="meals-panel-title">Skopiuj do {weekLabel(weekStart)} z tygodnia:</h2>
        <button type="button" className="week-button" onClick={onCancel}>
          Anuluj
        </button>
      </div>

      {weeks.status === "loading" && <p className="meals-empty">Ładowanie…</p>}

      {weeks.status === "error" && (
        <div className="week-status is-error" role="alert">
          <span>Nie udało się wczytać tygodni. {weeks.message}</span>
          <button type="button" className="week-button" onClick={() => setReloadCount((n) => n + 1)}>
            Spróbuj ponownie
          </button>
        </div>
      )}

      {weeks.status === "ready" &&
        (weeks.weeks.length === 0 ? (
          <p className="meals-empty">Brak innych zaplanowanych tygodni.</p>
        ) : (
          <ul className="meals-list week-picker-list">
            {weeks.weeks.map((week) => (
              <li key={week.weekStart} className="meals-item">
                <button
                  type="button"
                  className="meals-item-summary"
                  disabled={busy}
                  onClick={() => onPick(week.weekStart)}
                >
                  <span className="meals-item-name">{weekLabel(week.weekStart)}</span>
                  <span className="meals-item-macros">
                    Zaplanowane: {week.days}/{DAYS_IN_WEEK} dni
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
