import { useEffect, useState } from "react";
import { Link } from "react-router";
import { itemsTotals, type PlanNames } from "../../meal-plans/meal-plans";
import { PlanCardSummary, PlanItems } from "../../meal-plans/PlanItems";
import { usePlanNames } from "../../meal-plans/usePlanNames";
import { currentWeekStart, dayLabel, todayIn } from "../../../../shared/dates";
import { getWeekPlan, sourceLabel, variantOf, type WeekPlanDay } from "../week-plan";
import "../../meals/MealsScreen.css";
import "../WeekPlanScreen.css";
import "./TodayMenuScreen.css";

/** `saved` is undefined when today has no plan. */
type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; saved?: WeekPlanDay };

/** Read-only view of today's day from the week plan; the day is set when the screen opens. */
export function TodayMenuScreen() {
  const [weekStart] = useState(currentWeekStart);
  const [day] = useState(() => todayIn(weekStart)!);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);
  const { names } = usePlanNames();

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    getWeekPlan(weekStart).then(
      (plan) => !cancelled && setLoad({ status: "ready", saved: plan.days.find((d) => d.day === day) }),
      (error: Error) => !cancelled && setLoad({ status: "error", message: error.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [weekStart, day, reloadCount]);

  return (
    <div className="today-menu">
      <header className="meals-header">
        <Link to="/diet" className="meals-back">
          ← Dieta
        </Link>
        <h1 className="meals-title">Dzisiejsze menu</h1>
      </header>

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
        (load.saved ? (
          <TodayDay title={dayLabel(weekStart, day)} saved={load.saved} names={names} />
        ) : (
          <div className="today-menu-empty">
            <p className="meals-empty">Na dziś nie ma planu.</p>
            <Link to="/diet/week-plan" className="week-button">
              Plan tygodnia
            </Link>
          </div>
        ))}
    </div>
  );
}

function TodayDay({ title, saved, names }: { title: string; saved: WeekPlanDay; names: PlanNames | null }) {
  const source = sourceLabel(saved.source, names);
  return (
    <>
      <div className="meals-item today-menu-card">
        <div className="meals-item-summary">
          <PlanCardSummary
            title={
              <>
                {title}
                {source && <span className="week-source">{source}</span>}
              </>
            }
            totals={itemsTotals(saved.items)}
            targetKcal={variantOf(saved.source)?.targetKcal}
          />
        </div>
      </div>
      <PlanItems items={saved.items} />
    </>
  );
}
