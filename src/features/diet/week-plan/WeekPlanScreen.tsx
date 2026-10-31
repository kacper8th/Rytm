import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { number } from "../meals/MealDetails";
import { getMealPlanVariants, itemsTotals, planTotals, TARGET_TOLERANCE, type MealPlan } from "../meal-plans/meal-plans";
import { PlanCardSummary, PlanItems } from "../meal-plans/PlanItems";
import {
  clearDay,
  currentWeekStart,
  dayLabel,
  DAYS_IN_WEEK,
  getWeekPlan,
  saveDay,
  shiftWeek,
  todayIn,
  weekLabel,
  type WeekPlan,
  type WeekPlanDay,
  type WeekPlanSource,
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
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [pickingDay, setPickingDay] = useState<number | null>(null);
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
    setWeekStart(week);
    setOpenDay(null);
    setPickingDay(null);
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
        (pickingDay !== null ? (
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
};

/** The 7 day cards; a planned day expands (phone) or opens in the panel (PC). */
function WeekDays({ weekStart, plan, openDay, busy, onToggle, onPick, onClear }: WeekDaysProps) {
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
      <p className="plans-target">
        Zaplanowane: {plan.days.length}/{DAYS_IN_WEEK} dni
      </p>

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

/** Meal plan list for one day; tapping a plan saves it at once. */
function PlanPicker({ title, current, busy, onPick, onCancel }: PlanPickerProps) {
  const variants = getMealPlanVariants();
  const [variantId, setVariantId] = useState(variantOf(current)?.id ?? variants[0]?.id ?? "");
  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  const totals = useMemo(
    () => new Map((variant?.plans ?? []).map((plan) => [plan.number, planTotals(plan)])),
    [variant],
  );

  return (
    <section className="week-picker">
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
              onChange={(e) => setVariantId(e.target.value)}
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

          <ul className="meals-list week-picker-list">
            {variant.plans.map((plan) => {
              const isCurrent = current?.variantId === variant.id && current.planNumber === plan.number;
              return (
                <li key={plan.number} className={"meals-item" + (isCurrent ? " is-open" : "")}>
                  <button
                    type="button"
                    className="meals-item-summary"
                    disabled={busy}
                    onClick={() => onPick(variant.id, plan)}
                  >
                    <PlanCardSummary
                      title={
                        <>
                          Jadłospis {plan.number}
                          {isCurrent && <span className="week-source">obecnie wybrany</span>}
                        </>
                      }
                      totals={totals.get(plan.number)!}
                      targetKcal={variant.targetKcal}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
